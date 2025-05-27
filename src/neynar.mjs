import {
  NeynarAPIClient,
  Configuration,
  isApiErrorResponse,
} from "@neynar/nodejs-sdk";
import { countImpressions } from "./cache.mjs";

const config = new Configuration({
  apiKey: process.env.NEYNAR_API_KEY,
});

const client = new NeynarAPIClient(config);

export async function fetchBulkUsersByEthAddress(address) {
  try {
    const resp = await client.fetchBulkUsersByEthOrSolAddress({addresses: [address]});
    return resp;
  } catch (error) {
    if (isApiErrorResponse(error)) {
      return {
        status: "error",
        code: error.response.status,
        message: "API Error",
        details: error.response.data,
      };
    }
    throw error;
  }
}

export async function sendNotification(target_url, body, title) {
  const notification = { title, body, target_url };
  try {
    const resp = await client.publishFrameNotifications({
      targetFids: [],
      notification,
    });
    return resp;
  } catch (error) {
    if (isApiErrorResponse(error)) {
      return {
        status: "error",
        code: error.response.status,
        message: "API Error",
        details: error.response.data,
      };
    }
    throw error;
  }
}
