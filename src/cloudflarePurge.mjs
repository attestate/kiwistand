import fetch from "node-fetch";
import log from "./logger.mjs";

/**
 * Purges Cloudflare cache for the specified URL.
 * Requires the environment variables:
 *   CF_API_TOKEN - Your Cloudflare API token.
 *   CF_ZONE_ID   - Your Cloudflare Zone ID.
 *
 * @param {string} url - The URL to purge from Cloudflare's cache.
 * @returns {Promise<Object>} - The JSON response from Cloudflare API.
 * @throws {Error} If the purge fails or credentials are missing.
 */
export async function purgeCache(url) {
  const token = process.env.CF_API_TOKEN;
  const zoneId = process.env.CF_ZONE_ID;
  if (process.env.NODE_ENV !== "production") {
    log("Cloudflare purge skipped: Not in production environment");
    return;
  }
  if (!token || !zoneId) {
    log("Cloudflare purge skipped: Missing API token or zone ID");
    return;
  }
  const purgeUrl = `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`;
  const body = { files: [url] };
  const response = await fetch(purgeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!data.success) {
    throw new Error(`Failed to purge cache: ${JSON.stringify(data)}`);
  }
  log(`Successfully purged: ${url}`);
  return data;
}
