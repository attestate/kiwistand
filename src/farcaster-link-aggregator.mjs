//@format
import { env } from "process";
import fetch from "node-fetch"; // Use built-in fetch if on Node v18+
import { Wallet } from "@ethersproject/wallet";
import https from "https"; // For insecure agent
import { decode } from "html-entities"; // For cleaning links

// Import necessary functions from parser and cache
// metadata is now needed earlier for relevance check
import { metadata, isRelevantToKiwiNews } from "./parser.mjs";
import { lifetimeCache } from "./cache.mjs";
import log from "./logger.mjs"; // Added logger for consistency

// --- Configuration ---
// Farcaster specific
const TARGET_FIDS = [
  188665, 7258, 7237, 557, 1287, 617, 1890, 880, 3, 7479, 3621, 4407, 680, 5650,
  143, 347, 5694, 308433, 380643,
];
const FEED_SERVICE_BASE_URL = "https://feeds.fcstr.xyz";

// Common Bot Configuration (mirrors telegram_bot.mjs where applicable)
// *** Use the same private key env var as the Telegram bot ***
const BOT_PRIVATE_KEY = env.TELEGRAM_BOT_PRIVATE_KEY;
const SIMULATION_MODE = env.SIMULATION_MODE === "true"; // Check for simulation mode
const SUBMIT_LIMIT = 5; // Max links to submit per run
const MAX_POST_AGE_MINUTES = 40; // Process casts newer than this (e.g., 30 minutes)
const MAX_POST_AGE_MILLISECONDS = MAX_POST_AGE_MINUTES * 60 * 1000;
const BACKEND_API_URL = "https://localhost:8443"; // Connect to local backend
const USER_AGENT = "KiwiNewsFarcasterBot/1.0"; // Custom user agent
const RETRY_DELAY_MS = 500; // Small delay between processing links

