#!/usr/bin/env node

import "dotenv/config";
import { env } from "process";
import {
  NeynarAPIClient,
  Configuration,
} from "@neynar/nodejs-sdk";

const neynarConfig = new Configuration({
  apiKey: env.NEYNAR_API_KEY,
});

const neynarClient = new NeynarAPIClient(neynarConfig);

async function createSigner() {
  if (!env.NEYNAR_API_KEY) {
    console.error("NEYNAR_API_KEY environment variable is required");
    process.exit(1);
  }

  try {
    console.log("Creating a new Farcaster signer...");
    const signer = await neynarClient.createSigner();
    
    console.log("\n✅ Signer created successfully!");
    console.log("\nSigner details:");
    console.log(`- UUID: ${signer.signer_uuid}`);
    console.log(`- Public Key: ${signer.public_key}`);
    console.log(`- Status: ${signer.status}`);
    
    if (signer.approval_url) {
      console.log(`\n🔗 Approval URL: ${signer.approval_url}`);
      console.log("\nNext steps:");
      console.log("1. Open the approval URL in your browser");
      console.log("2. Approve the signer in Warpcast or another Farcaster client");
      console.log("3. Add this to your .env file:");
      console.log(`   FC_SIGNER_UUID=${signer.signer_uuid}`);
    }
    
    return signer;
  } catch (error) {
    console.error("Failed to create signer:", error.message);
    if (error.response?.data) {
      console.error("API Error:", error.response.data);
    }
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createSigner();
}