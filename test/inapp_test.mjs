// @format
import test from "ava";

import {
  inAppBrowser,
  openInBrowserUrl,
  refusedWithoutPrompt,
} from "../src/web/src/inapp.mjs";

const IOS_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.2 Mobile/15E148 Safari/604.1";
const IOS_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0 Mobile/15E148 Safari/604.1";
const IOS_WEBVIEW =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const IOS_X =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 26_6_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/23G90 Twitter for iPhone/12.33";
const ANDROID_WV =
  "Mozilla/5.0 (Linux; Android 13; M2012K11AG Build/TKQ1.221114.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/153.0.8010.39 Mobile Safari/537.36";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36";
const DESKTOP =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36";

test("real browsers aren't in-app browsers", (t) => {
  for (const ua of [IOS_SAFARI, IOS_CHROME, ANDROID_CHROME, DESKTOP, ""]) {
    t.is(inAppBrowser(ua), null, ua);
  }
  // An iOS home screen web app has no "Safari/" either, but passkeys work.
  t.is(inAppBrowser(IOS_WEBVIEW, { standalone: true }), null);
  // The Farcaster client is handled by its mini app sign-in.
  t.is(inAppBrowser("warpcast"), null);
});

test("in-app browsers are named when the app says who it is", (t) => {
  t.deepEqual(inAppBrowser(IOS_X), { name: "X", android: false });
  t.deepEqual(inAppBrowser(IOS_WEBVIEW), { name: null, android: false });
  t.deepEqual(inAppBrowser(ANDROID_WV), { name: null, android: true });
  t.deepEqual(inAppBrowser(ANDROID_WV + " Instagram 300.0"), {
    name: "Instagram",
    android: true,
  });
});

test("Android gets a link that opens the page in Chrome", (t) => {
  const href = "https://news.kiwistand.com/stories/x?index=0x1";
  t.is(
    openInBrowserUrl(href, { android: true }),
    "intent://news.kiwistand.com/stories/x?index=0x1#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fnews.kiwistand.com%2Fstories%2Fx%3Findex%3D0x1;end",
  );
  t.is(openInBrowserUrl(href, { android: false }), null);
  t.is(openInBrowserUrl("not a url", { android: true }), null);
});

test("only an instant NotAllowedError means no passkey prompt was shown", (t) => {
  const notAllowed = { name: "NotAllowedError" };
  t.true(refusedWithoutPrompt(notAllowed, 40));
  t.false(refusedWithoutPrompt(notAllowed, 4000));
  t.false(refusedWithoutPrompt({ name: "AbortError" }, 40));
  t.false(refusedWithoutPrompt(null, 40));
});
