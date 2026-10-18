// @format
import http from "http";
import zlib from "zlib";

import test from "ava";
import nodeFetch from "node-fetch";

import {
  metadata,
  extractParagraphContent,
  setPageFetchForTests,
} from "../src/parser.mjs";

// 64MB of zeros gzip to ~65KB. The bomb repeats it for as long as the client
// keeps reading (gigabytes once decompressed).
const member = zlib.gzipSync(Buffer.alloc(64 * 1024 * 1024));
const MAX_SENT = 16 * 1024 * 1024;

async function listen(t, handler) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.teardown(() => {
    server.closeAllConnections();
    server.close();
  });
  return server.address().port;
}

function sendBomb(res, contentType, sent) {
  res.writeHead(200, {
    "content-type": contentType,
    "content-encoding": "gzip",
  });
  const write = () => {
    while (!res.destroyed) {
      sent.bytes += member.length;
      if (!res.write(member)) return res.once("drain", write);
    }
  };
  write();
}

// safeFetch refuses 127.0.0.1, so the test server gets a plain fetch, and
// https://bomb.test/ (og:images must be https) is sent to it too.
function useServer(t, port) {
  const local = `http://127.0.0.1:${port}`;
  setPageFetchForTests((url, options) =>
    nodeFetch(String(url).replace("https://bomb.test", local), options),
  );
  t.teardown(() => setPageFetchForTests());
}

test.serial("metadata stops reading a gzip-bombed page", async (t) => {
  const sent = { bytes: 0 };
  const port = await listen(t, (req, res) => sendBomb(res, "text/html", sent));
  useServer(t, port);
  const start = Date.now();
  await metadata(`http://127.0.0.1:${port}/bomb`).catch(() => {});
  // Well below the fetch timeouts: the body is cut off at the size limit,
  // and the server is held back once the socket buffers are full.
  t.true(Date.now() - start < 5000);
  t.true(sent.bytes < MAX_SENT);
});

test.serial("metadata stops reading a gzip-bombed og:image", async (t) => {
  const sent = { bytes: 0 };
  const port = await listen(t, (req, res) => {
    if (req.url === "/image.png") return sendBomb(res, "image/png", sent);
    res.writeHead(200, { "content-type": "text/html" });
    res.end(
      `<html><head><meta property="og:title" content="Bomb"/>` +
        `<meta property="og:image" content="https://bomb.test/image.png"/>` +
        `</head><body></body></html>`,
    );
  });
  useServer(t, port);
  const start = Date.now();
  const result = await metadata(`http://127.0.0.1:${port}/page`);
  t.true(Date.now() - start < 5000);
  t.true(sent.bytes > 0);
  t.true(sent.bytes < MAX_SENT);
  t.falsy(result.image);
});

// node-html-parser is roughly cubic in the number of unclosed inline tags, so
// a 20KB page of them used to block the event loop for half a minute.
test.serial("metadata parses a pathological page off the main thread", async (t) => {
  const page =
    `<html><head><title>x</title><meta property="og:title" content="hi">` +
    `</head><body>${"<a>".repeat(7000)}</body></html>`;
  const port = await listen(t, (req, res) => {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(page);
  });
  useServer(t, port);

  let last = Date.now();
  let gap = 0;
  const timer = setInterval(() => {
    gap = Math.max(gap, Date.now() - last);
    last = Date.now();
  }, 20);
  const start = Date.now();
  await metadata(`http://127.0.0.1:${port}/nested`).catch(() => {});
  clearInterval(timer);
  gap = Math.max(gap, Date.now() - last);
  t.true(Date.now() - start < 5000);
  t.true(gap < 500, `event loop blocked for ${gap}ms`);
});

test.serial("metadata reads the canonical link of a page", async (t) => {
  const port = await listen(t, (req, res) => {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(
      `<html><head><meta property="og:title" content="Post"/>` +
        `<link rel="canonical" href="/posts/hello" data-next-head=""/>` +
        `</head><body></body></html>`,
    );
  });
  useServer(t, port);
  const result = await metadata(`http://127.0.0.1:${port}/en/posts/hello`);
  t.is(result.canonicalLink, `http://127.0.0.1:${port}/posts/hello`);
});

test.serial("Paragraph extraction parses off the main thread", async (t) => {
  const pages = {
    "/@kiwi/hello":
      `<html><head><meta property="og:title" content="Hello"/></head>` +
      `<body><div class="prose prose-lg"><p>Body</p></div></body></html>`,
    "/@kiwi/nested": `<html><body>${"<a>".repeat(7000)}</body></html>`,
  };
  const port = await listen(t, (req, res) => {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(pages[req.url]);
  });
  const local = `http://127.0.0.1:${port}`;
  setPageFetchForTests((url, options) =>
    nodeFetch(String(url).replace("https://paragraph.xyz", local), options),
  );
  t.teardown(() => setPageFetchForTests());

  const post = await extractParagraphContent("https://paragraph.xyz/@kiwi/hello");
  t.is(post.title, "Hello");
  t.is(post.content, "<p>Body</p>");

  let last = Date.now();
  let gap = 0;
  const timer = setInterval(() => {
    gap = Math.max(gap, Date.now() - last);
    last = Date.now();
  }, 20);
  const start = Date.now();
  await extractParagraphContent("https://paragraph.xyz/@kiwi/nested");
  clearInterval(timer);
  gap = Math.max(gap, Date.now() - last);
  t.true(Date.now() - start < 6000);
  t.true(gap < 500, `event loop blocked for ${gap}ms`);
});
