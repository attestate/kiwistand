#!/usr/bin/env node

import "dotenv/config";
import crypto from "crypto";
import qs from "querystring";
import { createInterface } from "readline";
import { env } from "process";
import OAuth from "oauth-1.0a";

const readline = createInterface({
  input: process.stdin,
  output: process.stdout,
});

const consumer_key = env.CONSUMER_KEY;
const consumer_secret = env.CONSUMER_SECRET;

if (!consumer_key || !consumer_secret) {
  console.error("❌ Missing CONSUMER_KEY or CONSUMER_SECRET in .env");
  process.exit(1);
}

const requestTokenURL =
  "https://api.twitter.com/oauth/request_token?oauth_callback=oob&x_auth_access_type=write";
const authorizeURL = new URL("https://api.twitter.com/oauth/authorize");
const accessTokenURL = "https://api.twitter.com/oauth/access_token";

const oauth = OAuth({
  consumer: {
    key: consumer_key,
    secret: consumer_secret,
  },
  signature_method: "HMAC-SHA1",
  hash_function: (baseString, key) =>
    crypto.createHmac("sha1", key).update(baseString).digest("base64"),
});

async function input(prompt) {
  return new Promise((resolve) => {
    readline.question(prompt, (out) => {
      resolve(out);
    });
  });
}

async function requestToken() {
  const authHeader = oauth.toHeader(
    oauth.authorize({
      url: requestTokenURL,
      method: "POST",
    })
  );

  const response = await fetch(requestTokenURL, {
    method: "POST",
    headers: {
      Authorization: authHeader["Authorization"],
    },
  });
  
  if (response.ok) {
    const body = await response.text();
    return qs.parse(body);
  } else {
    const error = await response.text();
    throw new Error(`Cannot get OAuth request token: ${response.status} - ${error}`);
  }
}

async function accessToken({ oauth_token, oauth_token_secret }, verifier) {
  const authHeader = oauth.toHeader(
    oauth.authorize({
      url: accessTokenURL,
      method: "POST",
    })
  );
  const path = `https://api.twitter.com/oauth/access_token?oauth_verifier=${verifier}&oauth_token=${oauth_token}`;
  const response = await fetch(path, {
    method: "POST",
    headers: {
      Authorization: authHeader["Authorization"],
    },
  });
  
  if (response.ok) {
    const body = await response.text();
    return qs.parse(body);
  } else {
    const error = await response.text();
    throw new Error(`Cannot get OAuth access token: ${response.status} - ${error}`);
  }
}

async function login() {
  console.log("🐦 Starting Twitter OAuth flow...\n");
  
  // Get request token
  console.log("📡 Getting request token...");
  const oAuthRequestToken = await requestToken();
  
  // Get authorization
  authorizeURL.searchParams.append(
    "oauth_token",
    oAuthRequestToken.oauth_token
  );
  
  console.log("\n🔗 Please go here and authorize:");
  console.log(authorizeURL.href);
  console.log("\n");
  
  const pin = await input("📌 Paste the PIN here: ");
  
  // Get the access token
  console.log("\n🔑 Getting access token...");
  const token = await accessToken(oAuthRequestToken, pin.trim());
  
  console.log("\n✅ Success! Add these to your .env file:\n");
  console.log(`TWITTER_ACCESS_TOKEN=${token.oauth_token}`);
  console.log(`TWITTER_ACCESS_TOKEN_SECRET=${token.oauth_token_secret}`);
  
  if (token.screen_name) {
    console.log(`\n👤 Authorized as @${token.screen_name}`);
  }
  
  readline.close();
  process.exit(0);
}

login().catch(error => {
  console.error("\n❌ Error:", error.message);
  process.exit(1);
});