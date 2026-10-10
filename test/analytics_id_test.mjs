//@format
import test from "ava";

import { resolveAnalyticsId, COOKIE_NAME } from "../src/analytics-id.mjs";

const PH = "ph_phc_F3mfkyH5tKKSVxnMbJf0ALcPA98s92s3Jw8a7eqpBGw_posthog";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

test("keeps an existing kiwi_did", (t) => {
  const id = "0192f3a1-1111-7222-8333-444455556666";
  t.is(resolveAnalyticsId({ [COOKIE_NAME]: id }), id);
});

test("reuses posthog's anonymous $device_id", (t) => {
  const deviceId = "0192f3a1-aaaa-7bbb-8ccc-dddddddddddd";
  const ph = JSON.stringify({
    distinct_id: "0xee324c588ceF1BF1c1360883E4318834af66366d",
    $device_id: deviceId,
  });
  t.is(resolveAnalyticsId({ [PH]: ph }), deviceId);
});

test("ignores garbage and mints a new uuid", (t) => {
  const id = resolveAnalyticsId({ [COOKIE_NAME]: "<script>", [PH]: "{nope" });
  t.regex(id, UUID);
  t.regex(resolveAnalyticsId(), UUID);
});
