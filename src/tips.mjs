import { env } from "process";
import path from "path";

import { fetchBuilder, FileSystemCache } from "node-fetch-cache";

const fetch = fetchBuilder.withCache(
  new FileSystemCache({
    cacheDirectory: path.resolve(env.CACHE_DIR),
    ttl: 60, // 1 min
  }),
);

const USER_TIP_GET_ENDPOINT = "https://getusertips-zl7caqyemq-uc.a.run.app?user=";
const TOTAL_TIP_GET_ENDPOINT = "https://gettips-zl7caqyemq-uc.a.run.app";
const TIP_API_KEY = "73yZ9m4JJccccsm0L6HNPanQm";

export async function getUserTips(address) {
  try {
    // 1. Fetch tips from the API
    const response = await fetch(`${USER_TIP_GET_ENDPOINT}${address}`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TIP_API_KEY}`,
      },
    });

    // 2. Get the data from the response
    const data = await response.json();

    // 3. Check if the response is valid
    if (!data || !data.success || !data.data) {
      return [];
    }

    // 4. Return the formatted tips
    return data.data.map(({ from, to, usdAmount, timestamp, blockExplorerUrl, metadata }) => ({
      from,
      to,
      timestamp: timestamp._seconds,
      amount: usdAmount,
      message: `You have been tipped with $${usdAmount} USD`,
      blockExplorerUrl,
      index: metadata.index,
      title: metadata.title,
    }));
  } catch (error) {
    console.error("Fetching tips failed:", error);
    return [];
  }
}

export async function getTips() {
  try {
    // 1. Fetch tips from the API
    const response = await fetch(`${TOTAL_TIP_GET_ENDPOINT}`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TIP_API_KEY}`,
      },
    });

    // 2. Get the data from the response
    const data = await response.json();

    // 3. Check if the response is valid
    if (!data || !data.success || !data.data) {
      return [];
    }

    const receiver = data.data.receivers;
    return receiver ? receiver : 0;
  } catch (error) {
    console.error("Fetching tips failed:", error);
    return [];
  }
}
