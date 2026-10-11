// @format
// NOTE: One answer to "may this browser be tracked?", for everything that
// tracks: Google Analytics, PostHog (events, session recording, console
// logs, heatmaps), the signed impression/click batches (tracker.mjs) and the
// /impression, /outbound and /share beacons the server fingerprints.
//
// Tracking is off when any of these is set in localStorage:
// - "kiwi-analytics-consent" = "false": "Opt Out" on the consent banner
// - "anon-mode" = "true": anon mode (?anon)
// - "kiwi-private-rpc" = "true": anon-rpc is on, see rpc.mjs. Someone who
//   routes chain reads through Tor doesn't want to be recorded either.
//
// The same check runs before the bundle loads as window.kiwiTrackingOff in
// public/theme-init.js (used by conditional-tracking.js and the inline link
// handlers of views/components/row.mjs). Keep both in sync; the unit tests
// compare them.
import { PRIVATE_RPC_KEY } from "./rpc.mjs";
import { disableAnalytics } from "./analytics.mjs";

export const CONSENT_KEY = "kiwi-analytics-consent";
export const ANON_MODE_KEY = "anon-mode";
export const GA_MEASUREMENT_ID = "G-21BKTD0NKN";
export const TRACKING_CHANGE_EVENT = "kiwi-tracking-change";

export function trackingAllowed({ consent, anonMode, privateRpc }) {
  return !(anonMode || privateRpc || consent === "false");
}

// The banner asks only people who haven't decided yet and would be tracked.
export function shouldShowConsentBanner(state) {
  return (state.consent === null || state.consent === undefined) &&
    trackingAllowed(state);
}

export function readTrackingState(storage) {
  let s = storage;
  try {
    if (s === undefined) s = typeof localStorage === "undefined" ? null : localStorage;
    if (!s) return { consent: null, anonMode: false, privateRpc: false };
    return {
      consent: s.getItem(CONSENT_KEY),
      anonMode: s.getItem(ANON_MODE_KEY) === "true",
      privateRpc: s.getItem(PRIVATE_RPC_KEY) === "true",
    };
  } catch (err) {
    return { consent: null, anonMode: false, privateRpc: false };
  }
}

export const isTrackingAllowed = (storage) =>
  trackingAllowed(readTrackingState(storage));

// Stops whatever already runs on this page: the path "Opt Out" on the banner
// always took, now also used when anon-rpc is turned on. Persisting the
// choice is the caller's job (the consent key, or the anon-rpc setting).
export function stopTracking(win = typeof window === "undefined" ? null : window) {
  if (!win) return;
  // Google's documented switch: gtag.js sends nothing for this id anymore,
  // not even the cookieless pings consent mode still allows.
  win[`ga-disable-${GA_MEASUREMENT_ID}`] = true;
  try {
    win.gtag?.("consent", "update", { analytics_storage: "denied" });
  } catch (_) {}
  const ph = win.posthog;
  if (ph?.__loaded) {
    try {
      ph.stopSessionRecording?.();
    } catch (_) {}
    try {
      ph.opt_out_capturing?.();
    } catch (_) {}
  }
  // Drops events queued while posthog-js was still loading, and keeps it
  // from loading later on this page.
  disableAnalytics();
  try {
    win.dispatchEvent?.(new Event(TRACKING_CHANGE_EVENT));
  } catch (_) {}
}
