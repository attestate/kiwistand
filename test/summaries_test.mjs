// @format
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import test from "ava";

process.env.CACHE_DIR = mkdtempSync(join(tmpdir(), "summaries-"));
process.env.ANTHROPIC_API_KEY = "test-key";
const summaries = await import("../src/summaries.mjs");
const {
  summaryInput,
  generateStorySummary,
  SUMMARY_MIN_CHARS,
  SUMMARY_MAX_CHARS,
} = await import("../src/parser.mjs");
const { default: Summary } = await import("../src/views/components/summary.mjs");

const INDEX = `0x${"5ab1".padEnd(72, "c")}`;
const ARTICLE = "Ethereum client teams shipped a fork. ".repeat(40);
const SUMMARY = "Client teams shipped the fork on mainnet.";

// Records the request and answers like the Messages API would.
function mockClient(response) {
  const calls = [];
  return {
    calls,
    messages: {
      create: async (params) => {
        calls.push(params);
        if (response instanceof Error) throw response;
        return response;
      },
    },
  };
}

const answer = (text, stop_reason = "end_turn") => ({
  stop_reason,
  content: [
    { type: "thinking", thinking: "" },
    { type: "text", text },
  ],
});

test("summaryInput rejects short or missing text and truncates long text", (t) => {
  t.is(summaryInput(null), null);
  t.is(summaryInput(undefined), null);
  t.is(summaryInput("x".repeat(SUMMARY_MIN_CHARS - 1)), null);
  t.is(summaryInput(`  ${"x".repeat(SUMMARY_MIN_CHARS)}  `).length, SUMMARY_MIN_CHARS);
  t.is(summaryInput("x".repeat(SUMMARY_MAX_CHARS * 2)).length, SUMMARY_MAX_CHARS);
});

test("generateStorySummary skips the call when the text is too short", async (t) => {
  const client = mockClient(answer(SUMMARY));
  t.is(await generateStorySummary("Title", "too short", client), null);
  t.is(client.calls.length, 0);
});

test("generateStorySummary sends truncated text and returns plain text", async (t) => {
  const client = mockClient(answer(`  ${SUMMARY}\n`));
  const long = ARTICLE + "y".repeat(SUMMARY_MAX_CHARS);
  t.is(await generateStorySummary("Fork shipped", long, client), SUMMARY);
  t.is(client.calls.length, 1);
  const prompt = client.calls[0].messages[0].content;
  t.true(prompt.includes("Title: Fork shipped"));
  t.false(prompt.includes("y".repeat(SUMMARY_MAX_CHARS)));
});

test("generateStorySummary returns null on NONE, truncation and refusal", async (t) => {
  t.is(await generateStorySummary("T", ARTICLE, mockClient(answer("NONE"))), null);
  t.is(
    await generateStorySummary("T", ARTICLE, mockClient(answer(SUMMARY, "max_tokens"))),
    null,
  );
  t.is(
    await generateStorySummary("T", ARTICLE, mockClient(answer("", "refusal"))),
    null,
  );
});

test("generateStorySummary throws when the request fails", async (t) => {
  await t.throwsAsync(
    generateStorySummary("T", ARTICLE, mockClient(new Error("overloaded"))),
    { message: "overloaded" },
  );
});

test("isSummarizable skips text posts, kiwi references and image uploads", (t) => {
  t.true(summaries.isSummarizable("https://example.com/post"));
  t.false(summaries.isSummarizable("data:text/plain,hello"));
  t.false(summaries.isSummarizable(`kiwi:${INDEX}`));
  t.false(
    summaries.isSummarizable("https://imagedelivery.net/abc/def/public"),
  );
});

test("store reads and writes by index, with or without 0x", (t) => {
  const index = `0x${"1".repeat(72)}`;
  t.is(summaries.read(index), null);
  t.true(summaries.needsSummary(index));

  summaries.write(index, SUMMARY, 1000);
  t.deepEqual(summaries.read(index.slice(2)), { summary: SUMMARY, createdAt: 1000 });
  t.is(summaries.getSummary(index.slice(2)), SUMMARY);
  t.false(summaries.needsSummary(index, 1000 + summaries.RETRY_AFTER * 10));
});

