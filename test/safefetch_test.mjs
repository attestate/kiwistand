// @format
import http from "http";

import test from "ava";

import { safeFetch } from "../src/safefetch.mjs";

async function listen(t, handler) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.teardown(() => server.close());
  return server.address().port;
}

test("safeFetch refuses private targets", async (t) => {
  let hits = 0;
  const port = await listen(t, (req, res) => {
    hits++;
    res.end("secret");
  });
  for (const url of [
    `http://127.0.0.1:${port}/`,
    `http://localhost:${port}/`,
    "http://169.254.169.254/latest/meta-data/",
    "http://10.0.0.1/",
    "http://[::1]/",
  ]) {
    await t.throwsAsync(
      safeFetch(url, { signal: AbortSignal.timeout(3000) }),
      undefined,
      url,
    );
  }
  t.is(hits, 0);
});

test("safeFetch checks every redirect hop", async (t) => {
  // Allow the first hop only, as if it were a public host, and record which
  // URLs node-fetch asks the agent for.
  const { default: nodeFetch } = await import("node-fetch");
  const { filteringAgent } = await import("../src/safefetch.mjs");
  const target = await listen(t, (req, res) => res.end("secret"));
  const redirector = await listen(t, (req, res) => {
    res.writeHead(302, { location: `http://127.0.0.1:${target}/admin` });
    res.end();
  });
  const asked = [];
  const agent = (parsedURL) => {
    asked.push(parsedURL.href);
    return asked.length === 1 ? undefined : filteringAgent(parsedURL);
  };
  await t.throwsAsync(
    nodeFetch(`http://127.0.0.1:${redirector}/`, { agent, follow: 5 }),
  );
  t.deepEqual(asked, [
    `http://127.0.0.1:${redirector}/`,
    `http://127.0.0.1:${target}/admin`,
  ]);
});
