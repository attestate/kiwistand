// Required environment variables:
// - FC_SEED_PHRASE: Farcaster account seed phrase for posting casts
// - CONSUMER_KEY: Twitter API consumer key
// - CONSUMER_SECRET: Twitter API consumer secret
// - TWITTER_ACCESS_TOKEN: Twitter access token (obtained via OAuth flow)
// - TWITTER_ACCESS_TOKEN_SECRET: Twitter access token secret (obtained via OAuth flow)

import crypto from "crypto";
import qs from "querystring";
import { createInterface } from "readline";
import { env } from "process";
import OAuth from "oauth-1.0a";
import log from "./logger.mjs";

const readline = createInterface({
  input: process.stdin,
  output: process.stdout,
});

const consumer_key = env.CONSUMER_KEY;
const consumer_secret = env.CONSUMER_SECRET;

const endpointURL = `https://api.twitter.com/2/tweets`;

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
  return new Promise(async (resolve, reject) => {
    readline.question(prompt, (out) => {
      readline.close();
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
    throw new Error("Cannot get an OAuth request token");
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
    throw new Error("Cannot get an OAuth access token");
  }
}

async function getRequest({ oauth_token, oauth_token_secret }, tweet) {
  const token = {
    key: oauth_token,
    secret: oauth_token_secret,
  };

  const authHeader = oauth.toHeader(
    oauth.authorize(
      {
        url: endpointURL,
        method: "POST",
      },
      token
    )
  );

  const response = await fetch(endpointURL, {
    method: "POST",
    headers: {
      Authorization: authHeader["Authorization"],
      "user-agent": "v2CreateTweetJS",
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(tweet),
  });

  if (response.ok) {
    return response.json();
  } else {
    throw new Error("Unsuccessful request");
  }
}

async function login() {
  // Get request token
  const oAuthRequestToken = await requestToken();
  // Get authorization
  authorizeURL.searchParams.append(
    "oauth_token",
    oAuthRequestToken.oauth_token
  );
  console.log("Please go here and authorize:", authorizeURL.href);
  const pin = await input("Paste the PIN here: ");
  // Get the access token
  return await accessToken(oAuthRequestToken, pin.trim());
}

export async function sendTweet(tweet) {
  try {
    // Check if we have the access tokens in env vars
    if (!env.TWITTER_ACCESS_TOKEN || !env.TWITTER_ACCESS_TOKEN_SECRET) {
      log("Twitter access tokens not found. Run the OAuth flow to get them.");
      return { success: false, error: "Twitter not configured" };
    }

    const token = {
      oauth_token: env.TWITTER_ACCESS_TOKEN,
      oauth_token_secret: env.TWITTER_ACCESS_TOKEN_SECRET,
    };

    const response = await getRequest(token, { text: tweet });
    log(`Tweet sent successfully: ${tweet.substring(0, 50)}...`);
    return { success: true, data: response };
  } catch (error) {
    log(`Failed to send tweet: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Warpcast API implementation using seed phrase
async function generateWarpcastToken() {
  const { utils, Wallet } = await import("ethers");
  const startTimestamp = Date.now();

  const body = JSON.stringify({
    method: "generateToken",
    params: {
      expiresAt: startTimestamp + 1000 * 60 * 60 * 24, // 24h
      timestamp: startTimestamp,
    },
  });

  const signature = Buffer.from(
    utils.arrayify(
      await Wallet.fromMnemonic(env.FC_SEED_PHRASE).signMessage(body)
    )
  ).toString("base64");

  const authResponse = await fetch("https://api.warpcast.com/v2/auth", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer eip191:${signature}`,
    },
    body,
  });

  const data = await authResponse.json();
  if (!authResponse.ok) {
    throw new Error(`Warpcast auth failed: ${JSON.stringify(data)}`);
  }

  return data.result.token.secret;
}

async function postCastViaWarpcast(text, embeds) {
  const bearerToken = await generateWarpcastToken();
  const url = "https://api.warpcast.com/v2/casts";
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${bearerToken}`,
    "Content-Type": "application/json",
  };
  
  const body = JSON.stringify({
    text,
    embeds,
  });

  const response = await fetch(url, { method: "POST", headers, body });
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`Warpcast cast failed: ${JSON.stringify(data)}`);
  }
  
  return data;
}

export async function sendCast(text, embeds = []) {
  try {
    if (!env.FC_SEED_PHRASE) {
      log("FC_SEED_PHRASE not configured");
      return { success: false, error: "Farcaster not configured" };
    }

    const response = await postCastViaWarpcast(text, embeds);
    log(`Cast sent successfully: ${text.substring(0, 50)}...`);
    return { success: true, data: response };
  } catch (error) {
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