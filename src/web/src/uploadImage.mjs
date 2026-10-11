// Uploads a picture to Cloudflare Images through a one-time upload URL from
// our backend and returns its public URL, e.g.
// https://imagedelivery.net/[account hash]/[image id]/public
export async function uploadImage(file) {
  const tokenResponse = await fetch("/api/v1/image-upload-token");
  if (!tokenResponse.ok) throw new Error("Failed to get upload token");
  const token = await tokenResponse.json();
  const { uploadURL, id } = token.data;

  const form = new FormData();
  form.append("file", file);
  const upload = await fetch(uploadURL, { method: "POST", body: form });
  if (!upload.ok) throw new Error("Failed to upload image");

  const hash = uploadURL.split("/").slice(-2)[0];
  return `https://imagedelivery.net/${hash}/${id}/public`;
}
