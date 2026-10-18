// @format
// Shares are recorded through /share with a Kiwi message signed by this
// browser's delegated key (see src/shares.mjs), so sharing never prompts a
// wallet. Without a local key the share isn't reported.
import { EIP712_DOMAIN, EIP712_TYPES, messageFab } from "./API.mjs";
import { getCookie, getLocalAccount } from "./session.mjs";

export async function trackShare(href, channel) {
  const account = getLocalAccount(getCookie("identity"));
  if (!href || !account || !account.privateKey) return;
  const { Wallet } = await import("@ethersproject/wallet");
  const wallet = new Wallet(account.privateKey);
  const message = messageFab(channel, href, "share");
  const signature = await wallet._signTypedData(
    EIP712_DOMAIN,
    EIP712_TYPES,
    message,
  );
  // NOTE: keepalive lets the request finish when sharing navigates away;
  // sendBeacon can't reliably send a JSON content type.
  await fetch("/share", {
    method: "POST",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...message, signature }),
  });
}
