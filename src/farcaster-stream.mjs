import {
  getSSLHubRpcClient, // Corrected: SSL is uppercase
  HubEventType,
  isCastAddMessage,
} from "@farcaster/hub-nodejs";

// Switching back to Pinata's public Hub as requested
// https://docs.pinata.cloud/farcaster/hubs
const HUB_URL = "hub-grpc.pinata.cloud"; // Pinata's Hub hostname
const client = getSSLHubRpcClient(HUB_URL);

console.log(`Connecting to Farcaster Hub: ${HUB_URL} (default SSL port 443)`);

async function main() {
  // The SubscribeRequest type isn't needed here, just the object literal
  const subRequest = {
    eventTypes: [HubEventType.HUB_EVENT_TYPE_MERGE_MESSAGE],
  };

  // Add a timeout for the initial connection attempt for better feedback
  const deadline = Date.now() + 10000; // 10 seconds from now
  try {
    await client.$.waitForReady(deadline);
    console.log("Successfully connected to Hub.");
  } catch (error) {
    // This is where the certificate error previously occurred with Pinata
    console.error(`Failed to connect to Hub within deadline: ${error}`);
    client.close();
    return;
  }

  const streamResult = await client.subscribe(subRequest);

  if (streamResult.isErr()) {
    console.error("Failed to subscribe:", streamResult.error);
    client.close();
    return;
  }

  const stream = streamResult.value;
  console.log("Subscribed to Hub events. Waiting for new casts...");

  for await (const event of stream) {
    // Check if it's a MERGE_MESSAGE event, which contains the actual Farcaster message
    if (event.type === HubEventType.HUB_EVENT_TYPE_MERGE_MESSAGE) {
      // Ensure mergeMessageBody and message exist
      const message = event.mergeMessageBody?.message;

      // Check if the merged message is a CastAdd
      if (message && isCastAddMessage(message)) {
        // Safely access castAddBody and its properties
        const castText = message.data?.castAddBody?.text;
        const fid = message.data?.fid;

        // Only log if castText is not empty or undefined
        if (castText) {
          console.log(`FID ${fid}: ${castText}\n---`);
        }
      }
    }
  }

  console.log("Stream ended.");
  client.close();
}

main().catch((err) => {
  console.error("Error in main loop:", err);
  // Ensure client is closed even if waitForReady fails or other errors occur
  try {
    client.close();
  } catch (closeErr) {
    // Ignore errors during close if already handling another error
  }
  process.exit(1);
});

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("Received SIGINT. Closing connection...");
  client.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("Received SIGTERM. Closing connection...");
  client.close();
  process.exit(0);
});
