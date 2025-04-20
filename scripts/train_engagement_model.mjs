import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import csv from "csv-parser";
import * as tf from "@tensorflow/tfjs-node"; // Use TensorFlow.js (Node backend)
// Removed: import OneHotEncoder from "one-hot-encoder";

import log from "../src/logger.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuration ---
const INPUT_CSV_PATH = path.join(__dirname, "training_data.csv");
// TensorFlow.js saves models as multiple files in a directory
const UPVOTES_MODEL_PATH = `file://${path.join(__dirname, "tfjs_upvotes_model")}`;
const COMMENTS_MODEL_PATH = `file://${path.join(__dirname, "tfjs_comments_model")}`;
// Save preprocessing info (domain map, scaling params)
const PREPROCESSING_INFO_PATH = path.join(__dirname, "preprocessing_info.json");

const TEST_SPLIT_RATIO = 0.2; // Use 20% of data for validation
const RANDOM_SEED = 42; // For reproducible splits

// Base numerical features (will be scaled)
const NUMERICAL_FEATURES = [
  "submitter_karma",
  "submission_timestamp",
  "submission_hour",
  "submission_day",
  "title_length",
];
// Categorical feature to be one-hot encoded
const CATEGORICAL_FEATURE = "domain";

const TARGET_UPVOTES = "final_upvotes_log1p"; // Log-transformed target
const TARGET_COMMENTS = "final_comments_log1p"; // Log-transformed target

// Neural Network Parameters
const LEARNING_RATE = 0.001;
const EPOCHS = 100; // Max number of training epochs
const BATCH_SIZE = 64;
const EARLY_STOPPING_PATIENCE = 10; // Stop if validation loss doesn't improve for N epochs
// --- End Configuration ---

// Helper function to shuffle an array (using seeded random)
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]]; // Swap elements
  }
}

// Helper function to calculate MAE
function calculateMAE(predictions, actuals) {
  if (predictions.length !== actuals.length || predictions.length === 0) {
    return NaN;
  }
  let sumAbsError = 0;
  for (let i = 0; i < predictions.length; i++) {
    sumAbsError += Math.abs(predictions[i] - actuals[i]);
  }
  return sumAbsError / predictions.length;
}

// Helper function to calculate mean and std dev for scaling
function getMeanAndStdDev(data, feature) {
  const values = data.map(row => row[feature]);
  if (values.length === 0) return { mean: 0, stdDev: 1 }; // Handle empty data case
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(variance);
  // Handle stdDev = 0 to avoid division by zero
  return { mean, stdDev: stdDev === 0 ? 1 : stdDev };
}

