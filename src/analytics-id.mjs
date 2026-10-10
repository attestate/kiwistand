// @format
import { randomUUID } from "crypto";

// A long-lived, first-party anonymous id for PostHog. Safari ITP caps
// script-written storage (document.cookie, localStorage) at 7 days, which
// makes every returning Safari/iOS visitor look new. Cookies set by the
// server via Set-Cookie aren't capped that way, so we hand out the id from
// here and the client feeds it into posthog-js as its device id.
export const COOKIE_NAME = "kiwi_did";
export const MAX_AGE_MS = 400 * 24 * 60 * 60 * 1000; // browser maximum
const POSTHOG_KEY = "phc_F3mfkyH5tKKSVxnMbJf0ALcPA98s92s3Jw8a7eqpBGw";
const POSTHOG_COOKIE = `ph_${POSTHOG_KEY}_posthog`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Prefer an id we already issued, then posthog-js' own anonymous
// $device_id (so existing visitors keep their history), else a new UUID.
export function resolveAnalyticsId(cookies = {}) {
  const existing = cookies[COOKIE_NAME];
  if (typeof existing === "string" && UUID.test(existing)) return existing;

  try {
    const deviceId = JSON.parse(cookies[POSTHOG_COOKIE])?.$device_id;
    if (typeof deviceId === "string" && UUID.test(deviceId)) return deviceId;
  } catch {}

  return randomUUID();
}

export function setAnalyticsIdCookie(reply, id) {
  reply.cookie(COOKIE_NAME, id, {
    maxAge: MAX_AGE_MS,
    httpOnly: false, // posthog-js must be able to read it
    secure: true,
    sameSite: "lax",
    path: "/",
  });
}
