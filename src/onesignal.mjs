import { env } from "process";
import log from "./logger.mjs";

const ONESIGNAL_APP_ID = env.ONESIGNAL_APP_ID || "8288dc28-3742-41fd-bd94-89bd7c47768c";
const ONESIGNAL_API_KEY = env.ONESIGNAL_API_KEY;

/**
 * Send push notification via OneSignal to users by their wallet addresses
 * @param {Array<string>} addresses - Array of wallet addresses (External User IDs)
 * @param {Object} notification - Notification content
 * @param {string} notification.title - Notification title
 * @param {string} notification.body - Notification body
 * @param {string} notification.url - URL to open when notification is clicked
 */
export async function sendPushNotification(addresses, notification) {
  if (!ONESIGNAL_API_KEY) {
    log("OneSignal API key not configured, skipping push notification");
    return;
  }

  if (!addresses || addresses.length === 0) {
    return;
  }

  // Convert addresses to lowercase (consistent with how we set them in iOS)
  const externalUserIds = addresses.map(addr => addr.toLowerCase());

  const payload = {
    app_id: ONESIGNAL_APP_ID,
    include_external_user_ids: externalUserIds,
    headings: { en: notification.title },
    contents: { en: notification.body },
    // Do NOT set `url` for iOS – it opens Safari.
    // Send the target as additional data and handle routing in-app.
    data: { url: notification.url },
    ios_badgeType: "Increase",
    ios_badgeCount: 1
  };

  try {
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    
    if (result.errors) {
      log(`OneSignal notification failed: ${JSON.stringify(result.errors)}`);
    } else {
      log(`OneSignal notification sent to ${externalUserIds.length} users: ${result.id}`);
    }
    
    return result;
  } catch (error) {
    log(`Failed to send OneSignal notification: ${error.message}`);
  }
}

/**
 * Send test notification to specific External User ID
 */
export async function sendTestNotification(address) {
  return sendPushNotification([address], {
    title: "Test Notification",
    body: "This is a test notification from Kiwi News",
    url: "https://news.kiwistand.com",
  });
}

/**
 * Send a broadcast push notification to all subscribed users in OneSignal
 * This targets the "Subscribed Users" segment which includes all users who
 * have opted in to notifications for the configured app.
 * @param {Object} notification - Notification content
 * @param {string} notification.title - Notification title
 * @param {string} notification.body - Notification body
 * @param {string} notification.url - URL to open when notification is clicked
 */
export async function sendBroadcastNotification(notification) {
  if (!ONESIGNAL_API_KEY) {
    log("OneSignal API key not configured, skipping broadcast push notification");
    return;
  }

  // Use filters to target all users who have subscribed (session_count > 0)
  // This is more reliable than segments for iOS
  const payload = {
    app_id: ONESIGNAL_APP_ID,
    filters: [
      { field: "session_count", relation: ">", value: "0" }
    ],
    headings: { en: notification.title },
    contents: { en: notification.body },
    // Do NOT set `url` for iOS – it opens Safari.
    data: { url: notification.url },
    ios_badgeType: "Increase",
    ios_badgeCount: 1,
  };

  try {
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (result.errors) {
      log(`OneSignal broadcast failed: ${JSON.stringify(result.errors)}`);
    } else {
      log(`OneSignal broadcast sent to ${result.recipients} users: ${result.id}`);
    }

    return result;
  } catch (error) {
    log(`Failed to send OneSignal broadcast: ${error.message}`);
  }
}
