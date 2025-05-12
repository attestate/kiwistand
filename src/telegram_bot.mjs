import { Wallet } from "@ethersproject/wallet";
import { keccak256 } from "ethereum-cryptography/keccak.js";
import { toHex } from "ethereum-cryptography/utils.js";
import { encode } from "cbor-x";
import canonicalize from "canonicalize";
import { env } from "process";
import fetch from "node-fetch"; // Ensure node-fetch is installed or use native fetch
import { decode } from "html-entities"; // Import html-entities library
import https from "https"; // <-- Import https module

// Import the new relevance checker and metadata function
import { metadata, isRelevantToKiwiNews } from "./parser.mjs";
import { lifetimeCache } from "./cache.mjs";
import log from "./logger.mjs"; // Assuming a logger module exists at this path

// --- Configuration ---
// Get channel index from environment
const PROCESS_INDEX = env.PROCESS_INDEX;
// Construct the environment variable name for the target channel
const TARGET_CHANNEL_ENV_VAR = `TELEGRAM_CHANNEL_${PROCESS_INDEX}`;
// Read the actual channel name from the constructed env var name
const TARGET_CHANNEL = env[TARGET_CHANNEL_ENV_VAR];

const TELEGRAM_API_BASE = "https://tg.i-c-a.su";
// *** Connect to localhost since bot runs on the same server ***
const BACKEND_API_URL = "https://localhost:8443";
const BOT_PRIVATE_KEY = env.TELEGRAM_BOT_PRIVATE_KEY; // MUST be set in environment for production
const FETCH_LIMIT = 20; // Fetch more posts to increase chance of finding relevant ones
const SUBMIT_LIMIT = 5; // Max links to submit per run per channel
const USER_AGENT = "KiwiNewsTelegramBot/1.0"; // Set a custom user agent
const SIMULATION_MODE = env.SIMULATION_MODE === "true"; // Check for simulation mode
// Set back to 18 minutes for production
const MAX_POST_AGE_MINUTES = 25; // Only process posts newer than this
const RETRY_DELAY_MS = 20000; // 20 seconds delay between retries
const MAX_FETCH_RETRIES = 2; // Initial attempt + 2 retries = 3 total attempts
const REDIRECT_TIMEOUT_MS = 8000; // 8 second timeout for resolving redirects and fetching HTML
const HTML_FETCH_TIMEOUT_MS = 8000; // Timeout specifically for fetching HTML content

// --- Create insecure HTTPS agent ---
// WARNING: Only use this for localhost connections where cert name mismatch is expected!
const insecureAgent = new https.Agent({
  rejectUnauthorized: false,
});
// ---

// --- EIP-712 Definitions (Copied from src/web/src/API.mjs) ---
const EIP712_DOMAIN = {
  name: "kiwinews",
  version: "1.0.0",
  salt: "0xfe7a9d68e99b6942bb3a36178b251da8bd061c20ed1e795207ae97183b590e5b",
  // chainId: 1 // Assuming mainnet, adjust if needed, though likely not required server-side if backend doesn't check
};

const EIP712_TYPES = {
  Message: [
    { name: "title", type: "string" },
    { name: "href", type: "string" },
    { name: "type", type: "string" },
    { name: "timestamp", type: "uint256" },
  ],
};

function messageFab(title, href, type = "amplify") {
  return {
    title,
    href,
    type,
    timestamp: Math.floor(Date.now() / 1000),
  };
}

// --- Helper Functions ---

/**
 * Fetches latest posts from the specified Telegram channel, with simple retries on FLOOD_WAIT.
 * @param {string} channel - The Telegram channel name.
 * @param {number} limit - Maximum number of posts to fetch.
 * @returns {Promise<Array<object>>} - A promise resolving to an array of post objects.
 */
