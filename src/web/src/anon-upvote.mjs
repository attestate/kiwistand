// Anonymous upvotes in the browser: joining the Semaphore group and proving
// an upvote. See src/anon.mjs for the protocol rules.
//
// NOTE: This module pulls in Semaphore and snarkjs (several hundred KB) and
// downloads the proving artifacts (a few MB). Only import it dynamically,
// when the user opens the anonymous upvote sheet; nothing here may end up in
// the main bundle.
import { Group } from "@semaphore-protocol/group";
import { generateProof } from "@semaphore-protocol/proof";
import { Wallet } from "@ethersproject/wallet";

import * as API from "./API.mjs";
import { secretFromKey, storageKey } from "./semaphore-secret.mjs";
import { scopeOf, messageOf, identityFromSecret } from "./anon-core.mjs";
import * as passkey from "./passkey.mjs";

export { scopeOf, messageOf, identityFromSecret };

export const EIP712_ANON_JOIN_TYPES = {
  Message: [
    { name: "commitment", type: "uint256" },
    { name: "type", type: "string" },
    { name: "timestamp", type: "uint256" },
  ],
};

// Must match ARTIFACTS_VERSION in src/anon.mjs.
export const ARTIFACTS_VERSION = "4.13.0";
const API_PORT = 8443;

function apiUrl(endpoint) {
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:${API_PORT}${endpoint}`;
}

async function getJSON(endpoint) {
  const response = await fetch(apiUrl(endpoint));
  const body = await response.json();
  if (body.status !== "success") throw new Error(body.details || "Request failed");
  return body.data;
}

// The account's Semaphore secret: the PRF-derived one if this browser has it
// (passkey accounts), otherwise one derived from the stored key.
export function secretFor(account) {
  try {
    const stored = localStorage.getItem(storageKey(account.identity));
    if (stored) return { secret: stored, source: "passkey" };
  } catch (err) {}
  return { secret: secretFromKey(account.privateKey), source: "key" };
}

// A passkey account that signed in before anonymous upvotes existed has no
// PRF-derived secret yet. Asking the passkey once gives us one.
export async function secretFromPasskey(account) {
  const derived = await passkey.signIn();
  if (derived.address !== account.identity) {
    throw new Error("That passkey belongs to another account");
  }
  localStorage.setItem(storageKey(account.identity), derived.semaphoreSecret);
  return derived.semaphoreSecret;
}

export function isPasskeyAccount(account) {
  // NOTE: A passkey account's identity is the address of its own key.
  try {
    return (
      passkey.hasUsedPasskey() &&
      new Wallet(account.privateKey).address === account.identity
    );
  } catch (err) {
    return false;
  }
}

export async function fetchStatus(address) {
  return getJSON(`/api/v1/anon/status?address=${address}`);
}

export async function fetchGroup() {
  return getJSON(`/api/v1/anon/group`);
}

// Registers the identity's commitment, signed with the account's key.
export async function join({ account, secret }) {
  const identity = identityFromSecret(secret);
  const message = {
    commitment: identity.commitment.toString(),
    type: "anon-join",
    timestamp: Math.floor(Date.now() / 1000),
  };
  const signer = new Wallet(account.privateKey);
  const signature = await signer._signTypedData(
    API.EIP712_DOMAIN,
    EIP712_ANON_JOIN_TYPES,
    message,
  );
  const response = await API.send(message, signature);
  if (response.status !== "success") {
    throw new Error(response.details || "Joining failed");
  }
  return identity.commitment.toString();
}

async function download(url, onBytes) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Couldn't load ${url}`);
  const total = parseInt(response.headers.get("content-length"), 10) || 0;
  if (!response.body || !response.body.getReader) {
    const data = new Uint8Array(await response.arrayBuffer());
    onBytes(data.length, data.length);
    return data;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onBytes(value.length, total);
  }
  const data = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.length;
  }
  return data;
}

const artifactCache = new Map();
export async function loadArtifacts(depth, onProgress = () => {}) {
  if (artifactCache.has(depth)) return artifactCache.get(depth);
  const base = apiUrl(`/api/v1/anon/artifacts/${ARTIFACTS_VERSION}`);
  let loaded = 0;
  const totals = { wasm: 0, zkey: 0 };
  const track = (kind) => (bytes, total) => {
    loaded += bytes;
    totals[kind] = total;
    onProgress({ loaded, total: totals.wasm + totals.zkey });
  };
  const [wasm, zkey] = await Promise.all([
    download(`${base}/semaphore-${depth}.wasm`, track("wasm")),
    download(`${base}/semaphore-${depth}.zkey`, track("zkey")),
  ]);
  const artifacts = { wasm, zkey };
  artifactCache.set(depth, artifacts);
  return artifacts;
}

// Proves and sends an anonymous upvote of the story kiwi:0x<index>.
// onProgress receives { step: "group" | "download" | "prove" | "send", ... }.
export async function upvote({ secret, storyIndex, onProgress = () => {} }) {
  const href = `kiwi:0x${storyIndex.replace(/^0x/, "").toLowerCase()}`;
  const identity = identityFromSecret(secret);

  onProgress({ step: "group" });
  const data = await fetchGroup();
  const group = new Group(data.members);
  if (data.size === 0 || group.root.toString() !== data.root) {
    throw new Error("The group from the server doesn't match its root");
  }
  if (group.indexOf(identity.commitment) === -1) {
    throw new Error("You're not in the anonymous group yet");
  }
  const depth = Math.max(1, group.depth);

  onProgress({ step: "download", loaded: 0, total: 0 });
  const artifacts = await loadArtifacts(depth, (progress) =>
    onProgress({ step: "download", ...progress }),
  );

  onProgress({ step: "prove" });
  // NOTE: Let the browser paint the "proving" state before snarkjs takes the
  // main thread.
  await new Promise((resolve) => setTimeout(resolve, 50));
  const timestamp = Math.floor(Date.now() / 1000);
  const started = performance.now();
  const proof = await generateProof(
    identity,
    group,
    messageOf(href, timestamp),
    scopeOf(href),
    depth,
    artifacts,
  );
  const provingMs = Math.round(performance.now() - started);

  onProgress({ step: "send" });
  const message = {
    timestamp,
    type: "anon-upvote",
    href,
    depth: proof.merkleTreeDepth,
    merkleRoot: proof.merkleTreeRoot,
    nullifier: proof.nullifier,
    proof: proof.points.map((point) => point.toString()),
  };
  // NOTE: An anonymous upvote has no signature.
  const response = await API.send(message, undefined);
  if (response.status !== "success") {
    throw new Error(response.details || "Upvote failed");
  }
  return { message, provingMs };
}
