//@format
import test from "ava";

import {
  FARCASTER_CONNECTOR_ID,
  loginOptions,
  promptDelegationOnConnect,
  autoConnectMiniAppWallet,
  getMiniApp,
  setMiniApp,
  subscribeMiniApp,
  resetMiniApp,
} from "../src/web/src/miniapp.mjs";

test.beforeEach(() => resetMiniApp());

test.serial("the mini app only offers the Farcaster wallet", (t) => {
  t.deepEqual(loginOptions({ isMiniApp: true, passkeys: true }), {
    farcasterWallet: true,
    passkey: false,
    walletPicker: false,
  });
  t.deepEqual(loginOptions({ isMiniApp: true, passkeys: false }), {
    farcasterWallet: true,
    passkey: false,
    walletPicker: false,
  });
});

test.serial("the mini app asks for one-tap actions only on an action", (t) => {
  t.false(promptDelegationOnConnect({ isMiniApp: true }));
  t.true(promptDelegationOnConnect({ isMiniApp: false }));
});

test.serial("outside the mini app nothing changes", (t) => {
  t.deepEqual(loginOptions({ isMiniApp: false, passkeys: true }), {
    farcasterWallet: false,
    passkey: true,
    walletPicker: true,
  });
  t.deepEqual(loginOptions({ isMiniApp: false, passkeys: false }), {
    farcasterWallet: false,
    passkey: false,
    walletPicker: true,
  });
});

const fakeWagmi = ({ connected = false, connectors, connect } = {}) => {
  const calls = [];
  const client = {
    connectors: connectors || [
      { id: "walletConnect" },
      { id: FARCASTER_CONNECTOR_ID },
    ],
  };
  return {
    calls,
    load: async () => ({
      client,
      getAccount: () =>
        connected ? { isConnected: true, address: "0x1" } : {},
      connect: (config, { connector }) => {
        calls.push(connector.id);
        return connect ? connect() : Promise.resolve({ accounts: ["0x1"] });
      },
    }),
  };
};

test.serial("connects the Farcaster connector, once per page load", async (t) => {
  const seen = [];
  subscribeMiniApp(() => seen.push(getMiniApp().wallet));
  const wagmi = fakeWagmi();
  t.is(await autoConnectMiniAppWallet({ load: wagmi.load }), "connected");
  t.is(await autoConnectMiniAppWallet({ load: wagmi.load }), "connected");
  t.deepEqual(wagmi.calls, [FARCASTER_CONNECTOR_ID]);
  t.deepEqual(seen, ["connecting", "connected"]);
});

test.serial("doesn't connect again when a wallet is connected", async (t) => {
  const wagmi = fakeWagmi({ connected: true });
  t.is(await autoConnectMiniAppWallet({ load: wagmi.load }), "connected");
  t.deepEqual(wagmi.calls, []);
});

test.serial("a failed connect shows the fallback and doesn't loop", async (t) => {
  const wagmi = fakeWagmi({
    connect: () => Promise.reject(new Error("Provider not found")),
  });
  t.is(await autoConnectMiniAppWallet({ load: wagmi.load }), "unavailable");
  t.is(await autoConnectMiniAppWallet({ load: wagmi.load }), "unavailable");
  t.deepEqual(wagmi.calls, [FARCASTER_CONNECTOR_ID]);
  t.is(getMiniApp().wallet, "unavailable");
});

test.serial("'Try again' connects once more", async (t) => {
  let fail = true;
  const wagmi = fakeWagmi({
    connect: () =>
      fail ? Promise.reject(new Error("nope")) : Promise.resolve({}),
  });
  t.is(await autoConnectMiniAppWallet({ load: wagmi.load }), "unavailable");
  fail = false;
  t.is(
    await autoConnectMiniAppWallet({ load: wagmi.load, retry: true }),
    "connected",
  );
  t.is(wagmi.calls.length, 2);
});

test.serial("no Farcaster connector means unavailable", async (t) => {
  const wagmi = fakeWagmi({ connectors: [{ id: "walletConnect" }] });
  t.is(await autoConnectMiniAppWallet({ load: wagmi.load }), "unavailable");
  t.deepEqual(wagmi.calls, []);
});

test.serial("a wallet that never answers times out, a late answer still counts", async (t) => {
  let answer;
  const wagmi = fakeWagmi({
    connect: () => new Promise((resolve) => (answer = resolve)),
  });
  t.is(
    await autoConnectMiniAppWallet({ load: wagmi.load, timeout: 10 }),
    "unavailable",
  );
  answer({});
  await new Promise((resolve) => setTimeout(resolve, 0));
  t.is(getMiniApp().wallet, "connected");
});

test.serial("an already connected connector counts as connected", async (t) => {
  const err = new Error("Connector already connected.");
  err.name = "ConnectorAlreadyConnectedError";
  const wagmi = fakeWagmi({ connect: () => Promise.reject(err) });
  t.is(await autoConnectMiniAppWallet({ load: wagmi.load }), "connected");
});

test.serial("setMiniApp merges state", (t) => {
  setMiniApp({ isMiniApp: true });
  t.deepEqual(getMiniApp(), { isMiniApp: true, wallet: "idle" });
});