async function loadAndPreprocessData() {
  log(`Loading data from ${INPUT_CSV_PATH}...`);
  const rawData = [];
  const domainSet = new Set();

  // 1. Load Raw Data
  await new Promise((resolve, reject) => {
    fs.createReadStream(INPUT_CSV_PATH)
      .pipe(csv())
      .on("data", (row) => {
        // Basic type conversion and validation
        const record = {
          submission_id: row.SubmissionID,
          title: row.Title,
          href: row.Href,
          domain: row.Domain || "unknown", // Handle missing domain
          submitter_identity: row.SubmitterIdentity,
          submitter_karma: parseInt(row.SubmitterKarma, 10) || 0,
          submission_timestamp: parseInt(row.SubmissionTimestamp, 10) || 0,
          submission_hour: parseInt(row.SubmissionHourUTC, 10) || 0,
          submission_day: parseInt(row.SubmissionDayOfWeek, 10) || 0,
          title_length: parseInt(row.TitleLength, 10) || 0,
          final_upvotes: parseInt(row.FinalUpvotes, 10) || 0,
          final_comments: parseInt(row.FinalComments, 10) || 0,
        };

        // Apply log(1+x) transformation to targets
        record[TARGET_UPVOTES] = Math.log1p(record.final_upvotes);
        record[TARGET_COMMENTS] = Math.log1p(record.final_comments);

        if (!isNaN(record.submitter_karma) && !isNaN(record.final_upvotes)) {
          rawData.push(record);
          domainSet.add(record.domain); // Collect unique domains
        } else {
          log(`Skipping row due to invalid numeric data: ${row.SubmissionID}`);
        }
      })
      .on("end", resolve)
      .on("error", (error) => reject(`Error reading CSV: ${error.message}`));
  });
  log(`Loaded ${rawData.length} valid records.`);

  // 2. Prepare Preprocessing Info (Scaling Params, Domain Map)
  const preprocessingInfo = {
    scalingParams: {},
    domainToIndexMap: {},
    numDomains: 0,
    oneHotFeatureNames: [], // Will store names like 'domain_youtube.com'
  };

  // Calculate scaling parameters for numerical features
  NUMERICAL_FEATURES.forEach(feature => {
    preprocessingInfo.scalingParams[feature] = getMeanAndStdDev(rawData, feature);
  });
  log("Calculated scaling parameters for numerical features.");

  // Create domain to index mapping
  const sortedDomains = Array.from(domainSet).sort();
  sortedDomains.forEach((domain, index) => {
    preprocessingInfo.domainToIndexMap[domain] = index;
    preprocessingInfo.oneHotFeatureNames.push(`${CATEGORICAL_FEATURE}_${domain}`); // Store derived feature names
  });
  preprocessingInfo.numDomains = sortedDomains.length;
  log(`Created index map for ${preprocessingInfo.numDomains} unique domains.`);

  // 3. Apply Preprocessing
  const processedData = rawData.map(row => {
    // Scale numerical features
    const scaledNumerical = NUMERICAL_FEATURES.map(feature =>
      (row[feature] - preprocessingInfo.scalingParams[feature].mean) / preprocessingInfo.scalingParams[feature].stdDev
    );

    // Create one-hot vector for domain
    const oneHotDomain = Array(preprocessingInfo.numDomains).fill(0);
    const domainIndex = preprocessingInfo.domainToIndexMap[row[CATEGORICAL_FEATURE]];
    if (domainIndex !== undefined) {
      oneHotDomain[domainIndex] = 1;
    } else {
        // This case should ideally not happen if domainSet was built correctly
        log(`Warning: Domain ${row[CATEGORICAL_FEATURE]} not found in map during processing.`);
    }

    return {
      // Keep original targets for evaluation later
      final_upvotes: row.final_upvotes,
      final_comments: row.final_comments,
      // Keep log-transformed targets for training
      [TARGET_UPVOTES]: row[TARGET_UPVOTES],
      [TARGET_COMMENTS]: row[TARGET_COMMENTS],
      // Combine scaled numerical and one-hot encoded categorical features
      features: [...scaledNumerical, ...oneHotDomain],
    };
  });

  // Determine the final list of feature names after one-hot encoding
  const finalFeatureNames = [...NUMERICAL_FEATURES, ...preprocessingInfo.oneHotFeatureNames];
  const inputShape = [finalFeatureNames.length]; // Shape for the model input layer

  log("Data preprocessing complete.");
  return { processedData, preprocessingInfo, inputShape, finalFeatureNames };
}

function buildModel(inputShape) {
  const model = tf.sequential();

  // Input layer + first hidden layer
  model.add(tf.layers.dense({
    inputShape: inputShape,
    units: 64, // Example size
    activation: 'relu',
    kernelInitializer: 'heNormal' // Good initializer for ReLU
  }));
  model.add(tf.layers.dropout({ rate: 0.2 })); // Add dropout for regularization

  // Second hidden layer
  model.add(tf.layers.dense({
    units: 32,
    activation: 'relu',
    kernelInitializer: 'heNormal'
  }));
  model.add(tf.layers.dropout({ rate: 0.1 }));

  // Output layer (1 unit for regression, linear activation)
  model.add(tf.layers.dense({ units: 1 }));

  // Compile the model
  model.compile({
    optimizer: tf.train.adam(LEARNING_RATE),
    loss: 'meanAbsoluteError', // Use MAE directly as loss
    metrics: ['mae']
  });

  model.summary(); // Log model structure
  return model;
}

async function trainModel(model, trainData, validData, targetFeature) {
  log(`Training model for target: ${targetFeature}...`);

  // Convert data to tensors
  const trainFeatures = tf.tensor2d(trainData.map(row => row.features));
  const trainLabels = tf.tensor2d(trainData.map(row => [row[targetFeature]])); // Target needs to be 2D
  const validFeatures = tf.tensor2d(validData.map(row => row.features));
  const validLabels = tf.tensor2d(validData.map(row => [row[targetFeature]]));

  const history = await model.fit(trainFeatures, trainLabels, {
    epochs: EPOCHS,
    batchSize: BATCH_SIZE,
    validationData: [validFeatures, validLabels],
    callbacks: [
      tf.callbacks.earlyStopping({ monitor: 'val_loss', patience: EARLY_STOPPING_PATIENCE, mode: 'min' }),
      // Optional: Log progress during training
      // { onEpochEnd: (epoch, logs) => log(`Epoch ${epoch + 1}: loss = ${logs.loss.toFixed(4)}, val_loss = ${logs.val_loss.toFixed(4)}`) }
    ],
    shuffle: true, // Shuffle training data each epoch
    verbose: 0 // Use callbacks for logging instead
  });

  log(`Training finished after ${history.epoch.length} epochs.`);

  // Clean up tensors
  tf.dispose([trainFeatures, trainLabels, validFeatures, validLabels]);

  return history; // Contains training metrics
}

