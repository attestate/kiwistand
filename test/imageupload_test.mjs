// @format
import test from "ava";

import {
  RateLimiter,
  clientIP,
  directUploadParams,
  UPLOAD_EXPIRY_SECONDS,
} from "../src/imageupload.mjs";

test("RateLimiter allows `limit` hits per window and then says when to retry", (t) => {
  const limiter = new RateLimiter({ limit: 2, windowMs: 1000 });
  t.true(limiter.take("a", 0).ok);
  t.true(limiter.take("a", 100).ok);
  const third = limiter.take("a", 200);
  t.false(third.ok);
  t.is(third.retryAfter, 1);
  t.true(limiter.take("b", 200).ok);
  // The first hit left the window.
  t.true(limiter.take("a", 1001).ok);
});

test("clientIP prefers Cloudflare's header, then the proxy's", (t) => {
  t.is(
    clientIP({
      headers: { "cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" },
    }),
    "1.1.1.1",
  );
  t.is(clientIP({ headers: { "x-forwarded-for": "2.2.2.2, 3.3.3.3" } }), "2.2.2.2");
  t.is(clientIP({ headers: {}, ip: "4.4.4.4" }), "4.4.4.4");
});

test("directUploadParams sets a short expiry and records who asked", (t) => {
  const now = Date.UTC(2026, 9, 17, 7, 42, 0, 123);
  const signed = directUploadParams(
    { accountId: "acc", identity: "0xABC", ip: "1.1.1.1", client: "KiwiNewsIOS" },
    now,
  );
  t.is(signed.account_id, "acc");
  t.is(
    signed.expiry,
    new Date(now + UPLOAD_EXPIRY_SECONDS * 1000)
      .toISOString()
      .replace(/\.\d{3}Z$/, "Z"),
  );
  t.deepEqual(JSON.parse(signed.metadata), {
    source: "kiwinews",
    identity: "0xabc",
    client: "KiwiNewsIOS",
  });

  const anonymous = JSON.parse(
    directUploadParams({ accountId: "acc", ip: "1.1.1.1" }, now).metadata,
  );
  t.is(anonymous.identity, undefined);
  t.regex(anonymous.ipHash, /^[0-9a-f]{16}$/);
  t.false(JSON.stringify(anonymous).includes("1.1.1.1"));
});
