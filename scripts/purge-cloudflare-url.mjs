#!/usr/bin/env node

import "dotenv/config";
import { purgeCache } from "../src/cloudflarePurge.mjs";

async function purgeUrl(url) {
  if (!url) {
    console.error("❌ Please provide a URL to purge");
    console.error("Usage: npm run purge:url -- https://news.kiwistand.com/path");
    process.exit(1);
  }

  // Validate URL
  try {
    const parsedUrl = new URL(url);
    if (!parsedUrl.hostname.includes('kiwistand.com')) {
      console.error("❌ URL must be a kiwistand.com domain");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Invalid URL format");
    process.exit(1);
  }

  // Temporarily set NODE_ENV to production to bypass the check
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";

  try {
    console.log(`🔄 Purging URL: ${url}`);
    await purgeCache(url);
    console.log("✅ Successfully purged from Cloudflare cache");
  } catch (error) {
    console.error("❌ Error purging cache:", error.message);
    process.exit(1);
  } finally {
    // Restore original NODE_ENV
    process.env.NODE_ENV = originalEnv;
  }
}

// Get URL from command line arguments
const url = process.argv[2];
purgeUrl(url);