import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as tf from "@tensorflow/tfjs-node";
import { getDay, getHours } from "date-fns";

// Use console.log for critical logs in case logger fails
// import log from "./logger.mjs";
const log = console.log; // Use console.log for now

import { resolve as resolveKarma } from "./karma.mjs";
import { extractDomain } from "./views/components/row.mjs";

const __filename = fileURLToPath(import.meta.url);
// Assuming this file is in src/, navigate up one level then to scripts/
const SCRIPT_DIR = path.join(path.dirname(__filename), "..", "scripts");

// --- Configuration ---
const UPVOTES_MODEL_PATH = `file://${path.join(
  SCRIPT_DIR,
  "tfjs_upvotes_model",
  "model.json",
)}`;
const COMMENTS_MODEL_PATH = `file://${path.join(
  SCRIPT_DIR,
  "tfjs_comments_model",
  "model.json",
)}`;
const PREPROCESSING_INFO_PATH = path.join(SCRIPT_DIR, "preprocessing_info.json");
// --- End Configuration ---

let upvotesModel = null;
let commentsModel = null;
let preprocessingInfo = null;
let modelsLoaded = false;
let loadingPromise = null; // To prevent concurrent loading attempts

// --- Load Models and Preprocessing Info ---
async function loadResources() {
  if (modelsLoaded) {
    return true;
  }
  // If already loading, wait for the existing promise
  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
      try {
        // log("[Prediction] Loading prediction resources..."); // Removed log
        if (!fs.existsSync(PREPROCESSING_INFO_PATH)) {
          throw new Error(
            `Preprocessing info file not found: ${PREPROCESSING_INFO_PATH}`,
          );
        }
        preprocessingInfo = JSON.parse(
          fs.readFileSync(PREPROCESSING_INFO_PATH, "utf8"),
        );
        // log("[Prediction] Preprocessing info loaded."); // Removed log

        // log("[Prediction] Loading prediction models..."); // Removed log
        upvotesModel = await tf.loadLayersModel(UPVOTES_MODEL_PATH);
        commentsModel = await tf.loadLayersModel(COMMENTS_MODEL_PATH);
        // log("[Prediction] Models loaded."); // Removed log

        // Perform a dummy prediction to ensure models are fully loaded/warmed up
        // log("[Prediction] Warming up models..."); // Removed log
        const dummyInputLength = preprocessingInfo.numericalFeatures.length + preprocessingInfo.numDomains;
        if (dummyInputLength <= 0 || isNaN(dummyInputLength)) {
            throw new Error(`Invalid dummyInputLength calculated: ${dummyInputLength}`);
        }
        const dummyInput = tf.zeros([1, dummyInputLength]);
        tf.tidy(() => {
            upvotesModel.predict(dummyInput);
            commentsModel.predict(dummyInput);
        });
        tf.dispose(dummyInput);

        // log("[Prediction] Prediction models loaded and warmed up successfully."); // Removed log
        modelsLoaded = true;
        return true;
      } catch (error) {
        // Use console.error for critical errors
        console.error(`[Prediction] Error loading prediction resources: ${error.message}`);
        console.error(error.stack);
        modelsLoaded = false; // Ensure we don't think models are loaded if error occurred
        preprocessingInfo = null; // Clear potentially partially loaded info
        upvotesModel = null;
        commentsModel = null;
        return false;
      } finally {
          loadingPromise = null; // Reset loading promise once done (success or fail)
      }
  })();

  return loadingPromise;
}

// --- Preprocessing Function for New Data ---
function preprocessSingleSubmission(submissionData, pInfo) {
  const {
    scalingParams,
    domainToIndexMap,
    numDomains,
    numericalFeatures,
    categoricalFeature,
  } = pInfo;

  // 1. Extract Raw Features (Match training data extraction)
  const submissionDate = new Date(submissionData.timestamp * 1000);
  const domain = extractDomain(submissionData.href) || "unknown";
  // Get current karma - ensure karma module is initialized if needed elsewhere
  const submitterKarma = resolveKarma(submissionData.identity);

  const rawFeatures = {
    submitter_karma: submitterKarma,
    submission_timestamp: submissionData.timestamp,
    submission_hour: getHours(submissionDate),
    submission_day: getDay(submissionDate),
    title_length: submissionData.title?.length || 0,
    domain: domain, // Keep the domain name for mapping
  };

  // 2. Scale Numerical Features
  const scaledNumerical = numericalFeatures.map((feature) => {
    if (!scalingParams[feature]) {
        // log(`[Prediction] Warning: Scaling parameters missing for feature '${feature}'. Using 0.`); // Removed log
        return 0;
    }
    const stdDev = scalingParams[feature].stdDev === 0 ? 1 : scalingParams[feature].stdDev;
    const scaledValue = (rawFeatures[feature] - scalingParams[feature].mean) / stdDev;
    if (isNaN(scaledValue)) {
        // log(`[Prediction] Warning: NaN detected during prediction preprocessing for feature '${feature}'. Using 0.`); // Removed log
        return 0;
    }
    return scaledValue;
  });

  // 3. One-Hot Encode Categorical Feature (Domain)
  const oneHotDomain = Array(numDomains).fill(0);
  const domainIndex = domainToIndexMap[rawFeatures[categoricalFeature]];
  if (domainIndex !== undefined) {
    oneHotDomain[domainIndex] = 1;
  } else {
    // Handle domain not seen during training
    const unknownIndex = domainToIndexMap["unknown"];
    if (unknownIndex !== undefined) {
      oneHotDomain[unknownIndex] = 1;
      // Limit logging
      // log(`[Prediction] Warning: Domain ${rawFeatures[categoricalFeature]} not seen during training, mapped to 'unknown'.`); // Removed log
    } else {
      // log(`[Prediction] Warning: Domain ${rawFeatures[categoricalFeature]} not seen during training and 'unknown' not in map. Vector will be all zeros.`); // Removed log
    }
  }

  // 4. Combine Features
  const finalFeatures = [...scaledNumerical, ...oneHotDomain];

  // 5. Final Check for NaN
  if (finalFeatures.some(val => typeof val !== 'number' || isNaN(val))) {
      // Use console.error for critical errors
      console.error(`[Prediction] FATAL: Non-numeric value found in final feature vector during prediction preprocessing. Features: ${JSON.stringify(finalFeatures)}`);
      throw new Error("Feature vector contains non-numeric values.");
  }

  return finalFeatures;
}

