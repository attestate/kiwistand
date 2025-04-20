import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import csv from "csv-parser";

// **EARLY LOGGING**
console.log("[1] Script starting...");
console.log(`[2] Node.js version: ${process.version}`);

// **REMOVED LOGGER IMPORT**
// import log from "../src/logger.mjs";

let tf;
try {
  console.log("[3] Attempting to import @tensorflow/tfjs-node...");
  tf = await import("@tensorflow/tfjs-node");
  console.log(`[4] TensorFlow.js version: ${tf.version.tfjs}`);
  console.log(`[5] TensorFlow.js backend: ${tf.getBackend()}`);
  // Explicitly wait for backend to be ready
  await tf.ready();
  console.log("[6] TensorFlow.js backend is ready.");
} catch (tfImportError) {
  console.error(
    "!!! FAILED TO IMPORT OR INITIALIZE TENSORFLOW.JS:",
    tfImportError,
  );
  process.exit(1);
}

// --- Global Error Handlers ---
process.on("unhandledRejection", (reason, promise) => {
  console.error("!!! Unhandled Rejection at:", promise, "reason:", reason);
  // Use console.error instead of log
  console.error(`Unhandled Rejection: ${reason?.stack || reason}`);
  process.exit(1); // Exit on unhandled rejection
});
process.on("uncaughtException", (error) => {
  console.error("!!! Uncaught Exception:", error);
  // Use console.error instead of log
  console.error(`Uncaught Exception: ${error?.stack || error}`);
  process.exit(1); // Exit on uncaught exception
});
// --- End Global Error Handlers ---

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuration ---
const INPUT_CSV_PATH = path.join(__dirname, "training_data.csv");
// Point directly to the model.json file
const UPVOTES_MODEL_PATH = `file://${path.join(
  __dirname,
  "tfjs_upvotes_model",
  "model.json",
)}`;
const COMMENTS_MODEL_PATH = `file://${path.join(
  __dirname,
  "tfjs_comments_model",
  "model.json",
)}`;
const PREPROCESSING_INFO_PATH = path.join(__dirname, "preprocessing_info.json");

// --- Must match the training script ---
const TEST_SPLIT_RATIO = 0.2;
const RANDOM_SEED = 42; // Keep for reference, but not used for seeding Math.random directly
const TARGET_UPVOTES = "final_upvotes_log1p"; // Log-transformed target name used during training
const TARGET_COMMENTS = "final_comments_log1p"; // Log-transformed target name used during training

// --- Debugging ---
const DEBUG_DATA_LIMIT = null;
// --- End Debugging ---

// --- End Configuration ---

// **UNCOMMENTED HELPER FUNCTIONS**
function shuffleArray(array) {
  console.log("Shuffling array..."); // Add log
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]]; // Swap elements
  }
  console.log("Shuffling complete."); // Add log
}

function calculateMAE(predictions, actuals) {
  console.log("Calculating MAE..."); // Add log
  if (predictions.length !== actuals.length || predictions.length === 0) {
    console.log(
      "MAE calculation failed: Array length mismatch or empty arrays.",
    );
    return NaN;
  }
  let sumAbsError = 0;
  let validCount = 0; // Count valid pairs for averaging
  for (let i = 0; i < predictions.length; i++) {
    // Ensure both values are numbers before calculating difference
    const pred = Number(predictions[i]);
    const actual = Number(actuals[i]);
    if (!isNaN(pred) && !isNaN(actual)) {
      sumAbsError += Math.abs(pred - actual);
      validCount++;
    } else {
      console.log(
        `Warning: Skipping row in MAE calculation due to NaN values (Pred: ${pred}, Actual: ${actual})`,
      );
    }
  }
  // Avoid division by zero if length is 0 or no valid pairs found
  const mae = validCount > 0 ? sumAbsError / validCount : 0;
  console.log(`MAE calculation complete: ${mae}`); // Add log
  return mae;
}

