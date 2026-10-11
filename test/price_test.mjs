//@format
import test from "ava";

import { createPriceCache, DECIMALS } from "../src/price.mjs";

const clock = () => {
  let t = 1_000_000;
  const now = () => t;
  now.advance = (ms) => (t += ms);
  return now;
};

test("serves the feed answer with decimals", async (t) => {
  const ethUsd = createPriceCache({
    read: async () => ({ answer: "250012345678", updatedAt: 1700000000 }),
  });
  t.deepEqual(await ethUsd(), {
    answer: "250012345678",
    decimals: DECIMALS,
    updatedAt: 1700000000,
  });
});

test("caches for the ttl and shares one read between concurrent requests", async (t) => {
  let reads = 0;
  const now = clock();
  const ethUsd = createPriceCache({
    now,
    ttl: 1000,
    read: async () => {
      reads += 1;
      return { answer: String(reads * 100), updatedAt: reads };
    },
  });
  const [a, b] = await Promise.all([ethUsd(), ethUsd()]);
  t.is(reads, 1);
  t.is(a, b);
  now.advance(999);
  t.is((await ethUsd()).answer, "100");
  now.advance(2);
  t.is((await ethUsd()).answer, "200");
  t.is(reads, 2);
});

test("keeps serving a stale price when the RPC fails", async (t) => {
  let fail = false;
  const now = clock();
  const ethUsd = createPriceCache({
    now,
    ttl: 10,
    read: async () => {
      if (fail) throw new Error("rpc down");
      return { answer: "300000000000", updatedAt: 1 };
    },
  });
  await ethUsd();
  fail = true;
  now.advance(11);
  t.is((await ethUsd()).answer, "300000000000");
});

test("fails without a cached price and rejects nonsense answers", async (t) => {
  const down = createPriceCache({
    read: async () => {
      throw new Error("rpc down");
    },
  });
  await t.throwsAsync(down(), { message: "rpc down" });
  const negative = createPriceCache({
    read: async () => ({ answer: "-1", updatedAt: 1 }),
  });
  await t.throwsAsync(negative(), { message: /Unexpected/ });
  const zero = createPriceCache({
    read: async () => ({ answer: "0", updatedAt: 1 }),
  });
  await t.throwsAsync(zero());
});
