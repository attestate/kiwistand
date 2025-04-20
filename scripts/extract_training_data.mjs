import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createObjectCsvWriter } from "csv-writer";
import { getUnixTime, getDay, getHours } from "date-fns";

// Assuming these paths are correct relative to the script's location
import {
  listNewest,
  getSubmission,
  initialize,
  initializeLtCache,
  initializeNotifications,
  initializeReactions,
  initializeImpressions,
} from "../src/cache.mjs";
import { resolve as resolveKarma } from "../src/karma.mjs";
import log from "../src/logger.mjs";
import { extractDomain } from "../src/views/components/row.mjs"; // Reuse domain extraction

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuration ---
const OUTPUT_CSV_PATH = path.join(__dirname, "training_data.csv");
// Define a maturity window (e.g., 7 days) - only include submissions older than this
const MATURITY_WINDOW_SECONDS = 7 * 24 * 60 * 60;
// --- End Configuration ---

async function extractData() {
  log("Initializing database tables if they don't exist...");
  // Ensure all necessary tables are potentially created before querying
  // In a real scenario, the main app usually handles initialization.
  // Adding these here for script robustness if run standalone.
  try {
    initializeLtCache();
    initializeNotifications();
    initializeReactions();
    initializeImpressions();
    // `initialize` potentially handles submissions, upvotes, comments etc.
    // We might need to pass mock messages or ensure it runs safely if empty.
    // For now, assuming tables exist or `initialize` handles it gracefully.
    // initialize([]); // Pass empty messages if needed by the function signature
  } catch (initError) {
    log(`Warning: Initialization step failed: ${initError.message}`);
    // Decide if we should proceed or exit
  }

  log("Fetching all submissions...");
  // Fetch all submissions. listNewest(-1) should return all items without limit.
  // We might need a dedicated function in cache.mjs for efficiency if this is slow.
  let allSubmissionsMetadata = [];
  try {
    // Fetch basic metadata first
    allSubmissionsMetadata = listNewest(-1); // Use -1 for potentially unlimited
    log(`Fetched basic metadata for ${allSubmissionsMetadata.length} submissions.`);
  } catch (e) {
    log(`Error fetching submissions list: ${e.message}`);
    return;
  }

  if (allSubmissionsMetadata.length === 0) {
    log("No submissions found. Exiting.");
    return;
  }

  log(`Processing submissions and writing to ${OUTPUT_CSV_PATH}...`);

  const csvWriter = createObjectCsvWriter({
    path: OUTPUT_CSV_PATH,
    header: [
      { id: "submission_id", title: "SubmissionID" }, // e.g., kiwi:0x...
      { id: "title", title: "Title" },
      { id: "href", title: "Href" },
      { id: "domain", title: "Domain" },
      { id: "submitter_identity", title: "SubmitterIdentity" },
      { id: "submitter_karma", title: "SubmitterKarma" }, // Current karma
      { id: "submission_timestamp", title: "SubmissionTimestamp" },
      { id: "submission_hour", title: "SubmissionHourUTC" },
      { id: "submission_day", title: "SubmissionDayOfWeek" }, // 0 (Sun) - 6 (Sat)
      { id: "title_length", title: "TitleLength" },
      { id: "final_upvotes", title: "FinalUpvotes" }, // Target variable
      { id: "final_comments", title: "FinalComments" }, // Target variable
    ],
  });

  const records = [];
  const nowTimestamp = getUnixTime(new Date());
  let processedCount = 0;
  let skippedImmature = 0;

  // Process submissions one by one to get full details
  for (const meta of allSubmissionsMetadata) {
    processedCount++;
    if (processedCount % 100 === 0) {
      log(`Processed ${processedCount}/${allSubmissionsMetadata.length}...`);
    }

    // Skip submissions that are too recent (within the maturity window)
    if (nowTimestamp - meta.timestamp < MATURITY_WINDOW_SECONDS) {
      skippedImmature++;
      continue;
    }

    try {
      // Fetch full submission details including comments and upvotes
      // Pass hex index directly as confirmed from cache.mjs review
      const fullSubmission = getSubmission(`0x${meta.index}`);

      if (!fullSubmission) {
        log(`Warning: Could not retrieve full details for index 0x${meta.index}`);
        continue;
      }

      const submitterKarma = resolveKarma(fullSubmission.identity); // Get current karma
      const submissionDate = new Date(fullSubmission.timestamp * 1000);
      const domain = extractDomain(fullSubmission.href);

      records.push({
        // Use the index from the retrieved fullSubmission object for consistency
        submission_id: `kiwi:0x${fullSubmission.index}`,
        title: fullSubmission.title,
        href: fullSubmission.href,
        domain: domain,
        submitter_identity: fullSubmission.identity,
        submitter_karma: submitterKarma,
        submission_timestamp: fullSubmission.timestamp,
        submission_hour: getHours(submissionDate), // In UTC if server is UTC
        submission_day: getDay(submissionDate), // 0 = Sunday, 6 = Saturday
        title_length: fullSubmission.title?.length || 0,
        final_upvotes: fullSubmission.upvotes || 0, // Assuming getSubmission returns total upvotes
        final_comments: fullSubmission.comments?.length || 0, // Assuming getSubmission returns comments array
      });
    } catch (e) {
      log(
        `Error processing submission index 0x${meta.index}: ${e.message} - Skipping.`,
      );
      // Optionally log stack trace: console.error(e.stack);
    }
  }

  try {
    await csvWriter.writeRecords(records);
    log(`Successfully wrote ${records.length} records to ${OUTPUT_CSV_PATH}.`);
    log(`Skipped ${skippedImmature} submissions due to being too recent.`);
  } catch (e) {
    log(`Error writing CSV file: ${e.message}`);
  }
}

extractData().catch((e) => {
  log(`Unhandled error during data extraction: ${e.message}`);
  console.error(e.stack);
});
