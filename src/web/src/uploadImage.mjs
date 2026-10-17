// Uploads a picture to Cloudflare Images through a one-time upload URL from
// our backend and returns its public URL, e.g.
// https://imagedelivery.net/[account hash]/[image id]/public
//
// With this browser's delegated key (a signed-in account, not anon mode) the
// upload URL is requested with a signed message (POST), which the server
// limits per account; otherwise anonymously (GET), limited per IP. See
// src/imageupload.mjs.
import { EIP712_DOMAIN, EIP712_TYPES, messageFab } from "./API.mjs";
import { bookmarkAccount } from "./bookmarks.mjs";

// Cloudflare Images' limit for one picture.
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

async function signedTokenRequest(account) {
  const { Wallet } = await import("@ethersproject/wallet");
  const message = messageFab("", "", "imageupload");
  const signature = await new Wallet(account.privateKey)._signTypedData(
    EIP712_DOMAIN,
    EIP712_TYPES,
    message,
  );
  return fetch("/api/v1/image-upload-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...message, signature }),
  });
}

async function requestToken() {
  let response;
  let account = null;
  try {
    account = bookmarkAccount();
  } catch {}
  if (account) {
    try {
      response = await signedTokenRequest(account);
    } catch {
      response = null;
    }
  }
  // NOTE: A key the server doesn't know yet (delegation not synced) falls
  // back to the anonymous request.
  if (!response || (!response.ok && response.status !== 429)) {
    response = await fetch("/api/v1/image-upload-token");
  }
  if (response.status === 429) {
    throw new Error("Too many uploads. Please try again later.");
  }
  if (response.status === 401) {
    throw new Error("Please sign in to upload pictures.");
  }
  if (!response.ok) throw new Error("Failed to get upload token");
  return response.json();
}

export async function uploadImage(file) {
  if (!file || !file.type || !file.type.startsWith("image/")) {
    throw new Error("Please select an image file");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Pictures can be up to 10 MB.");
  }
  const token = await requestToken();
  const { uploadURL, id } = token.data;

  const form = new FormData();
  form.append("file", file);
  const upload = await fetch(uploadURL, { method: "POST", body: form });
  if (!upload.ok) throw new Error("Failed to upload image");

  const hash = uploadURL.split("/").slice(-2)[0];
  return `https://imagedelivery.net/${hash}/${id}/public`;
}