// Regex to find URLs in text
const URL_REGEX = /https?:\/\/[^\s/$.?#].[^\s]*/gi;

// --- Create insecure HTTPS agent (for localhost backend) ---
const insecureAgent = new https.Agent({
  rejectUnauthorized: false,
});
// ---

// --- EIP-712 Definitions (Copied from src/telegram_bot.mjs) ---
const EIP712_DOMAIN = {
  name: "kiwinews",
  version: "1.0.0",
  salt: "0xfe7a9d68e99b6942bb3a36178b251da8bd061c20ed1e795207ae97183b590e5b",
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
// --- End EIP-712 ---

// --- Helper Functions (Adapted from src/telegram_bot.mjs) ---

/**
 * Creates an Ethers Wallet instance from a private key.
 * Returns null if the key is invalid or missing (in simulation mode).
 */
function getSigner(privateKey) {
  if (!privateKey) {
    if (!SIMULATION_MODE) {
      // *** Updated error message ***
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
 * Uses src/parser.mjs for title generation/compliance and relevance check.
 * Assumes relevance check and initial metadata fetch happened *before* calling this.
 * @param {string} link - The URL to submit.
 * @param {Wallet | null} signer - The Ethers Wallet instance for signing, or null if in simulation without key.
 * @param {object} initialMeta - The metadata object fetched *before* the relevance check.
 * @returns {Promise<boolean>} - True if submission was successful/simulated or already submitted.
 */
async function submitLink(link, signer, initialMeta) {
  // Added initialMeta parameter
  const cacheKey = `submitted-farcaster-link-${link}`; // Use a distinct prefix
  if (lifetimeCache.get(cacheKey)) {
    log(`Link already submitted (cache hit): ${link}`);
    return true; // Treat as success if already processed
  }

  log(`Attempting to finalize and submit link: ${link}`);
  let titleCandidate;
  let finalTitle;

  try {
    // Step 1: Determine the candidate title from pre-fetched metadata
    titleCandidate = initialMeta?.ogTitle; // Use generated/OG title if available

    if (!titleCandidate) {
      // This check should ideally be redundant if relevance check passed, but good safety net
      log(
        `No usable title found in pre-fetched metadata for ${link}. Skipping submission.`,
      );
      return false;
    }
    log(`Using initial title as candidate: "${titleCandidate}"`);

    // Step 2: Check compliance and get final title
    log(`Checking compliance for candidate title: "${titleCandidate}"`);
    // Call metadata again, passing the candidate title to trigger fixTitle logic
    const complianceMeta = await metadata(link, false, titleCandidate);
    log(`Compliance metadata result for ${link}:`, complianceMeta);

    finalTitle = complianceMeta?.compliantTitle; // Use compliant title if fixTitle provided one

    if (finalTitle) {
      log(`Using compliant title: "${finalTitle}"`);
    } else {
      // Fallback to candidate title, truncate if needed
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
    // Error during compliance check specifically
    log(`Error during compliance check for ${link}: ${error.message}`);
    log(error.stack);
    return false;
  }

  if (!finalTitle) {
    log(`Could not determine a final title for ${link}, skipping submission.`);
    return false;
  }

  // Firewall/Block Check
  if (finalTitle === "Access Denied" || finalTitle === "Just a moment...") {
    log(
      `Firewall/block detected for link ${link} (Title: "${finalTitle}"). Aborting submission.`,
    );
    return false;
  }

  // Step 3: Prepare and sign the message
  const message = messageFab(finalTitle, link);

  let signature = "0xSIMULATION_NO_SIGNATURE";
  let body;

  // Simulation Mode Check
  if (SIMULATION_MODE) {
    log(`[SIMULATION MODE] Preparing payload for link: ${link}`);
    if (signer) {
      try {
        signature = await signer._signTypedData(
          EIP712_DOMAIN,
          EIP712_TYPES,
          message,
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
    const payload = { ...message, signature };
    body = JSON.stringify(payload);
    log(`[SIMULATION MODE] Final JSON Payload (would be sent): ${body}`);
    lifetimeCache.set(cacheKey, true); // Mark as submitted in cache
    return true;
  }

  // Production Mode Logic
  if (!signer) {
    log(
      `Error submitting link ${link}: Signer is required in production mode.`,
    );
    return false;
  }

  try {
    signature = await signer._signTypedData(
      EIP712_DOMAIN,
      EIP712_TYPES,
      message,
    );
    log(`Signed message for ${link}`);
  } catch (error) {
    log(`Error signing message for ${link}: ${error.message}`);
    return false;
  }

  body = JSON.stringify({ ...message, signature });
  const url = `${BACKEND_API_URL}/api/v1/messages?wait=true`;

  try {
    log(`Sending submission to backend: ${url}`);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
      },
      body,
      timeout: 30000,
      agent: insecureAgent, // Use insecure agent for localhost HTTPS
    });

    const contentType = response.headers.get("content-type");
    let result;
    if (contentType && contentType.includes("application/json")) {
      result = await response.json();
    } else {
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
      lifetimeCache.set(cacheKey, true); // Mark based on API feedback
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

// --- Farcaster Specific Functions ---

/**
 * Fetches the feed for a given FID and extracts the username.
 */
async function getUserFeedAndUsername(fid) {
  const url = `${FEED_SERVICE_BASE_URL}/json/user/${fid}`;
  try {
    log(`Fetching feed for FID ${fid} from ${url}`); // Changed to log
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    }); // Added User-Agent
    if (!response.ok) {
      if (response.status === 429) {
        log(`Rate limited fetching feed for FID ${fid}. Skipping.`); // Changed to log
        return null;
      }
      if (response.status === 404) {
        log(`Feed not found (404) for FID ${fid}. Skipping.`); // Changed to log
        return null;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const feedData = await response.json();
    const username = feedData?.authors?.[0]?.name || `fid:${fid}`;
    const feedItems = Array.isArray(feedData?.items) ? feedData.items : [];
    log(`Successfully fetched feed for ${username} (FID: ${fid})`); // Changed to log
    return { fid, username, feedItems };
  } catch (error) {
    log(`Error fetching feed for FID ${fid}: ${error.message}`); // Changed to log
    return null;
  }
}

/**
 * Extracts links from feed items within the configured time window.
 * Populates the linkCounts object with mention counts and users.
 * @param {Array<object>} feedItems - Array of cast objects from the feed.
 * @param {string} username - The username associated with the feed.
 * @param {object} linkCounts - The object to populate { url: { users: Set<string>, count: number } }.
 */
function extractLinksFromFeed(feedItems, username, linkCounts) {
  let linksFoundInWindow = 0;
  let castsProcessed = 0;
  let castsFilteredOutByDate = 0;
  const now = Date.now();
  // Use the shorter time window based on MAX_POST_AGE_MINUTES
  const cutoffTime = now - MAX_POST_AGE_MILLISECONDS;

  for (const cast of feedItems) {
    // Filter by date using the shorter time window
    if (!cast.date_modified) {
      continue;
    }
    try {
      const castDate = new Date(cast.date_modified).getTime();
      if (castDate < cutoffTime) {
        // Compare against the shorter cutoffTime
        castsFilteredOutByDate++;
        continue; // Skip if older than MAX_POST_AGE_MINUTES
      }
    } catch (dateError) {
      continue;
    }

    castsProcessed++;
    const text = cast?.content_html || cast?.summary || cast?.title;

    if (text) {
      const urls = text.match(URL_REGEX);
      if (urls) {
        for (const url of urls) {
          try {
            if (url.length > 2000) continue;

            // Decode HTML entities like &amp; -> &
            let cleanedLink = decode(url.trim());
            // Remove trailing punctuation
            cleanedLink = cleanedLink.replace(/[.,!?)\]}"'>]+$/, "");

            const parsedUrl = new URL(cleanedLink);
            const hostname = parsedUrl.hostname
              .toLowerCase()
              .replace(/^www\./, "");

            // Skip feed service's own links or common platform links
            if (hostname === "feeds.fcstr.xyz" || hostname === "warpcast.com") {
              continue;
            }

            // Normalize URL
            const normalizedUrl = `${
              parsedUrl.protocol
            }//${hostname}${parsedUrl.pathname.replace(/\/$/, "")}${
              parsedUrl.search
            }${parsedUrl.hash}`;

            // *** Store the link, increment count, and add user ***
            if (!linkCounts[normalizedUrl]) {
              // Initialize if first time seeing this link
              linkCounts[normalizedUrl] = { users: new Set(), count: 0 };
            }
            // Increment count and add user (Set handles duplicates)
            linkCounts[normalizedUrl].count++;
            linkCounts[normalizedUrl].users.add(username);
            linksFoundInWindow++;
          } catch (e) {
            // Ignore invalid URLs
          }
        }
      }
    }
  }
  if (feedItems.length > 0) {
    log(
      `Processed ${castsProcessed} casts (out of ${feedItems.length} total, ${castsFilteredOutByDate} filtered by date < ${MAX_POST_AGE_MINUTES} min ago) for ${username}, found ${linksFoundInWindow} link mentions in window.`,
    );
  } else {
    log(`No casts found or processed in the feed for ${username}.`);
  }
}

// --- Main Execution Logic ---
async function main() {
  log(`Starting Farcaster link aggregator run...`);
  log(`Processing casts newer than ${MAX_POST_AGE_MINUTES} minutes ago.`);
  if (SIMULATION_MODE) {
    log(
      "[SIMULATION MODE] Running in simulation mode. No submissions will be sent.",
    );
  }

  // Environment Variable Checks
  if (!env.ANTHROPIC_API_KEY) {
    log("Error: ANTHROPIC_API_KEY environment variable not set.");
    return;
  }
  // *** Updated error message ***
  if (!SIMULATION_MODE && !BOT_PRIVATE_KEY) {
    log(
      "Error: TELEGRAM_BOT_PRIVATE_KEY environment variable not set (required for production mode).",
    );
    return;
  }

  // *** Use the shared BOT_PRIVATE_KEY constant ***
  const signer = getSigner(BOT_PRIVATE_KEY);
  if (!SIMULATION_MODE && !signer) {
    log("Exiting: Failed to create signer in production mode.");
    return;
  }
  if (signer) {
    log(`Signer created for address: ${signer.address}`);
  } else if (SIMULATION_MODE) {
    log(`Running simulation without a signer.`);
  }

  log(
    `Processing feeds for ${
      TARGET_FIDS.length
    } specific FIDs: ${TARGET_FIDS.join(", ")}`,
  );

  // Fetch feeds and extract links within the time window
  // Stores { uniqueUrl: { users: Set<string>, count: number } }
  const linkCounts = {};

  const feedPromises = TARGET_FIDS.map((fid) => getUserFeedAndUsername(fid));
  const results = await Promise.allSettled(feedPromises);

  results.forEach((result) => {
    if (result.status === "fulfilled" && result.value) {
      const { username, feedItems } = result.value;
      if (feedItems.length > 0) {
        // Pass linkCounts to be populated
        extractLinksFromFeed(feedItems, username, linkCounts);
      }
    } else if (result.status === "rejected") {
      log(`Failed to process feed for one FID: ${result.reason}`);
    }
  });

  // *** Sort links by mention count (descending) ***
  const sortedLinks = Object.entries(linkCounts) // [ [url, {users, count}], ... ]
    .sort(([, dataA], [, dataB]) => dataB.count - dataA.count); // Sort by count descending

  log(
    `Found ${sortedLinks.length} unique links mentioned in the last ${MAX_POST_AGE_MINUTES} minutes across target FIDs. Processing top mentions first.`,
  );
  // Log top 10 mentions for debugging/visibility
  if (sortedLinks.length > 0) {
    log("Top mentions:");
    sortedLinks.slice(0, 10).forEach(([link, data]) => {
      log(
        `  - ${link} (Count: ${data.count}, Users: ${Array.from(
          data.users,
        ).join(", ")})`,
      );
    });
  }

  // Process unique links found: Check relevance and submit
  let totalSubmittedCount = 0;
  const processedLinksInRun = new Set(); // Track links processed *in this run*

  // *** Iterate through the SORTED links ***
  for (const [link, linkData] of sortedLinks) {
    // Destructure link and its data
    if (totalSubmittedCount >= SUBMIT_LIMIT) {
      log(`Submission limit (${SUBMIT_LIMIT}) reached for this run.`);
      break;
    }

    if (processedLinksInRun.has(link)) {
      // This check might be redundant now due to sorting unique links, but safe to keep
      continue;
    }
    processedLinksInRun.add(link);

    log(`Processing link: ${link} (Mention Count: ${linkData.count})`); // Log mention count

    // --- Fetch metadata *before* relevance check ---
    let linkMetadata = {};
    try {
      // Fetch metadata, potentially generating title if needed (e.g., for Warpcast/Twitter)
      linkMetadata = await metadata(link, true); // generateTitle=true
      log(`Fetched metadata for relevance check: ${link}`, linkMetadata);
    } catch (error) {
      log(
        `Error fetching metadata for relevance check ${link}: ${error.message}`,
      );
      // Continue without metadata context, relevance check will only use URL
    }
    // ---

    // Check relevance using parser.mjs function, passing fetched metadata
    let isRelevant = false;
    try {
      // Prepare context object for isRelevantToKiwiNews
      const relevanceContext = {
        title: linkMetadata?.ogTitle, // Use the potentially generated title
        description: linkMetadata?.ogDescription, // Use the full description
      };
      isRelevant = await isRelevantToKiwiNews(link, relevanceContext); // Pass context
    } catch (error) {
      log(`Error during relevance check for ${link}: ${error}`);
      // Keep isRelevant = false
    }

    if (isRelevant) {
      log(`Link IS relevant, proceeding to submit/simulate: ${link}`);
      // Pass the already fetched metadata to submitLink to avoid fetching again
      const success = await submitLink(link, signer, linkMetadata);
      if (success) {
        totalSubmittedCount++;
      }
      // Add delay even if submission failed, to pace checks/attempts
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    } else {
      log(`Link is NOT relevant, skipping: ${link}`);
      // Optional: Add a smaller delay even for non-relevant checks if needed
      // await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  log(
    `Farcaster link aggregator run finished. Submitted ${totalSubmittedCount} new relevant links.`,
  );
}

// --- Standard Execution Block ---
if (
  import.meta.url.startsWith("file:") &&
  process.argv[1] === new URL(import.meta.url).pathname
) {
  main().catch((error) => {
    log(`\nUnhandled error occurred: ${error.stack || error}`);
    process.exit(1);
  });
}
