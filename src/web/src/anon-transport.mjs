// @format
// NOTE: Loaded with import() only when a visitor turned "Private RPC" on and a
// read happens; never part of the initial bundle.
//
// anon-rpc (https://github.com/ethereum/anon-rpc, spec 0.3.2): the harness
// reads a specifier contract on mainnet, downloads the anon-client bundle it
// names, runs it only if keccak256(bytes) matches the pinned hash, and runs it
// in a Web Worker inside a null-origin sandboxed iframe. We get back a fetch
// that the worker carries over its anonymity network (Tor for tor-js), and
// send plain JSON-RPC through it to the same public endpoints as before.
import { AnonRpcWorker } from "@anon-rpc/browser-harness";

import { RPC_URLS } from "./rpc.mjs";
import { ANON_RPC_URLS, fetchWithFailover } from "./anon-endpoints.mjs";

// From anon-rpc's adopters.json5.
export const ANON_NETWORKS = {
  tor: {
    label: "tor-js (Tor)",
    specifier: "0x700dA3193D35fA54Cd3fBf29B66f2a2A0385659e",
    anonymizes: true,
    // NOTE: anon-rpc's demonstration gateway. Browsers can't open raw TCP, so
    // a KPS gateway (WebRTC) relays blindly into Tor. It "may disappear at any
    // time": Kiwi needs to run its own (or several) before this ships to
    // everyone. Override at build time with VITE_ANON_RPC_GATEWAYS
    // (comma separated, "ip:port:certhash").
    config: {
      gateways: ["152.236.3.22:12298:uEiCH0VdbhryzJcMtCfB0vLA4sOvHdQ4hq5w7CopcwU59bQ"],
    },
  },
  // The reference worker: real sandbox and hash pinning, but it fulfils calls
  // with an ordinary fetch, so it does NOT anonymize. Only for local testing
  // (VITE_ANON_RPC_NETWORK=passthrough).
  passthrough: {
    label: "passthrough (not anonymous)",
    specifier: "0x4fd77be300f31c5fe6ab266d35d27750a3478d27",
    anonymizes: false,
    config: undefined,
  },
};

// Tor builds circuits before the first answer; the harness itself has no boot
// timeout, so a silent worker would hang every read.
export const BOOT_TIMEOUT_MS = 90_000;

const env = (typeof import.meta !== "undefined" && import.meta.env) || {};

export function selectNetwork(name = env.VITE_ANON_RPC_NETWORK) {
  const network = ANON_NETWORKS[name || "tor"];
  if (!network) throw new Error(`Unknown anon-rpc network "${name}"`);
  if (network === ANON_NETWORKS.tor && env.VITE_ANON_RPC_GATEWAYS) {
    return {
      ...network,
      config: { gateways: env.VITE_ANON_RPC_GATEWAYS.split(",").map((s) => s.trim()) },
    };
  }
  return network;
}

// The one read that can't be anonymized: before the worker exists, the harness
// reads workerHash()/workerResolvers() of the specifier from a normal RPC. It
// reveals that this IP uses anon-rpc, not what it reads.
const bootstrapProvider = {
  async request({ method, params }) {
    const res = await fetch(RPC_URLS[1], {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    const body = await res.json();
    if (body.error) throw new Error(body.error.message ?? "bootstrap rpc error");
    return body.result;
  },
};

// After a failed boot, reads fail fast for this long instead of each one
// re-reading the specifier and re-downloading the worker.
export const BOOT_RETRY_MS = 60_000;

let current;
let lastFailure;

function bootWorker(network) {
  const worker = new AnonRpcWorker({
    address: network.specifier,
    config: network.config,
    preExisting: { rpcProvider: bootstrapProvider },
  });
  if (!network.anonymizes) {
    console.warn(`anon-rpc: using ${network.label}; requests are NOT anonymized`);
  }
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`anon-rpc worker not ready after ${BOOT_TIMEOUT_MS / 1000}s`)),
      BOOT_TIMEOUT_MS,
    );
  });
  const ready = Promise.race([worker.ready, timeout])
    .then(() => worker)
    .catch((err) => {
      worker.close();
      throw err;
    })
    .finally(() => clearTimeout(timer));
  return ready;
}

// One long-lived worker per page (the spec asks for that), shared by all
// chains. A failed boot is forgotten so a later read can try again.
export function getWorker(network = selectNetwork(), now = Date.now) {
  if (!current && lastFailure && now() - lastFailure.at < BOOT_RETRY_MS) {
    return Promise.reject(lastFailure.err);
  }
  if (!current) {
    current = bootWorker(network).catch((err) => {
      current = undefined;
      lastFailure = { at: now(), err };
      throw err;
    });
  }
  return current;
}

let nextId = 1;

const endpointState = {};

export function anonRequest(chainId) {
  const urls = ANON_RPC_URLS[chainId];
  if (!urls) throw new Error(`No RPC endpoint for chain ${chainId}`);
  const state = (endpointState[chainId] ??= {});
  return async ({ method, params }) => {
    const worker = await getWorker();
    const res = await fetchWithFailover(
      (url, init) => worker.fetch(url, init),
      urls,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
      },
      state,
    );
    if (!res.ok) throw new Error(`anon-rpc: endpoint answered HTTP ${res.status}`);
    const body = await res.json();
    if (body.error) {
      throw Object.assign(new Error(body.error.message ?? "rpc error"), {
        code: body.error.code,
        data: body.error.data,
        rpcResponse: true,
      });
    }
    return body.result;
  };
}

export function closeWorker() {
  const pending = current;
  current = undefined;
  lastFailure = undefined;
  pending?.then((w) => w.close()).catch(() => {});
}