// --- Prediction Function ---
export async function getPredictedEngagement(submissionData) {
  // Ensure resources are loaded
  const loaded = await loadResources();
  if (!loaded || !upvotesModel || !commentsModel || !preprocessingInfo) {
    // log("[Prediction] Prediction resources not loaded. Cannot predict."); // Removed log
    // Return default/neutral values or throw error
    return { predictedUpvotes: 1, predictedComments: 0, predictionError: true };
  }

  let predictionResult = { predictedUpvotes: 1, predictedComments: 0 }; // Default values

  let inputTensor; // Declare outside try to ensure disposal in finally
  try {
    // 1. Preprocess the input submission data
    const features = preprocessSingleSubmission(submissionData, preprocessingInfo);
    inputTensor = tf.tensor2d([features]); // Create a 2D tensor (1 sample, N features)

    // 2. Make predictions using tf.tidy for memory management
    let upvotesPredLog1p, commentsPredLog1p;
    const result = tf.tidy(() => {
        const upvotesTensor = upvotesModel.predict(inputTensor);
        const commentsTensor = commentsModel.predict(inputTensor);
        // Use dataSync as it's simpler for single predictions inside tidy
        return {
            upvotes: upvotesTensor.dataSync()[0],
            comments: commentsTensor.dataSync()[0]
        };
    });
    upvotesPredLog1p = result.upvotes;
    commentsPredLog1p = result.comments;

    // 3. Reverse the log transformation (expm1 = exp(x) - 1)
    // Ensure predictions are non-negative and integers
    const predictedUpvotes = Math.max(0, Math.round(Math.expm1(upvotesPredLog1p)));
    const predictedComments = Math.max(0, Math.round(Math.expm1(commentsPredLog1p)));

    // Ensure upvotes are at least 1 (since submitter implicitly upvotes)
    predictionResult = {
        predictedUpvotes: Math.max(1, predictedUpvotes),
        predictedComments: predictedComments
    };

  } catch (error) {
    // Use console.error for critical errors
    console.error(`[Prediction] Error during prediction for href ${submissionData.href}: ${error.message}`);
    console.error(error.stack);
    // Return default values on error and flag it
    predictionResult = { predictedUpvotes: 1, predictedComments: 0, predictionError: true };
  } finally {
      // Dispose the input tensor if it was created
      if (inputTensor) {
          tf.dispose(inputTensor);
      }
  }

  return predictionResult;
}

// Eagerly load resources when the module is first imported.
// This might slightly delay initial server startup but makes subsequent
// predictions faster as models are already loaded.
loadResources();

// Example Usage (for testing this module directly)
/*
async function testPrediction() {
    const exampleSubmission = {
        href: "https://example.com/new-article",
        title: "A Brand New Article Title",
        identity: "0x...", // Replace with a real address from your data
        timestamp: Math.floor(Date.now() / 1000)
    };
    const prediction = await getPredictedEngagement(exampleSubmission);
    console.log(`Predicted Engagement for ${exampleSubmission.href}:`, prediction);

    // Test with another one after a delay
    setTimeout(async () => {
         const exampleSubmission2 = {
            href: "https://anotherexample.org/another",
            title: "Another Title",
            identity: "0x...", // Replace with a real address
            timestamp: Math.floor(Date.now() / 1000)
         };
         const prediction2 = await getPredictedEngagement(exampleSubmission2);
         console.log(`Predicted Engagement for ${exampleSubmission2.href}:`, prediction2);
    }, 2000);
}
// testPrediction();
*/
