import { env } from "process";
import path from "path";

import { fetchBuilder, FileSystemCache } from "node-fetch-cache";

const fetch = fetchBuilder.withCache(
    new FileSystemCache({
      cacheDirectory: path.resolve(env.CACHE_DIR),
      ttl: 86400000, // 24 hours
    }),
);

const TIP_GET_ENDPOINT = "https://getusertips-zl7caqyemq-uc.a.run.app?user=";
const TIP_API_KEY = "73yZ9m4JJccccsm0L6HNPanQm";

export async function getTips(address) {
    try {
      const response = await fetch(`${TIP_GET_ENDPOINT}${address}`, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${TIP_API_KEY}`
        },
      });
  
      const data = await response.json();
  
      console.log("tips1", data);

      if (!data || !data.success || !data.data) {
        return [];
      }

      console.log("tips2", data.data);
  
      return data.data.map(({ from, to, usdAmount, timestamp }) => ({
          from,
          to,
          timestamp: timestamp._seconds,
          amount: usdAmount,
          message: `You have been tipped with $${usdAmount} USD`,
      }));
    } catch (error) {
      console.error('Fetching tips failed:', error);
      return [];
    }
  }