async function fetchTelegramPosts(channel, limit) {
  const url = `${TELEGRAM_API_BASE}/json/${channel}?limit=${limit}`;
  let attempts = 0;

  while (attempts <= MAX_FETCH_RETRIES) {
    attempts++;
    log(
      `Fetching Telegram posts for [${channel}] from: ${url} (Attempt ${attempts})`,
    );
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        timeout: 15000, // 15 second timeout
      });

      if (response.ok) {
        const data = await response.json();
        // The API wraps the posts in a 'messages' array
        return data?.messages || [];
      }

      // Handle non-OK responses
      const errorBody = await response.text();
      // Check for specific flood wait error (HTTP 420)
      if (response.status === 420 && errorBody.includes("FLOOD_WAIT")) {
        log(
          `Rate limit hit for channel ${channel} (Attempt ${attempts}): ${errorBody}.`,
        );
        if (attempts > MAX_FETCH_RETRIES) {
          log(`Max retries reached for channel ${channel}. Skipping this run.`);
          return []; // Give up after max retries
        }
        log(`Waiting ${RETRY_DELAY_MS / 1000} seconds before retry...`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        // Continue to the next iteration of the while loop
      } else {
        // Throw other non-OK errors immediately
        throw new Error(`HTTP error ${response.status}: ${errorBody}`);
      }
    } catch (error) {
      // Handle fetch errors (network issues, timeouts, etc.)
      log(
        `Error fetching Telegram posts for ${channel} (Attempt ${attempts}): ${error.message}`,
      );
      if (attempts > MAX_FETCH_RETRIES) {
        log(
          `Max retries reached after fetch error for channel ${channel}. Skipping this run.`,
        );
        return []; // Give up after max retries
      }
      // Optional: could add a shorter delay here for network errors if desired
      log(
        `Waiting ${
          RETRY_DELAY_MS / 1000
        } seconds before retry after fetch error...`,
      );
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  // Should not be reached if logic is correct, but return empty array as fallback
  return [];
}

/**
 * Extracts and cleans URLs from a Telegram post object.
 * Automatically converts vxtwitter.com links to fxtwitter.com.
 * @param {object} post - The Telegram post object.
 * @returns {Array<string>} - An array of unique, cleaned URLs found in the post.
 */
