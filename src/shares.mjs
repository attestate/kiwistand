// @format
// Shares count towards a story's hot ranking (see src/views/feed.mjs), so
// /share only records ones that are signed like the requests in
// bookmarks.mjs:
//
//   { type: "share", href: <story href>, title: <channel, e.g. "native">, timestamp }
//
// The message only authorizes the request, it isn't stored in the protocol.
// A share is recorded with the signer's identity as its hash, so each account
// counts once per story. Any fresh key resolves to itself as an identity, so
// only accounts with at least MIN_SHARE_KARMA karma count.
import * as bookmarks from "./bookmarks.mjs";
import { KARMA } from "./imageuploads.mjs";

export const TYPE = "share";
export const MIN_SHARE_KARMA = KARMA;

// Throws with a message meant for the client when the signature isn't valid.
// Resolves to the identity to record the share for, or null when its karma
// is too low.
export async function authorize(message, karmaOf, now) {
  const identity = await bookmarks.verify(message, [TYPE], now);
  if (karmaOf(identity) < MIN_SHARE_KARMA) return null;
  return identity;
}
