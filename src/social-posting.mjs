// Required environment variables:
// - NEYNAR_API_KEY: Neynar API key for Farcaster operations
// - FC_SEED_PHRASE: Farcaster account seed phrase for signing casts
// - CONSUMER_KEY: Twitter API consumer key (for future implementation)
// - CONSUMER_SECRET: Twitter API consumer secret (for future implementation)
// - TWITTER_ACCESS_TOKEN: Twitter access token (for future implementation)
// - TWITTER_ACCESS_TOKEN_SECRET: Twitter access token secret (for future implementation)

import { env } from "process";
import { Wallet } from "ethers";
import {
  NeynarAPIClient,
  Configuration,
  isApiErrorResponse,
} from "@neynar/nodejs-sdk";
import log from "./logger.mjs";

const neynarConfig = new Configuration({
  apiKey: env.NEYNAR_API_KEY,
});

const neynarClient = new NeynarAPIClient(neynarConfig);

export async function sendTweet(tweet) {
  try {
    // Twitter posting is temporarily disabled until OAuth dependencies are installed
    log("Twitter posting is not yet configured");
    return { success: false, error: "Twitter not configured" };
  } catch (error) {
    log(`Failed to send tweet: ${error.message}`);
    return { success: false, error: error.message };
  }
}

let signerUuid = null;

async function ensureSignerReady() {
  if (signerUuid) return signerUuid;
  
  // Check if we have a stored signer UUID
  if (env.FC_SIGNER_UUID) {
    signerUuid = env.FC_SIGNER_UUID;
    return signerUuid;
  }
  
  // If no signer UUID is provided, we need manual setup
  log("No FC_SIGNER_UUID found. Please create a signer via Neynar dashboard or API");
  log("To create a signer programmatically:");
  log("1. Call neynarClient.createSigner() to get a signer");
  log("2. Approve the signer in Warpcast or another Farcaster client");
  log("3. Store the signer_uuid in FC_SIGNER_UUID environment variable");
  
  return null;
}

export async function sendCast(text, embeds = []) {
  try {
    const signer = await ensureSignerReady();
    if (!signer) {
      return { success: false, error: "Farcaster signer not configured" };
    }

    const castData = {
      signer_uuid: signer,
      text: text,
    };

    if (embeds && embeds.length > 0) {
      castData.embeds = embeds.map(url => ({ url }));
    }

    const response = await neynarClient.publishCast(castData);
    log(`Cast sent successfully: ${text.substring(0, 50)}...`);
    return { success: true, data: response };
  } catch (error) {
    if (isApiErrorResponse(error)) {
      log(`Failed to send cast - API Error: ${JSON.stringify(error.response.data)}`);
      return { 
        success: false, 
        error: `API Error: ${error.response.status}`, 
        details: error.response.data 
      };
    }
    log(`Failed to send cast: ${error.message}`);
    return { success: false, error: error.message };
  }
}

export function formatSubmissionForTwitter(submission, domain, targetUrl) {
  const tweet = `${submission.title} - ${domain}

${targetUrl}`;
  
  return tweet;
}

export function formatSubmissionForFarcaster(submission, domain, targetUrl) {
  const text = `${submission.title} - ${domain}

${targetUrl}`;
  
  const embeds = [];
  
  return { text, embeds };
}