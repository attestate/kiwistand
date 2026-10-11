//@format
import test from "ava";
import { readFileSync } from "fs";
import vm from "vm";

import {
  CONSENT_KEY,
  ANON_MODE_KEY,
  GA_MEASUREMENT_ID,
  TRACKING_CHANGE_EVENT,
  trackingAllowed,
  shouldShowConsentBanner,
  readTrackingState,
  isTrackingAllowed,
  stopTracking,
} from "../src/web/src/tracking.mjs";
import { PRIVATE_RPC_KEY } from "../src/web/src/rpc.mjs";

const memoryStorage = (init = {}) => {
  const data = new Map(Object.entries(init));
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    key: (i) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    },
    data,
  };
};

// Every combination of the three settings, as stored in localStorage.
const combos = [];
for (const consent of [null, "true", "false"])
  for (const anonMode of [false, true])
    for (const privateRpc of [false, true])
      combos.push({ consent, anonMode, privateRpc });

const toStorage = ({ consent, anonMode, privateRpc }) => {
  const init = {};
  if (consent !== null) init[CONSENT_KEY] = consent;
  if (anonMode) init[ANON_MODE_KEY] = "true";
  if (privateRpc) init[PRIVATE_RPC_KEY] = "true";
  return memoryStorage(init);
};

test("tracking runs only without opt-out, anon mode and anon-rpc", (t) => {
  for (const state of combos) {
    const expected =
      state.consent !== "false" && !state.anonMode && !state.privateRpc;
    t.is(trackingAllowed(state), expected, JSON.stringify(state));
  }
  // Undecided visitors are tracked (opt-out banner), as before.
  t.true(trackingAllowed({ consent: null, anonMode: false, privateRpc: false }));
});

test("anon-rpc turns tracking off like Opt Out", (t) => {
  t.false(trackingAllowed({ consent: null, anonMode: false, privateRpc: true }));
  t.false(trackingAllowed({ consent: "true", anonMode: false, privateRpc: true }));
});

test("the consent banner only asks undecided visitors who'd be tracked", (t) => {
  t.true(shouldShowConsentBanner({ consent: null, anonMode: false, privateRpc: false }));
  t.false(shouldShowConsentBanner({ consent: null, anonMode: false, privateRpc: true }));
  t.false(shouldShowConsentBanner({ consent: null, anonMode: true, privateRpc: false }));
  t.false(shouldShowConsentBanner({ consent: "true", anonMode: false, privateRpc: false }));
  t.false(shouldShowConsentBanner({ consent: "false", anonMode: false, privateRpc: false }));
});

test("readTrackingState reads the stored settings", (t) => {
  t.deepEqual(readTrackingState(memoryStorage()), {
    consent: null,
    anonMode: false,
    privateRpc: false,
  });
  t.deepEqual(
    readTrackingState(
      memoryStorage({
        [CONSENT_KEY]: "false",
        [ANON_MODE_KEY]: "true",
        [PRIVATE_RPC_KEY]: "true",
      }),
    ),
    { consent: "false", anonMode: true, privateRpc: true },
  );
  t.deepEqual(readTrackingState(null), {
    consent: null,
    anonMode: false,
    privateRpc: false,
  });
  const throwing = {
    getItem: () => {
      throw new Error("SecurityError");
    },
  };
  t.true(isTrackingAllowed(throwing));
  for (const state of combos) {
    t.is(isTrackingAllowed(toStorage(state)), trackingAllowed(state));
  }
});

test("stopTracking stops GA, PostHog recording and capture, and tells the page", (t) => {
  const calls = [];
  const events = [];
  const win = {
    gtag: (...args) => calls.push(["gtag", ...args]),
    posthog: {
      __loaded: true,
      stopSessionRecording: () => calls.push(["stopSessionRecording"]),
      opt_out_capturing: () => calls.push(["opt_out_capturing"]),
    },
    dispatchEvent: (e) => events.push(e.type),
  };
  stopTracking(win);
  t.true(win[`ga-disable-${GA_MEASUREMENT_ID}`]);
  t.deepEqual(calls, [
    ["gtag", "consent", "update", { analytics_storage: "denied" }],
    ["stopSessionRecording"],
    ["opt_out_capturing"],
  ]);
  t.deepEqual(events, [TRACKING_CHANGE_EVENT]);
});

