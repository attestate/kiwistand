// Detects in-app browsers (the browser built into X, Instagram, Facebook,
// LinkedIn, Line or an Android WebView) where passkeys don't work: Android
// WebViews have no PublicKeyCredential at all, and an iOS app's WKWebView
// rejects navigator.credentials immediately with NotAllowedError unless the
// app itself is allowed to use our domain's passkeys.
//
// NOTE: Keep this module free of browser-only top-level code; it's imported
// by the node tests (test/inapp_test.mjs). The Farcaster client ("warpcast")
// is left out on purpose: its mini app signs in with the Farcaster wallet.

const APPS = [
  [/Instagram/, "Instagram"],
  [/FBAN|FBAV|FB_IAB/, "Facebook"],
  [/Twitter|TwitterAndroid/, "X"],
  [/LinkedInApp/, "LinkedIn"],
  [/\bLine\//, "LINE"],
  [/Telegram/, "Telegram"],
];

// ua: navigator.userAgent; standalone: navigator.standalone (an iOS home
// screen web app, which can use passkeys). Returns { name, android } or null.
export function inAppBrowser(ua = "", { standalone = false } = {}) {
  if (!ua || /warpcast/i.test(ua)) return null;
  const android = /Android/.test(ua);
  for (const [pattern, name] of APPS) {
    if (pattern.test(ua)) return { name, android };
  }
  if (android && /; wv\)/.test(ua)) return { name: null, android };
  // iOS browsers (Safari, Chrome, Firefox, …) all say "Safari/"; an app's
  // WKWebView doesn't.
  if (/iPhone|iPad|iPod/.test(ua) && !/Safari\//.test(ua) && !standalone) {
    return { name: null, android: false };
  }
  return null;
}

// Android can hand a page to Chrome with an intent URL; on iOS there's no
// such link, so people copy the link and open it in Safari.
export function openInBrowserUrl(href, { android } = {}) {
  if (!android) return null;
  try {
    const url = new URL(href);
    if (url.protocol !== "https:") return null;
    return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(href)};end`;
  } catch (err) {
    return null;
  }
}

// NOTE: When a passkey prompt is really shown, cancelling it takes a person
// at least a second. A NotAllowedError faster than that means the browser
// refused without asking: passkeys aren't available here.
export const INSTANT_REFUSAL_MS = 800;
export function refusedWithoutPrompt(err, elapsedMs) {
  return (
    !!err && err.name === "NotAllowedError" && elapsedMs < INSTANT_REFUSAL_MS
  );
}
