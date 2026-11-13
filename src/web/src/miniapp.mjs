// @format
// NOTE: Inside a Farcaster mini app the visitor already has a wallet: the
// Farcaster wallet (@farcaster/miniapp-wagmi-connector, id "farcaster").
// Nothing used to connect it: wagmi's reconnect() (main.jsx) only picks up
// a wallet that already says it's authorized (eth_accounts), after trying
// every other connector first (injected, WalletConnect, Coinbase, ...). So
// mini app visitors got "Log in", i.e. the passkey and RainbowKit options,
// and neither works in the Farcaster app's web view ("Connection request
// reset"). Now main.jsx connects the Farcaster wallet on load, and the login
// (onboarding/Onboarding.jsx) offers nothing else: once connected, the
// one-tap delegation is the only step left.
//
// main.jsx detects the mini app (sdk.isInMiniApp()) and writes the state
// here; the login UI reads it with useMiniApp() (useMiniApp.js).

export const FARCASTER_CONNECTOR_ID = "farcaster";
const CONNECT_TIMEOUT = 15000;

// wallet: "idle" | "connecting" | "connected" | "unavailable"
const initial = { isMiniApp: false, wallet: "idle" };
let state = initial;
const listeners = new Set();

export function getMiniApp() {
  return state;
}

export function setMiniApp(patch) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

export function subscribeMiniApp(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Which ways to log in the login offers. In the mini app only the Farcaster
// wallet: passkeys and the wallet picker don't work in its web view.
export function loginOptions({ isMiniApp, passkeys }) {
  if (isMiniApp) {
    return { farcasterWallet: true, passkey: false, walletPicker: false };
  }
  return { farcasterWallet: false, passkey: !!passkeys, walletPicker: true };
}

// Whether to ask for one-tap actions (the delegation) as soon as a wallet
// connects. Not in the mini app: its wallet connects on every load, so every
// visitor was greeted by the prompt. There it opens only when an action
// needs the key: a comment (upvotes don't need one, see Vote.jsx).
export function promptDelegationOnConnect({ isMiniApp }) {
  return !isMiniApp;
}

const loadWagmi = () =>
  Promise.all([import("@wagmi/core"), import("./client.mjs")]).then(
    ([{ connect, getAccount }, { client }]) => ({ connect, getAccount, client }),
  );

const withTimeout = (promise, ms) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Farcaster wallet didn't answer")),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });

// NOTE: Runs once per page load (main.jsx calls it on every load in the mini
// app); a retry only happens when the visitor taps "Try again"
// (retry: true). Resolves to the wallet state it ended in.
let attempt = null;

export function autoConnectMiniAppWallet({
  load = loadWagmi,
  timeout = CONNECT_TIMEOUT,
  retry = false,
} = {}) {
  if (attempt && !retry) return attempt;
  if (attempt && retry && state.wallet === "connecting") return attempt;
  attempt = (async () => {
    setMiniApp({ wallet: "connecting" });
    let wagmi;
    try {
      wagmi = await load();
    } catch (err) {
      console.error("Couldn't load the wallet code", err);
      setMiniApp({ wallet: "unavailable" });
      return state.wallet;
    }
    const { connect, getAccount, client } = wagmi;
    const account = getAccount(client);
    if (account?.isConnected && account.address) {
      setMiniApp({ wallet: "connected" });
      return state.wallet;
    }
    const connector = client.connectors.find(
      (c) => c.id === FARCASTER_CONNECTOR_ID,
    );
    if (!connector) {
      setMiniApp({ wallet: "unavailable" });
      return state.wallet;
    }
    const connecting = connect(client, { connector });
    try {
      await withTimeout(connecting, timeout);
      setMiniApp({ wallet: "connected" });
    } catch (err) {
      if (err?.name === "ConnectorAlreadyConnectedError") {
        setMiniApp({ wallet: "connected" });
        return state.wallet;
      }
      console.warn("Couldn't connect the Farcaster wallet", err);
      setMiniApp({ wallet: "unavailable" });
      // A slow wallet that answers after the timeout still counts.
      connecting
        .then(() => setMiniApp({ wallet: "connected" }))
        .catch(() => {});
    }
    return state.wallet;
  })();
  return attempt;
}

// For tests.
export function resetMiniApp() {
  attempt = null;
  state = initial;
  listeners.clear();
}
