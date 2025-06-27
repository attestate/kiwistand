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


export async function sendNotification(target_url, body, title, targetFids = []) {
  const notification = { title, body, target_url };
  
  // Only send notifications in production
  if (process.env.NODE_ENV !== "production") {
    console.log("[DEV MODE] Would send notification:", notification);
    return {
      status: "success",
      message: "Notification simulated in dev mode",
      notification
    };
  }
  
  try {
    const resp = await client.publishFrameNotifications({
      targetFids,
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

export async function getFidsFromAddresses(addresses) {
  if (!addresses || addresses.length === 0) return [];
  
  try {
    const resp = await client.fetchBulkUsersByEthOrSolAddress({addresses});
    const fids = [];
    
    for (const address of addresses) {
      const userData = resp[address.toLowerCase()];
      if (userData && userData.length > 0) {
        fids.push(userData[0].fid);
      }
    }
    
    return fids;
  } catch (error) {
    console.error("Error fetching FIDs from addresses:", error);
    return [];
  }
}
