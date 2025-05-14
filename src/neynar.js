import Neynar from "@neynar/nodejs-sdk";
import { countImpressions } from "./cache.mjs";

const client = new Neynar({ apiKey: process.env.NEYNAR_API_KEY });

export async function sendEditorsPick(index, title) {
  const { notification_tokens } =
    await client.fetchNotificationTokens({ limit: 100 });
  const fids = notification_tokens.map((t) => t.fid);

  const notification = {
    title: "Kiwi News Editor’s pick",
    body: title,
    target_url:
      `https://news.kiwistand.com/redirect/${index}` +
      `?utm_source=warpcast&utm_medium=notification&utm_campaign=editor_pick`
  };

  const resp = await client.publishFrameNotifications({
    targetFids: fids,
    notification
  });

  resp.successfulTokens.forEach(() =>
    countImpressions(notification.target_url)
  );

  return resp;
}