function extractLinksFromPost(post) {
  const links = new Set();
  // Regex to find URLs, stopping at whitespace, <, >, ", ' or end of line/string
  const urlRegex = /(https?:\/\/[^\s<>"]+)/g;

  // Function to clean and add a potential link
  const addCleanLink = (link) => {
    if (!link) return;
    try {
      // Decode HTML entities (e.g., &amp; -> &)
      let cleanedLink = decode(link.trim());

      // Remove trailing characters that are likely not part of the URL
      cleanedLink = cleanedLink.replace(/[.,!?)\]}"'>]+$/, "");

      // Basic validation and hostname check
      if (
        cleanedLink.startsWith("http://") ||
        cleanedLink.startsWith("https://")
      ) {
        const urlObject = new URL(cleanedLink);
        const hostname = urlObject.hostname.toLowerCase();

        // Canonicalize Twitter/X links by removing query string and hash
        if (hostname === 'twitter.com' || hostname === 'x.com') {
          // Reconstruct URL with only protocol, hostname, and pathname
          const canonicalLink = `${urlObject.protocol}//${urlObject.hostname}${urlObject.pathname}`;
          links.add(canonicalLink);
        } else {
          // Add non-Twitter/X links exactly as cleaned, without further normalization
          links.add(cleanedLink);
        }
      }
    } catch (error) {
      log(
        `Skipping invalid extracted link fragment "${link}": ${error.message}`,
      );
    }
  };

  // Check main text
  if (post?.message) {
    const matches = post.message.match(urlRegex);
    if (matches) {
      matches.forEach(addCleanLink);
    }
  }

  // Check for links in message entities (often used for formatting)
  if (post?.entities) {
    post.entities.forEach((entity) => {
      if (entity.type === "text_link" && entity.url) {
        addCleanLink(entity.url);
      }
      // Check for plain 'url' entities as well
      if (entity.type === "url") {
        // Extract the URL text from the message using offset and length
        const urlText = post.message.substring(
          entity.offset,
          entity.offset + entity.length,
        );
        addCleanLink(urlText);
      }
    });
  }

  // Check for web page preview links
  if (post?.media?.webpage?.url) {
    addCleanLink(post.media.webpage.url);
  }

  return Array.from(links);
}

/**
 * Creates an Ethers Wallet instance from a private key.
 * Returns null if the key is invalid or missing.
 * @param {string} privateKey - The private key hex string.
 * @returns {Wallet | null} - An Ethers Wallet instance or null.
 */
function getSigner(privateKey) {
  if (!privateKey) {
    // It's okay to not have a key in simulation mode
    if (!SIMULATION_MODE) {
      log(`Error creating signer: TELEGRAM_BOT_PRIVATE_KEY is missing.`);
    }
    return null;
  }
  try {
    return new Wallet(privateKey);
  } catch (error) {
    log(`Error creating signer: Invalid private key format.`);
    return null;
  }
}

/**
 * Submits a link to the Kiwi News backend API or simulates submission.
 * Leverages src/parser.mjs for title generation and compliance.
 * @param {string} link - The URL to submit (should be the final resolved URL if applicable).
 * @param {Wallet | null} signer - The Ethers Wallet instance for signing, or null if in simulation without key.
 * @returns {Promise<boolean>} - True if submission was successful/simulated or already submitted.
 */
async function submitLink(link, signer) {
  const cacheKey = `submitted-telegram-link-${link}`;
  if (lifetimeCache.get(cacheKey)) {
    log(`Link already submitted (cache hit): ${link}`);
    return true; // Treat as success if already processed
  }

  log(`Attempting to process link for submission: ${link}`);
  let initialMeta;
  let titleCandidate;
  let finalTitle;

  try {
    // Step 1: Get initial metadata and potentially generated title
    log(`Fetching initial metadata for ${link} (generateTitle=true)`);
    // Pass the potentially transformed link (e.g., fxtwitter, api.leviathannews, protos.com) to metadata
    initialMeta = await metadata(link, true);
    log(`Initial metadata result for ${link}:`, initialMeta);

    // Step 2: Determine the candidate title - *** CRITICAL CHECK ***
    titleCandidate = initialMeta?.compliantTitle || initialMeta?.ogTitle; // Use generated/OG title if available

    // *** If no title could be generated or found from OG tags, ABORT ***
    if (!titleCandidate) {
      log(`No usable title found/generated for ${link}. Skipping submission.`);
      return false; // Do not proceed without a title
    }
    log(`Using initial title as candidate: "${titleCandidate}"`);

    if (finalTitle) {
      log(`Using compliant title: "${finalTitle}"`);
    } else {
      // If no compliant title, use the candidate title and truncate if needed
      finalTitle = titleCandidate;
      if (finalTitle.length > 80) {
        log(`Warning: Candidate title exceeds 80 chars, truncating.`);
        finalTitle = finalTitle.substring(0, 80);
      }
      log(
        `Using candidate title (compliance check passed or failed): "${finalTitle}"`,
      );
    }
  } catch (error) {
    log(`Error during metadata/title processing for ${link}: ${error.message}`);
    log(error.stack); // Log stack trace for debugging
    return false; // Stop processing this link if metadata fails
  }

  // Ensure we have a final title before proceeding (redundant due to earlier check, but safe)
  if (!finalTitle) {
    log(`Could not determine a final title for ${link}, skipping submission.`);
    return false;
  }

  // *** Firewall/Block Check ***
  if (finalTitle === "Access Denied" || finalTitle === "Just a moment...") {
    log(
      `Firewall/block detected for link ${link} (Title: "${finalTitle}"). Aborting submission.`,
    );
    return false;
  }
  // *** End Firewall/Block Check ***

  // Step 4: Prepare and sign the message
  const message = messageFab(finalTitle, link); // Use the FINAL link here

  let signature = "0xSIMULATION_NO_SIGNATURE"; // Default for simulation without key
  let body; // To store the final JSON payload string

  // --- Simulation Mode Check ---
  if (SIMULATION_MODE) {
    log(`[SIMULATION MODE] Preparing payload for link: ${link}`);
    // Only try to sign if a signer exists (i.e., key was provided)
    if (signer) {
      try {
        const domainToSign = { ...EIP712_DOMAIN };
        signature = await signer._signTypedData(
          domainToSign,
          EIP712_TYPES,
          message, // Use the message with the final title and final link
        );
        log(`[SIMULATION MODE] Signed message for ${link}`);
      } catch (error) {
        log(
          `[SIMULATION MODE] Error signing message for ${link}: ${error.message}`,
        );
        signature = "0xSIMULATION_SIGNING_ERROR";
      }
    } else {
      log(`[SIMULATION MODE] Skipping signature (no private key provided).`);
    }
    // Construct the final payload JSON object
    const payload = { ...message, signature };
    // Stringify it for the log
    body = JSON.stringify(payload);
    // Log the final payload
    log(`[SIMULATION MODE] Final JSON Payload (would be sent): ${body}`);
    // Simulate success and mark as submitted in cache to avoid reprocessing
    lifetimeCache.set(cacheKey, true);
    return true;
  }
  // --- End Simulation Mode Check ---

  // --- Production Mode Logic ---
  // If we are here, it's NOT simulation mode, so signer MUST exist
  if (!signer) {
    log(
      `Error submitting link ${link}: Signer is required in production mode.`,
    );
    return false; // Should have been caught earlier, but double-check
  }

  try {
    // Sign the message with the final title and final link
    const domainToSign = { ...EIP712_DOMAIN };
    signature = await signer._signTypedData(
      domainToSign,
      EIP712_TYPES,
      message,
    );
    log(`Signed message for ${link}`);
  } catch (error) {
    log(`Error signing message for ${link}: ${error.message}`);
    return false;
  }

  // Prepare the final request body
  body = JSON.stringify({
    ...message,
    signature,
  });

  const url = `${BACKEND_API_URL}/api/v1/messages?wait=true`; // Wait for processing

  try {
    log(`Sending submission to backend: ${url}`);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
      },
      body,
      timeout: 30000, // 30 second timeout for backend processing
      // *** Use the insecure agent for localhost HTTPS ***
      agent: insecureAgent,
    });

    // Check if response is JSON before parsing
    const contentType = response.headers.get("content-type");
    let result;
    if (contentType && contentType.includes("application/json")) {
      result = await response.json();
    } else {
      // Handle non-JSON responses (e.g., Cloudflare errors, plain text)
      const text = await response.text();
      log(
        `Backend submission failed for ${link}: ${response.status} - Non-JSON response: ${text}`,
      );
      return false;
    }

    if (response.ok && result.status === "success") {
      log(
        `Successfully submitted link: ${link} (Index: ${result?.data?.index})`,
      );
      lifetimeCache.set(cacheKey, true); // Mark as submitted
      return true;
    } else if (
      result.details &&
      result.details.includes("Message with marker")
    ) {
      log(`Link already submitted (API response): ${link}`);
      lifetimeCache.set(cacheKey, true); // Mark as submitted based on API feedback
      return true;
    } else {
      log(
        `Backend submission failed for ${link}: ${
          response.status
        } - ${JSON.stringify(result)}`,
      );
      return false;
    }
  } catch (error) {
    log(`Error sending submission to backend for ${link}: ${error.message}`);
    return false;
  }
}

