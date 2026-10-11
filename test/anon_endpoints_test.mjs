import test from "ava";

import {
  ANON_RPC_URLS,
  isRefusal,
  fetchWithFailover,
} from "../src/web/src/anon-endpoints.mjs";

const respond = (map) => {
  const calls = [];
  const fetchFn = async (url) => {
    calls.push(url);
    const r = map[url];
    if (r instanceof Error) throw r;
    return { status: r ?? 200, ok: (r ?? 200) < 300 };
  };
  return { fetchFn, calls };
};

test("every chain has endpoints, mainnet.optimism.io is not tried first", (t) => {
  t.true(ANON_RPC_URLS[10].length > 1);
  t.true(ANON_RPC_URLS[1].length > 1);
  t.not(ANON_RPC_URLS[10][0], "https://mainnet.optimism.io");
});

test("refusals are blocks, rate limits and server errors only", (t) => {
  for (const s of [401, 403, 429, 500, 502, 503]) t.true(isRefusal(s), `${s}`);
  for (const s of [200, 400, 404]) t.false(isRefusal(s), `${s}`);
});

test("moves on to the next endpoint after a 403", async (t) => {
  const { fetchFn, calls } = respond({ "https://a.example": 403 });
  const state = {};
  const res = await fetchWithFailover(fetchFn, ["https://a.example", "https://b.example"], {}, state);
  t.is(res.status, 200);
  t.deepEqual(calls, ["https://a.example", "https://b.example"]);
  t.is(state.preferred, "https://b.example");
});

test("moves on after a connection error", async (t) => {
  const { fetchFn, calls } = respond({ "https://a.example": new Error("reset") });
  await fetchWithFailover(fetchFn, ["https://a.example", "https://b.example"], {});
  t.deepEqual(calls, ["https://a.example", "https://b.example"]);
});

test("starts at the endpoint that worked last time", async (t) => {
  const { fetchFn, calls } = respond({});
  const state = { preferred: "https://b.example" };
  await fetchWithFailover(fetchFn, ["https://a.example", "https://b.example"], {}, state);
  t.deepEqual(calls, ["https://b.example"]);
});

test("a 400 is an answer, not a refusal", async (t) => {
  const { fetchFn, calls } = respond({ "https://a.example": 400 });
  const res = await fetchWithFailover(fetchFn, ["https://a.example", "https://b.example"], {});
  t.is(res.status, 400);
  t.deepEqual(calls, ["https://a.example"]);
});

test("throws with every endpoint's reason when all refuse", async (t) => {
  const { fetchFn } = respond({ "https://a.example": 403, "https://b.example": 429 });
  const err = await t.throwsAsync(() =>
    fetchWithFailover(fetchFn, ["https://a.example", "https://b.example"], {}),
  );
  t.regex(err.message, /a\.example: HTTP 403.*b\.example: HTTP 429/);
});