test("a failed attempt is stored and retried only after RETRY_AFTER", (t) => {
  const index = `0x${"2".repeat(72)}`;
  summaries.write(index, null, 1000);
  t.is(summaries.getSummary(index), null);
  t.false(summaries.needsSummary(index, 1000 + summaries.RETRY_AFTER));
  t.true(summaries.needsSummary(index, 1001 + summaries.RETRY_AFTER));
});

test.serial("scheduleSummary generates once, dedupes and stores the result", async (t) => {
  let extracts = 0;
  const deps = {
    extract: async () => {
      extracts++;
      return { plainText: ARTICLE };
    },
    summarize: async (title, text) => (text === ARTICLE ? SUMMARY : null),
  };
  const href = "https://example.com/fork";
  const first = summaries.scheduleSummary(INDEX, "Fork", href, deps);
  const second = summaries.scheduleSummary(INDEX.slice(2), "Fork", href, deps);
  t.is(first, second);
  t.is(await first, SUMMARY);
  t.is(extracts, 1);
  t.is(summaries.getSummary(INDEX), SUMMARY);
  t.is(summaries.scheduleSummary(INDEX, "Fork", href, deps), null);
});

test.serial("scheduleSummary stores a failure and never throws", async (t) => {
  const index = `0x${"3".repeat(72)}`;
  const deps = {
    extract: async () => {
      throw new Error("Failed to fetch: 500");
    },
  };
  t.is(await summaries.scheduleSummary(index, "T", "https://a.b/c", deps), null);
  t.deepEqual(Object.keys(summaries.read(index)), ["summary", "createdAt"]);
  t.is(summaries.read(index).summary, null);
});

test.serial("a failed Claude request isn't stored and pauses generation", async (t) => {
  const index = `0x${"5".repeat(72)}`;
  const other = `0x${"6".repeat(72)}`;
  const deps = {
    extract: async () => ({ plainText: ARTICLE }),
    summarize: async () => {
      throw new Error("overloaded");
    },
  };
  try {
    t.is(await summaries.scheduleSummary(index, "T", "https://a.b/c", deps), null);
    t.is(summaries.read(index), null);
    t.is(summaries.scheduleSummary(other, "T", "https://a.b/d", deps), null);
    t.is(summaries.read(other), null);
  } finally {
    summaries.resetPause();
  }
});

test.serial("scheduleSummary runs at most MAX_JOBS jobs at a time", async (t) => {
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  const deps = {
    extract: async () => {
      await gate;
      return { plainText: ARTICLE };
    },
    summarize: async () => SUMMARY,
  };
  const indexes = ["7", "8", "9"].map((c) => `0x${c.repeat(72)}`);
  const jobs = indexes.map((i, n) => summaries.scheduleSummary(i, "T", `https://a.b/${n}`, deps));
  t.truthy(jobs[0]);
  t.truthy(jobs[1]);
  t.is(jobs[2], null);
  release();
  await Promise.all(jobs.slice(0, 2));
  t.is(summaries.read(indexes[2]), null);
});

test.serial("scheduleSummary is a no-op without an API key or for text posts", (t) => {
  const index = `0x${"4".repeat(72)}`;
  const deps = { extract: async () => t.fail() };
  t.is(summaries.scheduleSummary(index, "T", "data:text/plain,hi", deps), null);

  const key = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    t.is(summaries.scheduleSummary(index, "T", "https://a.b/c", deps), null);
  } finally {
    process.env.ANTHROPIC_API_KEY = key;
  }
  t.is(summaries.read(index), null);
});

test("Summary renders the escaped summary with an AI note", (t) => {
  t.is(Summary(null), null);
  const out = Summary("Fees <b>fell</b> 40%.").toString();
  t.true(out.includes("<h2"));
  t.true(out.includes("Summary"));
  t.true(out.includes("Fees &lt;b&gt;fell&lt;/b&gt; 40%."));
  t.true(out.includes("AI summary of the linked article"));
});