// --- Main Function ---
export async function runTelegramBot() {
  log("Starting Telegram bot run...");

  // --- Target Channel Check ---
  if (PROCESS_INDEX === undefined || PROCESS_INDEX === null) {
    log("Error: PROCESS_INDEX environment variable not set.");
    return;
  }
  if (!TARGET_CHANNEL) {
    log(
      `Error: Target channel environment variable ${TARGET_CHANNEL_ENV_VAR} not set for index ${PROCESS_INDEX}.`,
    );
    return;
  }
  log(`Process Index: ${PROCESS_INDEX}, Targeting channel: ${TARGET_CHANNEL}`);
  // --- End Target Channel Check ---

  // --- Time Check REMOVED ---

  if (SIMULATION_MODE) {
    log(
      "[SIMULATION MODE] Running in simulation mode. No submissions will be sent.",
    );
  }

  // --- Environment Variable Checks ---
  // ANTHROPIC_API_KEY is always required for relevance check
  if (!env.ANTHROPIC_API_KEY) {
    log("Error: ANTHROPIC_API_KEY environment variable not set.");
    return;
  }
  // BOT_PRIVATE_KEY is only required if NOT in simulation mode
  if (!SIMULATION_MODE && !BOT_PRIVATE_KEY) {
    log(
      "Error: TELEGRAM_BOT_PRIVATE_KEY environment variable not set (required for production mode).",
    );
    return;
  }
  // --- End Environment Variable Checks ---

  const signer = getSigner(BOT_PRIVATE_KEY);
  // In production mode, signer must be valid
  if (!SIMULATION_MODE && !signer) {
    log("Exiting: Failed to create signer in production mode.");
    return; // Error logged in getSigner
  }
  if (signer) {
    log(`Signer created for address: ${signer.address}`);
  } else if (SIMULATION_MODE) {
    log(`Running simulation without a signer.`);
  }

  let totalSubmittedCount = 0;
  // Calculate the cutoff time for filtering posts
  const nowSeconds = Math.floor(Date.now() / 1000);
  const cutoffTimestamp = nowSeconds - MAX_POST_AGE_MINUTES * 60;
  log(
    `Processing posts newer than timestamp: ${cutoffTimestamp} (${MAX_POST_AGE_MINUTES} minutes ago)`,
  );

  // Process only the target channel
  const channel = TARGET_CHANNEL;
  log(`Processing channel: ${channel}`);
  const posts = await fetchTelegramPosts(channel, FETCH_LIMIT);

  if (!posts || posts.length === 0) {
    log(`No posts fetched or processed for channel ${channel}.`);
    // Don't exit here, just log completion below
  } else {
    log(`Fetched ${posts.length} posts from Telegram for channel ${channel}.`);

    let submittedCountPerChannel = 0;
    const processedLinks = new Set(); // Still useful to avoid reprocessing across runs if cache fails

    // Process posts chronologically (oldest first) to mimic reading order
    for (const post of posts.reverse()) {
      // --- Time Filter ---
      if (post.date < cutoffTimestamp) {
        // Since posts are reversed (oldest first), we should *continue*
        // checking newer posts in the batch even if this one is too old.
        log(
          `Post ${post.id || "N/A"} from ${new Date(
            post.date * 1000,
          ).toISOString()} is older than cutoff, skipping.`,
        );
        continue; // Skip this post and check the next (newer) one
      }
      // --- End Time Filter ---

      // Check overall submission limit before processing the post
      if (submittedCountPerChannel >= SUBMIT_LIMIT) {
        log(
          `Submission limit (${SUBMIT_LIMIT}) reached for channel ${channel}.`,
        );
        break; // Stop processing more posts if limit reached
      }

      const links = extractLinksFromPost(post);

      // --- Process Only the First Link ---
      if (links.length > 0) {
        const originalLink = links[0]; // Take only the first link
        log(
          `Processing first extracted link from post ${
            post.id || "N/A"
          }: ${originalLink}`,
        );

        let currentLink = originalLink; // Use this for processing, may be updated

        // --- Leviathan Redirect Handling (Applied to the first link) ---
        if (originalLink.startsWith("https://leviathannews.xyz/redirect/")) {
          log(
            `Leviathan redirect detected: ${originalLink}. Attempting to resolve HTTP redirect...`,
          );
          try {
            const response = await fetch(originalLink, {
              method: "HEAD", // Use HEAD to avoid downloading body
              redirect: "follow", // Tell fetch to handle HTTP redirects
              headers: { "User-Agent": USER_AGENT },
              timeout: REDIRECT_TIMEOUT_MS,
            });

            if (response.ok && response.url !== originalLink) {
              currentLink = response.url; // Update currentLink to the intermediate URL
              log(
                `Resolved Leviathan HTTP redirect: ${originalLink} -> ${currentLink}`,
              );

              // --- Leviathan Meta-Refresh Handling (Nested) ---
              if (
                currentLink.startsWith(
                  "https://api.leviathannews.xyz/redirect/",
                )
              ) {
                log(
                  `Attempting to resolve meta-refresh for intermediate link: ${currentLink}`,
                );
                try {
                  // Fetch the HTML content of the intermediate page
                  const htmlResponse = await fetch(currentLink, {
                    headers: { "User-Agent": USER_AGENT },
                    timeout: HTML_FETCH_TIMEOUT_MS, // Use specific timeout
                  });
                  if (!htmlResponse.ok) {
                    throw new Error(
                      `HTTP error ${htmlResponse.status} fetching HTML`,
                    );
                  }
                  const htmlContent = await htmlResponse.text();

                  // Parse HTML for meta-refresh tag using regex
                  // Regex: <meta http-equiv="refresh" content="0;url=URL_HERE"> (case-insensitive, handles quotes/spacing)
                  const metaRefreshRegex =
                    /<meta\s+http-equiv\s*=\s*["']?refresh["']?\s+content\s*=\s*["']?\d+\s*;\s*url=([^"'>\s]+)["']?\s*\/?>/i;
                  const match = htmlContent.match(metaRefreshRegex);

                  if (match && match[1]) {
                    // Extract, decode HTML entities (like &amp;), and trim
                    const finalUrl = decode(match[1].trim());
                    // Basic validation of the extracted URL
                    if (
                      finalUrl.startsWith("http://") ||
                      finalUrl.startsWith("https://")
                    ) {
                      log(
                        `Resolved meta-refresh redirect: ${currentLink} -> ${finalUrl}`,
                      );
                      currentLink = finalUrl; // Update to the FINAL URL
                    } else {
                      log(
                        `Warning: Invalid meta-refresh URL extracted: "${finalUrl}". Using intermediate link: ${currentLink}`,
                      );
                    }
                  } else {
                    log(
                      `No valid meta-refresh tag found on ${currentLink}. Using intermediate link.`,
                    );
                  }
                } catch (error) {
                  log(
                    `Error resolving meta-refresh for ${currentLink}: ${error.message}. Using intermediate link.`,
                  );
                  // Do not 'continue', proceed with the intermediate link (currentLink)
                }
              }
              // --- End Leviathan Meta-Refresh Handling ---
            } else if (response.url === originalLink) {
              log(
                `Warning: Leviathan HTTP redirect resolution for ${originalLink} resulted in the same URL. Skipping post's link.`,
              );
              continue; // Skip processing this post's link
            } else {
              log(
                `Warning: Failed to resolve Leviathan HTTP redirect for ${originalLink}. Status: ${response.status}. Skipping post's link.`,
              );
              continue; // Skip processing this post's link
            }
          } catch (error) {
            log(
              `Error resolving Leviathan HTTP redirect for ${originalLink}: ${error.message}. Skipping post's link.`,
            );
            continue; // Skip processing this post's link
          }
        }
        // --- End Leviathan Redirect Handling ---

        // Use currentLink (original or resolved via HTTP and potentially meta-refresh) for subsequent checks
        if (processedLinks.has(currentLink)) {
          log(`Skipping already processed link in this run: ${currentLink}`);
          continue; // Skip this post if its link was already processed in this run
        }

        processedLinks.add(currentLink); // Add the link we are actually processing

        // Use the new relevance check function, passing Telegram metadata if available
        const telegramWebpage = post?.media?.webpage;
        let isRelevant = false;
        try {
          // *** Prepare context object for isRelevantToKiwiNews ***
          const relevanceContext = {
            title: telegramWebpage?.title,
            description: telegramWebpage?.description,
          };
          // Pass the potentially FINAL resolved currentLink and the context object
          isRelevant = await isRelevantToKiwiNews(
            currentLink,
            relevanceContext,
          );
          // Log moved inside isRelevantToKiwiNews for clarity
        } catch (error) {
          log(`Error during relevance check for ${currentLink}: ${error}`);
          // Keep isRelevant = false
        }

        if (isRelevant) {
          log(
            `Link IS relevant, proceeding to submit/simulate: ${currentLink}`,
          ); // Clear confirmation
          // Pass signer (which might be null in simulation) and the potentially FINAL resolved currentLink
          const success = await submitLink(currentLink, signer);
          if (success) {
            submittedCountPerChannel++; // Increment count for the channel
            totalSubmittedCount++;
          }
          // Add a small delay to avoid overwhelming the backend or hitting rate limits
          // Consider adding a small delay even between checks to be nicer to Claude API
          await new Promise((resolve) => setTimeout(resolve, 500));
        } else {
          // Logged inside isRelevantToKiwiNews or if error occurred
          log(`Link is NOT relevant, skipping: ${currentLink}`); // Clear confirmation
        }
      } else {
        // Log if no links were extracted from a post that passed the time filter
        log(`No links extracted from post ${post.id || "N/A"}.`);
      }
      // --- End Process Only the First Link ---
    } // End loop through posts
    log(
      `Finished processing channel ${channel}. Submitted ${submittedCountPerChannel} new links.`,
    );
  } // End of else block for processing posts

  log(
    `Telegram bot run finished for channel ${channel}. Submitted ${totalSubmittedCount} new links in total.`,
  );
}

// --- Execution ---
// Allows running the bot directly using `node src/telegram_bot.mjs`
// Assumes the script is run from the project root where node_modules is accessible
// and environment variables are set.
if (
  import.meta.url.startsWith("file:") &&
  process.argv[1] === new URL(import.meta.url).pathname
) {
  runTelegramBot().catch((err) => {
    log(`Unhandled error in Telegram bot: ${err.stack || err}`);
    process.exit(1); // Exit with error code
  });
}