async function runTrainingPipeline() {
  try {
    // 1. Load and Preprocess Data
    const { processedData, preprocessingInfo, inputShape, finalFeatureNames } = await loadAndPreprocessData();

    if (processedData.length === 0) {
      log("No data loaded, cannot train models.");
      return;
    }
    log(`Input shape for model: ${inputShape}`);
    log(`Features (${finalFeatureNames.length}): ${finalFeatureNames.join(', ')}`);


    // 2. Split Data
    Math.seedrandom(RANDOM_SEED); // Use a seed for reproducibility
    shuffleArray(processedData);

    const splitIndex = Math.floor(
      processedData.length * (1 - TEST_SPLIT_RATIO),
    );
    const trainData = processedData.slice(0, splitIndex);
    const validData = processedData.slice(splitIndex);
    log(
      `Split data: ${trainData.length} training, ${validData.length} validation.`,
    );

    // 3. Build and Train Upvotes Model
    log("\n--- Training Upvotes Model ---");
    const upvotesModel = buildModel(inputShape);
    await trainModel(upvotesModel, trainData, validData, TARGET_UPVOTES);

    // 4. Build and Train Comments Model
    log("\n--- Training Comments Model ---");
    const commentsModel = buildModel(inputShape); // Build a separate model instance
    await trainModel(commentsModel, trainData, validData, TARGET_COMMENTS);

    // 5. Evaluate Models on Validation Set
    log("\nEvaluating models on validation set...");
    const validFeaturesTensor = tf.tensor2d(validData.map(row => row.features));

    const upvotesPredLog1pTensor = upvotesModel.predict(validFeaturesTensor);
    const commentsPredLog1pTensor = commentsModel.predict(validFeaturesTensor);

    // Convert tensors back to JS arrays
    const upvotesPredLog1p = await upvotesPredLog1pTensor.data();
    const commentsPredLog1p = await commentsPredLog1pTensor.data();

    // Reverse the log transformation (expm1 = exp(x) - 1)
    const upvotesPred = Array.from(upvotesPredLog1p).map((p) => Math.max(0, Math.expm1(p)));
    const commentsPred = Array.from(commentsPredLog1p).map((p) => Math.max(0, Math.expm1(p)));

    const upvotesActual = validData.map((row) => row.final_upvotes);
    const commentsActual = validData.map((row) => row.final_comments);

    const upvotesMAE = calculateMAE(upvotesPred, upvotesActual);
    const commentsMAE = calculateMAE(commentsPred, commentsActual);

    log(`--- Validation Results ---`);
    log(`Upvotes MAE: ${upvotesMAE.toFixed(3)}`);
    log(`Comments MAE: ${commentsMAE.toFixed(3)}`);
    log(`--------------------------`);

    // Clean up tensors
    tf.dispose([validFeaturesTensor, upvotesPredLog1pTensor, commentsPredLog1pTensor]);

    // 6. Save Models and Preprocessing Info
    log("Saving models and preprocessing info...");
    await upvotesModel.save(UPVOTES_MODEL_PATH);
    await commentsModel.save(COMMENTS_MODEL_PATH);

    // Save the necessary preprocessing info
    const serializablePreprocessingInfo = {
        scalingParams: preprocessingInfo.scalingParams,
        domainToIndexMap: preprocessingInfo.domainToIndexMap, // Save the map
        numDomains: preprocessingInfo.numDomains, // Save the number of domains
        oneHotFeatureNames: preprocessingInfo.oneHotFeatureNames, // Save the derived feature names
        numericalFeatures: NUMERICAL_FEATURES,
        categoricalFeature: CATEGORICAL_FEATURE,
    };
    fs.writeFileSync(PREPROCESSING_INFO_PATH, JSON.stringify(serializablePreprocessingInfo, null, 2));

    log(`Upvotes model saved to ${UPVOTES_MODEL_PATH.replace('file://', '')}`);
    log(`Comments model saved to ${COMMENTS_MODEL_PATH.replace('file://', '')}`);
    log(`Preprocessing info saved to ${PREPROCESSING_INFO_PATH}`);

    log("\nTraining pipeline completed successfully.");
  } catch (error) {
    log(`Error during training pipeline: ${error.message}`);
    console.error(error.stack); // Log full stack trace for debugging
  }
}

// Add seedrandom if you need deterministic shuffling (optional)
let _seed = RANDOM_SEED;
Math.seedrandom = function (seed) {
  _seed = seed;
};
Math.random = function () {
  const x = Math.sin(_seed++) * 10000;
  return x - Math.floor(x);
};

// --- Run the pipeline ---
runTrainingPipeline();
