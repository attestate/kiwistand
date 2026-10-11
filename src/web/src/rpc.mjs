// @format
// NOTE: How the browser reaches the chain. This file is in the main bundle, so
// it must stay tiny and import nothing heavy: the anon-rpc harness is only
// loaded (via loadAnon) once a visitor turned "Private RPC" on and a read
// actually happens.
//
// - Reads that Kiwi's own API can answer (ENS names) don't go to a public RPC
//   at all, see createKiwiEnsActions.
// - All other reads go to the public RPC directly (default) or, with Private
//   RPC on, through an anon-rpc worker (see anon-transport.mjs).
// - Writes and signatures never pass through here: they go to the user's
//   wallet (connector), as before.

export const RPC_URLS = {
  10: "https://mainnet.optimism.io",
  1: "https://ethereum-rpc.publicnode.com",
};

export const PRIVATE_RPC_KEY = "kiwi-private-rpc";
export const PRIVATE_RPC_FALLBACK_KEY = "kiwi-private-rpc-fallback";

const safeStorage = (storage) => {
  if (storage !== undefined) return storage;
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch (err) {
    return null;
  }
};

export function readRpcSettings(storage) {
  const s = safeStorage(storage);
  if (!s) return { privateRpc: false, allowFallback: false };
  try {
    return {
      privateRpc: s.getItem(PRIVATE_RPC_KEY) === "true",
      allowFallback: s.getItem(PRIVATE_RPC_FALLBACK_KEY) === "true",
    };
  } catch (err) {
    return { privateRpc: false, allowFallback: false };
  }
}

export function writeRpcSettings(patch, storage) {
  const s = safeStorage(storage);
  if (!s) return readRpcSettings(storage);
  const set = (key, value) =>
    value ? s.setItem(key, "true") : s.removeItem(key);
  if ("privateRpc" in patch) set(PRIVATE_RPC_KEY, patch.privateRpc);
  if ("allowFallback" in patch) set(PRIVATE_RPC_FALLBACK_KEY, patch.allowFallback);
  return readRpcSettings(s);
}

export function routeFor(settings) {
  return settings.privateRpc ? "anon" : "direct";
}

export class PrivateRpcUnavailableError extends Error {
  constructor(cause) {
    super(
      `Private RPC is unavailable (${cause?.message ?? cause}). ` +
        "Turn on the direct fallback or turn Private RPC off in the menu.",
    );
    this.name = "PrivateRpcUnavailableError";
    // EIP-1193 "disconnected": viem doesn't retry it, and retrying wouldn't
    // help while the anon-rpc worker is down.
    this.code = 4900;
    this.cause = cause;
  }
}

// NOTE: An error the RPC endpoint itself answered with (e.g. a revert) made it
// through the private route, so it's a real answer. Re-sending that request
// directly would leak it for nothing.
export const isRpcResponseError = (err) =>
  Boolean(err && err.rpcResponse === true);

// Returns an EIP-1193 style request function that routes every call according
// to the settings at the time of the call.
//
// direct:     ({ method, params }) => Promise   the public RPC
// loadAnon:   () => Promise<({ method, params }) => Promise>
// onFallback: (err) => void    a private read failed and went out directly
// onError:    (err) => void    a private read failed and was not sent
export function createRoutedRequest({
  getSettings = readRpcSettings,
  direct,
  loadAnon,
  onFallback,
  onError,
}) {
  return async function request(args) {
    const settings = getSettings();
    if (routeFor(settings) === "direct") return direct(args);

    try {
      const anon = await loadAnon();
      return await anon(args);
    } catch (err) {
      if (isRpcResponseError(err)) throw err;
      if (settings.allowFallback) {
        onFallback?.(err);
        return direct(args);
      }
      const wrapped = new PrivateRpcUnavailableError(err);
      onError?.(wrapped);
      throw wrapped;
    }
  };
}

// NOTE: wagmi looks up `getEnsName`/`getEnsAvatar` on the client before using
// viem's own action (see viem's getAction), so extending the mainnet client
// with these answers RainbowKit's ENS lookups of the connected wallet from
// Kiwi's /api/v1/profile endpoint. The server resolves ENS with its own RPC,
// so the public RPC no longer sees "this IP owns this address".
export function createKiwiEnsActions({ fetchFn = fetch, origin = "" } = {}) {
  const profiles = new Map();
  const avatars = new Map();

  const profile = (address) => {
    const key = String(address).toLowerCase();
    if (!profiles.has(key)) {
      const pending = fetchFn(`${origin}/api/v1/profile/${address}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((body) => body?.data ?? null)
        .catch(() => null)
        .then((data) => {
          // A miss (e.g. the server hadn't resolved it yet) isn't cached.
          if (!data?.ens) profiles.delete(key);
          return data;
        });
      profiles.set(key, pending);
    }
    return profiles.get(key);
  };

  return {
    async getEnsName({ address }) {
      if (!address) return null;
      const data = await profile(address);
      if (!data?.ens) return null;
      if (data.safeAvatar && data.safeAvatar.startsWith("https://")) {
        avatars.set(data.ens, data.safeAvatar);
      }
      return data.ens;
    },
    async getEnsAvatar({ name }) {
      return avatars.get(name) ?? null;
    },
  };
}
