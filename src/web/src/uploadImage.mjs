import { EIP712_DOMAIN, EIP712_TYPES, messageFab } from "./API.mjs";

// Uploads a picture to Cloudflare Images through a one-time upload URL from
// our backend and returns its public URL, e.g.
// https://imagedelivery.net/[account hash]/[image id]/public
//
// The backend only hands out URLs for a signed "image-upload" message and
// limits how many per day (src/imageuploads.mjs). The signer is the local
// Kiwi key (passkey account or delegated key) or else the wallet.
export async function uploadImage(file, signer) {
  if (!signer) throw new Error("Connect your wallet to upload images");
  const message = messageFab("", "", "image-upload");
  const signature = await signer._signTypedData(
    EIP712_DOMAIN,
    EIP712_TYPES,
    message,
  );
  const tokenResponse = await fetch("/api/v1/image-upload-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...message, signature }),
  });
  const token = await tokenResponse.json().catch(() => ({}));
  // NOTE: details is e.g. "You can upload up to 3 images a day" on a 429.
  if (!tokenResponse.ok || token.status !== "success") {
    throw new Error(token.details || "Failed to get upload token");
  }
  const { uploadURL, id } = token.data;

  const form = new FormData();
  form.append("file", file);
  const upload = await fetch(uploadURL, { method: "POST", body: form });
  if (!upload.ok) throw new Error("Failed to upload image");

  const hash = uploadURL.split("/").slice(-2)[0];
  return `https://imagedelivery.net/${hash}/${id}/public`;
}
