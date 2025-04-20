import { env } from "process";
import fs from "fs"; // Import file system module
import Anthropic from "@anthropic-ai/sdk";
import path from "path";
import { fileURLToPath } from "url";

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Use absolute paths for imports
import { getSubmissionsForPrediction } from "../src/cache.mjs";
import log from "../src/logger.mjs";

// Set required environment variables if not already set
if (!env.CACHE_DIR) {
  log("Warning: CACHE_DIR environment variable not set. Using default.");
}

// Diagnostic function to check module imports
function checkModuleImports() {
  try {
    if (typeof getSubmissionsForPrediction !== 'function') {
      console.error("Error: getSubmissionsForPrediction is not a function");
      return false;
    }
    if (typeof log !== 'function') {
      console.error("Error: log function not properly imported");
      return false;
    }
    return true;
  } catch (error) {
    console.error(`Module import check failed: ${error.message}`);
    return false;
  }
}

// Run import check
if (!checkModuleImports()) {
  console.error("Critical error: Module imports failed. Check path resolution.");
  process.exit(1);
}

// --- Configuration ---
const START_DATE = new Date("2024-06-01T00:00:00Z"); // Changed start date
const NUM_EXAMPLES_PER_RUN = 3000; // Increased context size
const NUM_RUNS = 100; // Total number of tests desired
const CONCURRENT_LIMIT = 2; // Max parallel API calls (Keep low for larger prompts)
const ANTHROPIC_MODEL = "claude-3-5-haiku-20241022";
// --- End Configuration ---

const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});

function formatPrompt(examples, target) {
  let promptContent =
    "Predict the engagement (upvotes, comments) for the final entry based on the historical data provided.\n\nHistorical Data:\n";
  examples.forEach((ex) => {
    promptContent += `- Title: ${ex.title}\n  URL: ${ex.href}\n  Upvotes: ${ex.upvotesCount}, Comments: ${ex.commentsCount}\n`;
  });
  promptContent += `\nTarget Entry:\n- Title: ${target.title}\n  URL: ${target.href}\n  Upvotes: ?, Comments: ?`;
  console.log(promptContent);
  return promptContent;
}