async function loadAndPreprocessTestData(preprocessingInfo) {
  console.log(`Loading data from ${INPUT_CSV_PATH} for testing...`);
  const rawData = [];

  // 1. Load Raw Data from CSV
  await new Promise((resolve, reject) => {
    fs.createReadStream(INPUT_CSV_PATH)
      .pipe(csv())
      .on("data", (row) => {
        // Basic type conversion and validation - MUST match training script
        const record = {
          submission_id: row.SubmissionID,
          domain: row.Domain || "unknown",
          submitter_karma: parseInt(row.SubmitterKarma, 10) || 0,
          submission_timestamp: parseInt(row.SubmissionTimestamp, 10) || 0,
          submission_hour: parseInt(row.SubmissionHourUTC, 10) || 0,
          submission_day: parseInt(row.SubmissionDayOfWeek, 10) || 0,
          title_length: parseInt(row.TitleLength, 10) || 0,
          final_upvotes: parseInt(row.FinalUpvotes, 10) || 0,
          final_comments: parseInt(row.FinalComments, 10) || 0,
        };

        // Apply log(1+x) transformation to targets (needed if evaluating log-transformed MAE)
        record[TARGET_UPVOTES] = Math.log1p(record.final_upvotes);
        record[TARGET_COMMENTS] = Math.log1p(record.final_comments);

        if (!isNaN(record.submitter_karma) && !isNaN(record.final_upvotes)) {
          rawData.push(record);
        } else {
          console.log(
            `Skipping row during test load due to invalid numeric data: ${row.SubmissionID}`,
          );
        }
      })
      .on("end", resolve)
      .on("error", (error) => reject(`Error reading CSV: ${error.message}`));
  });
  console.log(`Loaded ${rawData.length} valid records for testing.`);

  // 2. Apply Preprocessing using loaded info
  console.log("Applying preprocessing...");
  const {
    scalingParams,
    domainToIndexMap,
    numDomains,
    numericalFeatures,
    categoricalFeature,
  } = preprocessingInfo;

  const processedData = rawData.map((row, rowIndex) => {
    // Scale numerical features
    const scaledNumerical = numericalFeatures.map((feature) => {
      // Handle potential division by zero if stdDev was 0 during training
      const stdDev =
        scalingParams[feature].stdDev === 0 ? 1 : scalingParams[feature].stdDev;
      const scaledValue = (row[feature] - scalingParams[feature].mean) / stdDev;
      // **Added Check:** Ensure scaled value is not NaN
      if (isNaN(scaledValue)) {
        console.log(
          `Warning: NaN detected in scaled feature '${feature}' at row index ${rowIndex}. Original value: ${row[feature]}, Mean: ${scalingParams[feature].mean}, StdDev: ${stdDev}`,
        );
        return 0; // Replace NaN with 0, or choose another strategy
      }
      return scaledValue;
    });

    // Create one-hot vector for domain
    const oneHotDomain = Array(numDomains).fill(0);
    const domainIndex = domainToIndexMap[row[categoricalFeature]]; // Use the loaded map
    if (domainIndex !== undefined) {
      oneHotDomain[domainIndex] = 1;
    } else {
      // Handle domains present in test data but not in training data (map to 'unknown' if possible or handle as needed)
      const unknownIndex = domainToIndexMap["unknown"];
      if (unknownIndex !== undefined) {
        oneHotDomain[unknownIndex] = 1;
        // **Limit logging for unknown domains to avoid spam**
        if (rowIndex < 10 || rowIndex % 1000 === 0) {
          console.log(
            `Warning: Domain ${row[categoricalFeature]} not seen during training, mapped to 'unknown'. (Row ${rowIndex})`,
          );
        }
      } else {
        if (rowIndex < 10 || rowIndex % 1000 === 0) {
          console.log(
            `Warning: Domain ${row[categoricalFeature]} not seen during training and 'unknown' not in map. Vector will be all zeros. (Row ${rowIndex})`,
          );
        }
      }
    }

    const features = [...scaledNumerical, ...oneHotDomain];
    // **Added Check:** Ensure final feature vector contains no NaN/undefined
    if (features.some((val) => typeof val !== "number" || isNaN(val))) {
      console.log(
        `FATAL: Non-numeric value found in final feature vector at row index ${rowIndex}. Features: ${JSON.stringify(
          features,
        )}`,
      );
      // Optionally throw an error here if this should halt processing
      throw new Error(
        `Non-numeric value in feature vector at index ${rowIndex}`,
      );
    }

    return {
      // Keep original targets for final evaluation
      final_upvotes: row.final_upvotes,
      final_comments: row.final_comments,
      // Keep log-transformed targets if needed for intermediate checks
      [TARGET_UPVOTES]: row[TARGET_UPVOTES],
      [TARGET_COMMENTS]: row[TARGET_COMMENTS],
      // Combine features
      features: features,
    };
  });

  console.log("Test data preprocessing complete.");
  return processedData;
}

