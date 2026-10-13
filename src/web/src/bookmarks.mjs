// @format
// Saved stories on the website, through the existing signed API
// (src/bookmarks.mjs, /api/v1/bookmarks and /api/v1/bookmarks/list), the
// same one the iOS app uses. Requests are Kiwi messages signed with this
// browser's delegated key, like upvotes, so saving needs no wallet prompt.
import { EIP712_DOMAIN, EIP712_TYPES, messageFab } from "./API.mjs";
import { getCookie, getLocalAccount } from "./session.mjs";

const CACHE_KEY = "kiwi-saved-stories";

const norm = (index) => String(index || "").replace(/^0x/, "").toLowerCase();

// The account that can save, or null (logged out, or anon mode: its keys
// aren't linked to an account).
export function bookmarkAccount() {
  if (localStorage.getItem("anon-mode") === "true") return null;
  const account = getLocalAccount(getCookie("identity"));
  return account && account.privateKey ? account : null;
}

async function sign(account, message) {
  const { Wallet } = await import("@ethersproject/wallet");
  const wallet = new Wallet(account.privateKey);
  return wallet._signTypedData(EIP712_DOMAIN, EIP712_TYPES, message);
}

async function post(path, message, signature) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...message, signature }),
  });
  let json = null;
  try {
    json = await response.json();
  } catch {}
  if (!response.ok || !json || json.status !== "success") {
    throw new Error((json && json.details) || "Something went wrong");
  }
  return json.data;
}

// NOTE: Which stories this browser's account saved, so the bookmark buttons
// in the feeds show it without a request on every page.
export function cachedIndexes() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (cached && cached.identity === getCookie("identity")) return cached;
  } catch {}
  return null;
}

function writeCache(indexes) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        identity: getCookie("identity"),
        at: Date.now(),
        indexes: [...new Set(indexes.map(norm))],
      }),
    );
  } catch {}
}

export function isSaved(index) {
  const cached = cachedIndexes();
  return Boolean(cached && cached.indexes.includes(norm(index)));
}

// Newest first: [{ index, title, href, timestamp, savedAt, commentCount, ... }]
export async function listBookmarks(account) {
  const message = messageFab("", "", "bookmarks");
  const signature = await sign(account, message);
  const data = await post("/api/v1/bookmarks/list", message, signature);
  const stories = (data && data.stories) || [];
  writeCache(stories.map((story) => story.index));
  return stories;
}

export async function setBookmark(account, index, saved) {
  const message = messageFab(
    "",
    `kiwi:0x${norm(index)}`,
    saved ? "bookmark" : "unbookmark",
  );
  const signature = await sign(account, message);
  await post("/api/v1/bookmarks", message, signature);
  const cached = cachedIndexes();
  const indexes = cached ? cached.indexes : [];
  writeCache(
    saved
      ? [norm(index), ...indexes]
      : indexes.filter((item) => item !== norm(index)),
  );
}
