//@format
import test from "ava";

import {
  PRIVATE_RPC_KEY,
  PRIVATE_RPC_FALLBACK_KEY,
  PrivateRpcUnavailableError,
  readRpcSettings,
  writeRpcSettings,
  routeFor,
  createRoutedRequest,
  createKiwiEnsActions,
} from "../src/web/src/rpc.mjs";

const memoryStorage = (init = {}) => {
  const data = new Map(Object.entries(init));
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    data,
  };
};

test("private RPC is off by default", (t) => {
  t.deepEqual(readRpcSettings(memoryStorage()), {
    privateRpc: false,
    allowFallback: false,
  });
  t.deepEqual(readRpcSettings(null), { privateRpc: false, allowFallback: false });
});

test("a throwing localStorage reads as off", (t) => {
  const broken = {
    getItem() {
      throw new Error("SecurityError");
    },
  };
  t.deepEqual(readRpcSettings(broken), { privateRpc: false, allowFallback: false });
});

test("settings round-trip through localStorage keys", (t) => {
  const s = memoryStorage();
  t.deepEqual(writeRpcSettings({ privateRpc: true }, s), {
    privateRpc: true,
    allowFallback: false,
  });
  t.is(s.getItem(PRIVATE_RPC_KEY), "true");
  writeRpcSettings({ allowFallback: true }, s);
  t.is(s.getItem(PRIVATE_RPC_FALLBACK_KEY), "true");
  writeRpcSettings({ privateRpc: false }, s);
  t.false(s.data.has(PRIVATE_RPC_KEY));
  t.true(readRpcSettings(s).allowFallback);
});

test("routeFor picks anon only when private RPC is on", (t) => {
  t.is(routeFor({ privateRpc: false, allowFallback: true }), "direct");
  t.is(routeFor({ privateRpc: true, allowFallback: false }), "anon");
});

const setup = (settings, { anonFails, anonError } = {}) => {
  const calls = { direct: [], anon: [], loads: 0, fallback: [], error: [] };
  const request = createRoutedRequest({
    getSettings: () => settings,
    direct: async (args) => {
      calls.direct.push(args.method);
      return "direct";
    },
    loadAnon: async () => {
      calls.loads += 1;
      if (anonFails) throw new Error("worker not ready");
      return async (args) => {
        calls.anon.push(args.method);
        if (anonError) throw anonError;
        return "anon";
      };
    },
    onFallback: (err) => calls.fallback.push(err),
    onError: (err) => calls.error.push(err),
  });
  return { request, calls };
};

test("direct mode never loads the anon transport", async (t) => {
  const { request, calls } = setup({ privateRpc: false, allowFallback: false });
  t.is(await request({ method: "eth_blockNumber" }), "direct");
  t.is(calls.loads, 0);
  t.deepEqual(calls.anon, []);
});

test("private mode sends reads through the anon transport", async (t) => {
  const { request, calls } = setup({ privateRpc: true, allowFallback: true });
  t.is(await request({ method: "eth_call" }), "anon");
  t.deepEqual(calls.direct, []);
  t.deepEqual(calls.anon, ["eth_call"]);
});

test("private mode without fallback errors instead of going direct", async (t) => {
  const { request, calls } = setup(
    { privateRpc: true, allowFallback: false },
    { anonFails: true },
  );
  const err = await t.throwsAsync(request({ method: "eth_getBalance" }), {
    instanceOf: PrivateRpcUnavailableError,
  });
  t.regex(err.message, /worker not ready/);
  // EIP-1193 "disconnected", which viem doesn't retry.
  t.is(err.code, 4900);
  t.deepEqual(calls.direct, []);
  t.is(calls.error.length, 1);
});

test("private mode with fallback goes direct when the worker fails", async (t) => {
  const { request, calls } = setup(
    { privateRpc: true, allowFallback: true },
    { anonFails: true },
  );
  t.is(await request({ method: "eth_getBalance" }), "direct");
  t.deepEqual(calls.direct, ["eth_getBalance"]);
  t.is(calls.fallback.length, 1);
});

test("an RPC error answered through anon is not re-sent directly", async (t) => {
  const revert = Object.assign(new Error("execution reverted"), {
    code: 3,
    rpcResponse: true,
  });
  const { request, calls } = setup(
    { privateRpc: true, allowFallback: true },
    { anonError: revert },
  );
  const err = await t.throwsAsync(request({ method: "eth_call" }));
  t.is(err, revert);
  t.deepEqual(calls.direct, []);
  t.is(calls.fallback.length, 0);
});

test("settings are read per request", async (t) => {
  const settings = { privateRpc: false, allowFallback: false };
  const { request, calls } = setup(settings);
  await request({ method: "eth_chainId" });
  settings.privateRpc = true;
  await request({ method: "eth_chainId" });
  t.deepEqual(calls.direct, ["eth_chainId"]);
  t.deepEqual(calls.anon, ["eth_chainId"]);
});

const ADDRESS = "0xee324c588ceF1BF1c1360883E4318834af66366d";
const jsonResponse = (body, ok = true) => ({ ok, json: async () => body });

test("ENS names come from Kiwi's profile API, not an RPC", async (t) => {
  const urls = [];
  const actions = createKiwiEnsActions({
    fetchFn: async (url) => {
      urls.push(url);
      return jsonResponse({
        data: { ens: "kiwi.eth", safeAvatar: "https://example.com/a.png" },
      });
    },
  });
  t.is(await actions.getEnsName({ address: ADDRESS }), "kiwi.eth");
  t.is(await actions.getEnsName({ address: ADDRESS.toLowerCase() }), "kiwi.eth");
  t.deepEqual(urls, [`/api/v1/profile/${ADDRESS}`]);
  t.is(await actions.getEnsAvatar({ name: "kiwi.eth" }), "https://example.com/a.png");
  t.is(await actions.getEnsAvatar({ name: "other.eth" }), null);
});

test("ENS lookups without a name return null and aren't cached", async (t) => {
  let n = 0;
  const actions = createKiwiEnsActions({
    fetchFn: async () => {
      n += 1;
      return n === 1
        ? jsonResponse({ data: { displayName: "0xee32...366d" } })
        : jsonResponse({ data: { ens: "late.eth" } });
    },
  });
  t.is(await actions.getEnsName({ address: ADDRESS }), null);
  t.is(await actions.getEnsName({ address: ADDRESS }), "late.eth");
});

test("ENS lookups survive API errors", async (t) => {
  const actions = createKiwiEnsActions({
    fetchFn: async () => {
      throw new Error("offline");
    },
  });
  t.is(await actions.getEnsName({ address: ADDRESS }), null);
  const notFound = createKiwiEnsActions({
    fetchFn: async () => jsonResponse({}, false),
  });
  t.is(await notFound.getEnsName({ address: ADDRESS }), null);
  t.is(await notFound.getEnsName({}), null);
});

test("ENS avatars that aren't https are dropped", async (t) => {
  const actions = createKiwiEnsActions({
    fetchFn: async () =>
      jsonResponse({ data: { ens: "x.eth", safeAvatar: "ipfs://abc" } }),
  });
  t.is(await actions.getEnsName({ address: ADDRESS }), "x.eth");
  t.is(await actions.getEnsAvatar({ name: "x.eth" }), null);
});