async function runTest() {
  // Use console.log instead of log
  console.log("[A] runTest function started.");
  let upvotesModel, commentsModel;
  let testFeaturesTensor; // Keep this outside to dispose in finally

  try {
    // 1. Load Preprocessing Info
    console.log(
      `[B] Loading preprocessing info from ${PREPROCESSING_INFO_PATH}...`,
    );
    if (!fs.existsSync(PREPROCESSING_INFO_PATH)) {
      throw new Error(
        `Preprocessing info file not found: ${PREPROCESSING_INFO_PATH}`,
      );
    }
    const preprocessingInfo = JSON.parse(
      fs.readFileSync(PREPROCESSING_INFO_PATH, "utf8"),
    );
    console.log("[C] Preprocessing info loaded.");

    // 2. Load Models
    console.log(
      `[D] Loading models from ${UPVOTES_MODEL_PATH.replace(
        "file://",
        "",
      )} and ${COMMENTS_MODEL_PATH.replace("file://", "")}...`,
    );
    try {
      console.log("[E] Attempting to load upvotes model...");
      upvotesModel = await tf.loadLayersModel(UPVOTES_MODEL_PATH);
      console.log("[F] Upvotes model loaded.");
      console.log("[G] Attempting to load comments model...");
      commentsModel = await tf.loadLayersModel(COMMENTS_MODEL_PATH);
      console.log("[H] Comments model loaded successfully.");
    } catch (loadError) {
      // Use console.error instead of log
      console.error(`!!! Error loading models: ${loadError.message}`);
      console.error(loadError.stack);
      return; // Stop if models can't load
    }

    // **UNCOMMENTED THE REST OF THE FUNCTION**
    // 3. Load and Preprocess Data
    console.log("Attempting to load and preprocess test data...");
    let processedData = await loadAndPreprocessTestData(preprocessingInfo);
    console.log("Finished loading and preprocessing test data.");

    if (processedData.length === 0) {
      console.log("No test data loaded.");
      return;
    }

    // 4. Split Data (using the same seed and ratio as training)
    console.log("Shuffling and splitting data...");
    // **REMOVED Math.seedrandom call**
    shuffleArray(processedData);

    const splitIndex = Math.floor(
      processedData.length * (1 - TEST_SPLIT_RATIO),
    );
    let testData = processedData.slice(splitIndex);
    console.log(
      `Split data: Using ${testData.length} records for testing (validation set).`,
    );

    // **Optional Debugging: Reduce data size**
    if (DEBUG_DATA_LIMIT && testData.length > DEBUG_DATA_LIMIT) {
      console.log(
        `DEBUG: Reducing test data size to ${DEBUG_DATA_LIMIT} records.`,
      );
      testData = testData.slice(0, DEBUG_DATA_LIMIT);
    }

    if (testData.length === 0) {
      console.log("Test data split resulted in zero records. Cannot evaluate.");
      return;
    }

    // 5. Prepare Tensors for Prediction
    console.log("Preparing tensors for prediction...");
    try {
      const testFeaturesArray = testData.map((row) => row.features);
      const expectedLength =
        preprocessingInfo.numericalFeatures.length +
        preprocessingInfo.numDomains;
      if (
        !testFeaturesArray[0] ||
        testFeaturesArray[0].length !== expectedLength
      ) {
        throw new Error(
          `First feature vector has unexpected length. Expected ${expectedLength}, got ${testFeaturesArray[0]?.length}`,
        );
      }
      // **Log first few feature vectors for inspection**
      if (testFeaturesArray.length > 0) {
        console.log(
          `Inspecting first feature vector (length ${
            testFeaturesArray[0].length
          }): ${JSON.stringify(testFeaturesArray[0].slice(0, 10))}...`,
        );
      }
      if (testFeaturesArray.length > 1) {
        console.log(
          `Inspecting second feature vector (length ${
            testFeaturesArray[1].length
          }): ${JSON.stringify(testFeaturesArray[1].slice(0, 10))}...`,
        );
      }

      for (let i = 0; i < testFeaturesArray.length; i++) {
        if (testFeaturesArray[i].length !== expectedLength) {
          throw new Error(
            `Inconsistent feature vector length at index ${i}. Expected ${expectedLength}, got ${testFeaturesArray[i].length}`,
          );
        }
        // Check for NaN/undefined within the feature vector
        if (
          testFeaturesArray[i].some(
            (val) => typeof val !== "number" || isNaN(val),
          )
        ) {
          console.log(
            `FATAL: Non-numeric value found in feature vector at index ${i}. Halting before tensor creation.`,
          );
          // console.error("Problematic vector:", testFeaturesArray[i]); // Uncomment for detailed vector dump
          return; // Stop execution
        }
      }
      console.log("Feature array checks passed. Creating tensor...");
      testFeaturesTensor = tf.tensor2d(testFeaturesArray); // Assign to the outer scope variable
      console.log(`Test features tensor shape: ${testFeaturesTensor.shape}`);
    } catch (tensorError) {
      console.error(
        `Error creating test features tensor: ${tensorError.message}`,
      );
      console.error(tensorError.stack);
      return; // Stop execution if tensor creation fails
    }

    // 6. Make Predictions
    console.log("Making predictions...");
    let upvotesPredLog1p, commentsPredLog1p;
    let upvotesPredLog1pTensor_intermediate,
      commentsPredLog1pTensor_intermediate; // Temp vars for tidy

    try {
      console.log("Entering tf.tidy for prediction...");
      const result = tf.tidy(() => {
        console.log("Predicting upvotes...");
        upvotesPredLog1pTensor_intermediate =
          upvotesModel.predict(testFeaturesTensor);
        console.log("Upvotes prediction tensor created.");
        console.log("Predicting comments...");
        commentsPredLog1pTensor_intermediate =
          commentsModel.predict(testFeaturesTensor);
        console.log("Comments prediction tensor created.");
        console.log("Extracting data using dataSync()...");
        const upvotesData = upvotesPredLog1pTensor_intermediate.dataSync();
        console.log("Upvotes data extracted.");
        const commentsData = commentsPredLog1pTensor_intermediate.dataSync();
        console.log("Comments data extracted.");
        return {
          upvotes: upvotesData,
          comments: commentsData,
        };
      });
      upvotesPredLog1p = result.upvotes;
      commentsPredLog1p = result.comments;
      console.log("Predictions completed and data extracted from tidy scope.");
    } catch (predictError) {
      console.error(
        `Error during prediction or data extraction: ${predictError.message}`,
      );
      console.error(predictError.stack);
      return; // Stop if prediction fails
    }

    // 7. Evaluate Models
    console.log("\nEvaluating models on test (validation) set...");

    // Reverse the log transformation (expm1 = exp(x) - 1)
    const upvotesPred = Array.from(upvotesPredLog1p).map((p) =>
      Math.max(0, Math.expm1(p)),
    );
    const commentsPred = Array.from(commentsPredLog1p).map((p) =>
      Math.max(0, Math.expm1(p)),
    );

    const upvotesActual = testData.map((row) => row.final_upvotes);
    const commentsActual = testData.map((row) => row.final_comments);

    // Calculate MAE on the original scale
    const upvotesMAE = calculateMAE(upvotesPred, upvotesActual);
    const commentsMAE = calculateMAE(commentsPred, commentsActual);

    console.log(`--- Test Set Results (Original Scale) ---`);
    if (!isNaN(upvotesMAE)) {
      console.log(`Upvotes MAE: ${upvotesMAE.toFixed(3)}`);
    } else {
      console.log(
        `Upvotes MAE: Calculation failed (likely due to NaN values).`,
      );
    }
    if (!isNaN(commentsMAE)) {
      console.log(`Comments MAE: ${commentsMAE.toFixed(3)}`);
    } else {
      console.log(
        `Comments MAE: Calculation failed (likely due to NaN values).`,
      );
    }
    console.log(`-----------------------------------------`);

    // Optional: Calculate MAE on the log-transformed scale (should match training validation loss)
    const upvotesMAELog = calculateMAE(
      Array.from(upvotesPredLog1p),
      testData.map((r) => r[TARGET_UPVOTES]),
    );
    const commentsMAELog = calculateMAE(
      Array.from(commentsPredLog1p),
      testData.map((r) => r[TARGET_COMMENTS]),
    );
    console.log(`--- Test Set Results (Log1p Scale) ---`);
    if (!isNaN(upvotesMAELog)) {
      console.log(`Log1p Upvotes MAE: ${upvotesMAELog.toFixed(4)}`);
    } else {
      console.log(`Log1p Upvotes MAE: Calculation failed.`);
    }
    if (!isNaN(commentsMAELog)) {
      console.log(`Log1p Comments MAE: ${commentsMAELog.toFixed(4)}`);
    } else {
      console.log(`Log1p Comments MAE: Calculation failed.`);
    }
    console.log(`--------------------------------------`);

    console.log("[I] Testing script completed successfully."); // Adjusted log message
  } catch (error) {
    // Use console.error instead of log
    console.error(`!!! Error during testing pipeline: ${error.message}`);
    console.error(error.stack);
  } finally {
    console.log("[J] Entering finally block...");
    // Dispose the feature tensor if it was created
    if (testFeaturesTensor) {
      console.log("Disposing testFeaturesTensor...");
      tf.dispose(testFeaturesTensor);
      console.log("testFeaturesTensor disposed.");
    } else {
      console.log("testFeaturesTensor was not created, skipping disposal.");
    }
    // Note: Prediction tensors were managed by tf.tidy
    console.log("[K] Final tensor disposal check complete.");
  }
}

// **COMMENTED OUT SEEDRANDOM DEFINITION**
/*
let _seed = RANDOM_SEED;
Math.seedrandom = function (seed) {
  _seed = seed;
};
Math.random = function () {
  const x = Math.sin(_seed++) * 10000;
  return x - Math.floor(x);
};
*/

// --- Run the test pipeline ---
// Use console.log instead of log
console.log("[L] Calling runTest()...");
runTest();
// Use console.log instead of log
console.log("[M] runTest() finished or threw error."); // This might not be reached if exit happens
