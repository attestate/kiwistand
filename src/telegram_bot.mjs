import { Wallet } from "@ethersproject/wallet";
import { keccak256 } from "ethereum-cryptography/keccak.js";
import { toHex } from "ethereum-cryptography/utils.js";
import { encode } from "cbor-x";
import canonicalize from "canonicalize";
import { env } from "process";
import fetch from "node-fetch"; // Ensure node-fetch is installed or use native fetch
import { decode } from 'html-entities'; // Import html-entities library
import https from 'https'; // <-- Import https module

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
const MAX_POST_AGE_MINUTES = 18; // Only process posts newer than this

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

// *** REMOVED isWithinAllowedTime function ***

/**
 * Fetches latest posts from the specified Telegram channel.
 * @param {string} channel - The Telegram channel name.
 * @param {number} limit - Maximum number of posts to fetch.
 * @returns {Promise<Array<object>>} - A promise resolving to an array of post objects.
 */
async function fetchTelegramPosts(channel, limit) {
  const url = `${TELEGRAM_API_BASE}/json/${channel}?limit=${limit}`;
  log(`Fetching Telegram posts for [${channel}] from: ${url}`);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      timeout: 15000, // 15 second timeout
    });
    if (!response.ok) {
        const errorBody = await response.text();
        // Check for specific flood wait error
        if (response.status === 420 && errorBody.includes("FLOOD_WAIT")) {
            log(`Rate limit hit for channel ${channel}: ${errorBody}. Skipping this run.`);
            // Return empty array to gracefully handle rate limit
            return [];
        }
        throw new Error(`HTTP error ${response.status}: ${errorBody}`);
    }
    const data = await response.json();
    // The API wraps the posts in a 'messages' array
    return data?.messages || [];
  } catch (error) {
    log(`Error fetching Telegram posts for ${channel}: ${error.message}`);
    return [];
  }
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
          cleanedLink = cleanedLink.replace(/[.,!?)\]}"'>]+$/, '');

          // Basic validation and hostname check
          if (cleanedLink.startsWith('http://') || cleanedLink.startsWith('https://')) {
              const urlObject = new URL(cleanedLink);

              // *** WORKAROUND: Convert vxtwitter.com to fxtwitter.com ***
              if (urlObject.hostname === 'vxtwitter.com') {
                  log(`Converting vxtwitter link: ${cleanedLink}`);
                  urlObject.hostname = 'fxtwitter.com';
                  cleanedLink = urlObject.toString();
                  log(`Converted to fxtwitter link: ${cleanedLink}`);
              }
              // *** END WORKAROUND ***

              links.add(cleanedLink);
          }
      } catch (error) {
          log(`Skipping invalid extracted link fragment "${link}": ${error.message}`);
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
      if (entity.type === 'url') {
          // Extract the URL text from the message using offset and length
          const urlText = post.message.substring(entity.offset, entity.offset + entity.length);
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
 * @param {string} link - The URL to submit.
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
    // Pass the potentially transformed link (e.g., fxtwitter) to metadata
    initialMeta = await metadata(link, true);
    log(`Initial metadata result for ${link}:`, initialMeta);

    // Step 2: Determine the candidate title - *** CRITICAL CHECK ***
    titleCandidate = initialMeta?.ogTitle; // Use generated/OG title if available

    // *** If no title could be generated or found from OG tags, ABORT ***
    if (!titleCandidate) {
      log(`No usable title found/generated for ${link}. Skipping submission.`);
      return false; // Do not proceed without a title
    }
    log(`Using initial title as candidate: "${titleCandidate}"`);

    // Step 3: Check compliance and get final title
    log(`Checking compliance for candidate title: "${titleCandidate}"`);
    // Call metadata again, passing the candidate title to trigger fixTitle logic
    const complianceMeta = await metadata(link, false, titleCandidate);
    log(`Compliance metadata result for ${link}:`, complianceMeta);

    finalTitle = complianceMeta?.compliantTitle; // Use compliant title if fixTitle provided one

    if (finalTitle) {
        log(`Using compliant title: "${finalTitle}"`);
    } else {
        // If no compliant title, use the candidate title and truncate if needed
        finalTitle = titleCandidate;
        if (finalTitle.length > 80) {
            log(`Warning: Candidate title exceeds 80 chars, truncating.`);
            finalTitle = finalTitle.substring(0, 80);
        }
        log(`Using candidate title (compliance check passed or failed): "${finalTitle}"`);
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

  // Step 4: Prepare and sign the message
  const message = messageFab(finalTitle, link);

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
              message, // Use the message with the final title
            );
            log(`[SIMULATION MODE] Signed message for ${link}`);
        } catch (error) {
            log(`[SIMULATION MODE] Error signing message for ${link}: ${error.message}`);
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
      log(`Error submitting link ${link}: Signer is required in production mode.`);
      return false; // Should have been caught earlier, but double-check
  }

  try {
    // Sign the message with the final title
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
      log(`Error: Target channel environment variable ${TARGET_CHANNEL_ENV_VAR} not set for index ${PROCESS_INDEX}.`);
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
    log("Error: TELEGRAM_BOT_PRIVATE_KEY environment variable not set (required for production mode).");
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
  const cutoffTimestamp = nowSeconds - (MAX_POST_AGE_MINUTES * 60);
  log(`Processing posts newer than timestamp: ${cutoffTimestamp} (${MAX_POST_AGE_MINUTES} minutes ago)`);

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
      const processedLinks = new Set(); // Avoid processing same link multiple times within one run

      // Process posts chronologically (oldest first) to mimic reading order
      for (const post of posts.reverse()) {

        // --- Time Filter ---
        if (post.date < cutoffTimestamp) {
            // Since posts are reversed (oldest first), we should *continue*
            // checking newer posts in the batch even if this one is too old.
            log(`Post ${post.id || 'N/A'} from ${new Date(post.date * 1000).toISOString()} is older than cutoff, skipping.`);
            continue; // Skip this post and check the next (newer) one
        }
        // --- End Time Filter ---


        if (submittedCountPerChannel >= SUBMIT_LIMIT) {
          log(
            `Submission limit (${SUBMIT_LIMIT}) reached for channel ${channel}.`,
          );
          break; // Stop processing if limit reached for this channel
        }

        const links = extractLinksFromPost(post);
        // Only log if links were actually found
        if (links.length > 0) {
            log(
              `Extracted links from post ${
                post.id || "N/A"
              } in ${channel}: ${JSON.stringify(links)}`,
            );
        }


        for (const link of links) {
          if (submittedCountPerChannel >= SUBMIT_LIMIT) break;
          if (processedLinks.has(link)) continue; // Skip if already processed in this run

          processedLinks.add(link);

          // Use the new relevance check function, passing Telegram metadata if available
          const telegramWebpage = post?.media?.webpage;
          let isRelevant = false;
          try {
              // Pass the cleaned link to the relevance checker
              isRelevant = await isRelevantToKiwiNews(link, telegramWebpage);
              // Log moved inside isRelevantToKiwiNews for clarity
          } catch (error) {
              log(`Error during relevance check for ${link}: ${error}`);
              // Keep isRelevant = false
          }

          if (isRelevant) {
            log(`Link IS relevant, proceeding to submit/simulate: ${link}`); // Clear confirmation
            // Pass signer (which might be null in simulation)
            const success = await submitLink(link, signer);
            if (success) {
              submittedCountPerChannel++;
              totalSubmittedCount++;
            }
            // Add a small delay to avoid overwhelming the backend or hitting rate limits
            // Consider adding a small delay even between checks to be nicer to Claude API
            await new Promise((resolve) => setTimeout(resolve, 500));
          } else {
            // Logged inside isRelevantToKiwiNews or if error occurred
            log(`Link is NOT relevant, skipping: ${link}`); // Clear confirmation
          }
        }
      }
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