async function predictEngagement(prompt) {
  try {
    const response = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 100,
      temperature: 0.2, // Lower temperature for more deterministic output
      messages: [{ role: "user", content: prompt }],
      tools: [
        {
          name: "predict_engagement_values",
          description:
            "Predict the number of upvotes and comments for a given submission.",
          input_schema: {
            type: "object",
            properties: {
              predicted_upvotes: {
                type: "integer",
                description: "The predicted number of upvotes.",
              },
              predicted_comments: {
                type: "integer",
                description: "The predicted number of comments.",
              },
            },
            required: ["predicted_upvotes", "predicted_comments"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "predict_engagement_values" },
    });

    const toolUse = response.content.find((c) => c.type === "tool_use");
    if (toolUse?.input) {
      return {
        upvotes: toolUse.input.predicted_upvotes,
        comments: toolUse.input.predicted_comments,
      };
    } else {
      log("Warning: LLM did not use the tool. Response:", response.content);
      // Attempt basic parsing as fallback (less reliable)
      const textContent =
        response.content.find((c) => c.type === "text")?.text || "";
      const upvotesMatch = textContent.match(/Upvotes: (\d+)/);
      const commentsMatch = textContent.match(/Comments: (\d+)/);
      if (upvotesMatch && commentsMatch) {
        return {
          upvotes: parseInt(upvotesMatch[1], 10),
          comments: parseInt(commentsMatch[1], 10),
        };
      }
      return null; // Indicate failure
    }
  } catch (error) {
    log(`Error calling Anthropic API: ${error}`);
    return null; // Indicate failure
  }
}

function calculateMAE(errors) {
  if (errors.length === 0) return 0;
  const sum = errors.reduce((acc, val) => acc + Math.abs(val), 0);
  return sum / errors.length;
}

async function runExperiment() {
  log("Starting engagement prediction experiment...");
  const startTimestamp = Math.floor(START_DATE.getTime() / 1000);
  log(
    `Fetching submissions since ${START_DATE.toISOString()} (Timestamp: ${startTimestamp})...`,
  );

  let allSubmissions = [];
  try {
    log(`Fetching submissions since timestamp ${startTimestamp}...`);
    if (typeof getSubmissionsForPrediction !== 'function') {
      throw new Error("getSubmissionsForPrediction is not available as a function");
    }
    allSubmissions = getSubmissionsForPrediction(startTimestamp);
    log(`Fetched ${allSubmissions.length} submissions.`);
  } catch (error) {
    console.error(`Error fetching submissions: ${error.message}`);
    console.error(`Stack trace: ${error.stack}`);
    log("Using empty submissions array as fallback.");
  }

  if (allSubmissions.length < NUM_EXAMPLES_PER_RUN + 1) {
    log(
      `Error: Not enough submissions (${
        allSubmissions.length
      }) found since ${START_DATE.toISOString()} to run the experiment (need at least ${
        NUM_EXAMPLES_PER_RUN + 1
      }).`,
    );
    return;
  }

  const allResults = []; // Store all individual results
  let successfulPredictions = 0;
  let runsInitiated = 0;
  let runsCompleted = 0;

  // Function to process a single prediction result (takes Promise.allSettled format)
  const processResult = (settledResult, target, runIndex) => {
    runsCompleted++;
    log(
      `--- Result Received for Run ${
        runIndex + 1
      } (${runsCompleted}/${NUM_RUNS}) ---`,
    );
    log(`Target: ${target.title} (${target.href})`);
    log(
      `Actual: Upvotes=${target.upvotesCount}, Comments=${target.commentsCount}`,
    );

    let runResultData = {
      runIndex: runIndex + 1, // Use the original index `i` passed in
      title: target.title,
      href: target.href,
      actualUpvotes: target.upvotesCount,
      predictedUpvotes: null,
      upvoteError: null,
      actualComments: target.commentsCount,
      predictedComments: null,
      commentError: null,
      success: false,
      reason: null,
    };

    if (settledResult.status === "fulfilled") {
      const prediction = settledResult.value;
      // Check if the prediction object and its properties are valid
      if (
        prediction &&
        prediction.upvotes !== undefined &&
        prediction.comments !== undefined
      ) {
        successfulPredictions++;
        runResultData.predictedUpvotes = prediction.upvotes;
        runResultData.predictedComments = prediction.comments;
        runResultData.upvoteError = prediction.upvotes - target.upvotesCount;
        runResultData.commentError = prediction.comments - target.commentsCount;
        runResultData.success = true;

        log(
          `Predicted: Upvotes=${prediction.upvotes}, Comments=${prediction.comments}`,
        );
        // Log errors immediately for per-run accuracy view
        log(
          `---> Accuracy: Upvote Error = ${runResultData.upvoteError}, Comment Error = ${runResultData.commentError}`,
        );
      } else {
        // Handle case where promise fulfilled but value is invalid/null
        runResultData.success = false;
        runResultData.reason =
          prediction === null
            ? "Prediction function returned null"
            : "Invalid prediction format received";
        log(`Prediction failed. Reason: ${runResultData.reason}`);
      }
    } else {
      // status === 'rejected'
      const reason = settledResult.reason;
      runResultData.success = false;
      runResultData.reason = reason
        ? reason.toString()
        : "Unknown rejection reason";
      log(`Prediction failed. Reason: ${runResultData.reason}`);
    }
    allResults.push(runResultData);
  };

  log(
    `Starting ${NUM_RUNS} prediction runs with concurrency limit ${CONCURRENT_LIMIT}...`,
  );

  // Array to hold promises for the current batch
  let promiseBatch = [];
  // Array to hold corresponding data for the batch
  let batchData = [];

  // Helper function to process a batch of promises
  const processBatch = async () => {
    if (promiseBatch.length === 0) return;

    log(`Waiting for batch of ${promiseBatch.length} promises to settle...`);
    const settledResults = await Promise.allSettled(promiseBatch);

    settledResults.forEach((settledResult, index) => {
      const { target, runIndex } = batchData[index];
      processResult(settledResult, target, runIndex);
    });

    // Clear the batch for the next set
    promiseBatch = [];
    batchData = [];
  };

  for (let i = 0; i < NUM_RUNS; i++) {
    // Prepare the next run
    runsInitiated++;
    log(`--- Initiating Run ${runsInitiated}/${NUM_RUNS} ---`);
    const shuffled = [...allSubmissions].sort(() => 0.5 - Math.random());
    if (shuffled.length <= NUM_EXAMPLES_PER_RUN) {
      log(`Warning: Run ${runsInitiated} skipped. Not enough unique data.`);
      // Don't increment runsCompleted here; it's handled when results are processed or skipped.
      continue; // Skip this iteration
    }
    const examples = shuffled.slice(0, NUM_EXAMPLES_PER_RUN);
    const target = shuffled[NUM_EXAMPLES_PER_RUN];
    const prompt = formatPrompt(examples, target);

    // Start the API call promise
    const predictionPromise = predictEngagement(prompt);

    // Add the new promise and its data to the current batch
    promiseBatch.push(predictionPromise);
    batchData.push({ target: target, runIndex: i });

    // If the batch is full, wait for it and process results
    if (promiseBatch.length >= CONCURRENT_LIMIT) {
      await processBatch();
    }
  }

  // Process any remaining promises in the last batch after the loop finishes
  log("All runs initiated. Processing final batch...");
  await processBatch();

  log("\n--- Experiment Summary ---");
  log(`Total Runs Attempted: ${runsInitiated}`); // Use runsInitiated for accuracy
  log(`Total Runs Processed (incl. skipped/failed): ${runsCompleted}`);
  log(`Successful Predictions: ${successfulPredictions}`);
  log(`Failed Predictions: ${runsCompleted - successfulPredictions}`);

  if (successfulPredictions > 0) {
    const upvoteErrors = allResults
      .filter((r) => r.success)
      .map((r) => r.upvoteError);
    const commentErrors = allResults
      .filter((r) => r.success)
      .map((r) => r.commentError);

    const upvoteMAE = calculateMAE(upvoteErrors);
    const commentMAE = calculateMAE(commentErrors);

    log(`Upvotes Mean Absolute Error (MAE): ${upvoteMAE.toFixed(2)}`);
    log(`Comments Mean Absolute Error (MAE): ${commentMAE.toFixed(2)}`);

    // Optional: Log detailed results
    // console.log("\nDetailed Results:");
    // console.table(allResults); // Use allResults here

    // Save detailed results to a JSON file
    try {
      const resultsFilePath = "engagement_prediction_results.json";
      fs.writeFileSync(resultsFilePath, JSON.stringify(allResults, null, 2));
      log(`Detailed results saved to ${resultsFilePath}`);
    } catch (writeError) {
      log(`Error saving results to file: ${writeError}`);
    }
  } else {
    log("No successful predictions to calculate accuracy.");
  }
}

// Check for required environment variables before running
if (!env.ANTHROPIC_API_KEY) {
  console.error("Error: ANTHROPIC_API_KEY environment variable not set.");
  process.exit(1);
}

// Log successful script initialization
log("Script initialized successfully");

// Main execution with better error handling
try {
  console.log("Starting engagement prediction script...");
  runExperiment().catch((err) => {
    console.error(`Experiment failed with error: ${err}`);
    console.error(`Stack trace: ${err.stack}`);
    process.exit(1);
  });
} catch (error) {
  console.error(`Unhandled error in script: ${error.message}`);
  console.error(`Stack trace: ${error.stack}`);
  process.exit(1);
}