test("stopTracking works before GA or PostHog loaded", (t) => {
  const win = { dispatchEvent: () => {} };
  t.notThrows(() => stopTracking(win));
  t.true(win[`ga-disable-${GA_MEASUREMENT_ID}`]);
  t.notThrows(() => stopTracking(null));
});

// public/theme-init.js runs before the bundle and defines
// window.kiwiTrackingOff for conditional-tracking.js and the inline link
// handlers. It must agree with tracking.mjs.
const publicScript = (name) =>
  readFileSync(new URL(`../src/public/${name}`, import.meta.url), "utf8");

function browserContext(storage) {
  const appended = [];
  const listeners = {};
  const window = {
    location: { search: "", pathname: "/" },
    history: { replaceState: () => {} },
    addEventListener: (type, fn) => {
      (listeners[type] ||= []).push(fn);
    },
    removeEventListener: (type, fn) => {
      listeners[type] = (listeners[type] || []).filter((f) => f !== fn);
    },
  };
  window.self = window;
  window.top = window;
  const document = {
    readyState: "loading",
    documentElement: {
      setAttribute: () => {},
      classList: { contains: () => false },
    },
    body: { appendChild: (el) => appended.push(el.src) },
    createElement: () => ({}),
  };
  const context = {
    window,
    document,
    localStorage: storage,
    navigator: { userAgent: "Mozilla/5.0" },
    URLSearchParams,
    setTimeout: (fn) => fn(),
    Object,
  };
  window.localStorage = storage;
  window.document = document;
  vm.createContext(context);
  return { context, window, appended, listeners };
}

test("theme-init.js kiwiTrackingOff matches tracking.mjs", (t) => {
  const source = publicScript("theme-init.js");
  for (const state of combos) {
    const { context, window } = browserContext(toStorage(state));
    vm.runInContext(source, context);
    t.is(
      window.kiwiTrackingOff(),
      !trackingAllowed(state),
      JSON.stringify(state),
    );
  }
});

test("theme-init.js kiwiTrackingOff follows anon-rpc turned on later", (t) => {
  const storage = memoryStorage();
  const { context, window } = browserContext(storage);
  vm.runInContext(publicScript("theme-init.js"), context);
  t.false(window.kiwiTrackingOff());
  storage.setItem(PRIVATE_RPC_KEY, "true");
  t.true(window.kiwiTrackingOff());
});

const loadsGoogle = (appended) =>
  appended.some((src) => String(src).includes("googletagmanager.com"));

function runConditionalTracking(storage, { before } = {}) {
  const env = browserContext(storage);
  vm.runInContext(publicScript("theme-init.js"), env.context);
  vm.runInContext(publicScript("conditional-tracking.js"), env.context);
  if (before) before(env);
  // A first interaction, then the page's load event.
  for (const fn of env.listeners.pointerdown || []) fn();
  for (const fn of env.listeners.load || []) fn();
  return env;
}

test("conditional-tracking.js loads Google Analytics only when tracking is allowed", (t) => {
  for (const state of combos) {
    const { appended } = runConditionalTracking(toStorage(state));
    t.is(loadsGoogle(appended), trackingAllowed(state), JSON.stringify(state));
    // instantpage.js (not tracking) still loads outside anon mode.
    t.is(appended.includes("instantpage.js"), !state.anonMode);
  }
});

test("conditional-tracking.js doesn't load Google Analytics after anon-rpc is turned on", (t) => {
  const storage = memoryStorage();
  const { appended } = runConditionalTracking(storage, {
    before: () => storage.setItem(PRIVATE_RPC_KEY, "true"),
  });
  t.false(loadsGoogle(appended));
});

test("conditional-tracking.js ignores the pointerdown on Opt Out or the anon-rpc switch", (t) => {
  const storage = memoryStorage();
  const env = browserContext(storage);
  vm.runInContext(publicScript("theme-init.js"), env.context);
  vm.runInContext(publicScript("conditional-tracking.js"), env.context);
  const onPrivacyControl = {
    target: {
      closest: (sel) =>
        sel.includes("#analytics-consent-container") ? {} : null,
    },
  };
  for (const fn of env.listeners.pointerdown || []) fn(onPrivacyControl);
  t.false(loadsGoogle(env.appended));
  // The click then opts out; the page's load timer finds tracking off.
  storage.setItem(CONSENT_KEY, "false");
  for (const fn of env.listeners.load || []) fn();
  t.false(loadsGoogle(env.appended));
});
