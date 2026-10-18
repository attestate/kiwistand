import http from "http";

import test from "ava";

import {
  buildSafeFaviconUrl,
  fetchFavicon,
  sniffFaviconContentType,
  MAX_FAVICON_BYTES,
} from "../src/favicon.mjs";

test("accepts plain registrable domains", (t) => {
  t.is(buildSafeFaviconUrl("example.com"), "https://example.com/favicon.ico");
  t.is(
    buildSafeFaviconUrl("sub.example.com"),
    "https://sub.example.com/favicon.ico",
  );
  t.is(
    buildSafeFaviconUrl("news.kiwistand.com"),
    "https://news.kiwistand.com/favicon.ico",
  );
  // Punycode (IDN) hostnames are fine.
  t.is(
    buildSafeFaviconUrl("xn--80ak6aa92e.com"),
    "https://xn--80ak6aa92e.com/favicon.ico",
  );
});

test("rejects path / query / fragment injection (SSRF + proxy abuse)", (t) => {
  // The `%23` fragment trick from the original report truncated the appended
  // "/favicon.ico" and gave the attacker full path control.
  t.is(buildSafeFaviconUrl("httpbin.org/base64/AAAA%23"), null);
  t.is(buildSafeFaviconUrl("httpbin.org/headers%23"), null);
  t.is(buildSafeFaviconUrl("evil.com/path"), null);
  t.is(buildSafeFaviconUrl("evil.com#"), null);
  t.is(buildSafeFaviconUrl("evil.com?x=1"), null);
  t.is(buildSafeFaviconUrl("evil.com\\foo"), null);
});

test("rejects credentials and explicit ports", (t) => {
  t.is(buildSafeFaviconUrl("user:pass@evil.com"), null);
  t.is(buildSafeFaviconUrl("evil.com:8443"), null);
  // Even an explicit default port is rejected for clarity.
  t.is(buildSafeFaviconUrl("news.kiwistand.com:443"), null);
});

test("rejects raw IP literals and non-DNS hosts", (t) => {
  t.is(buildSafeFaviconUrl("127.0.0.1"), null);
  t.is(buildSafeFaviconUrl("169.254.169.254"), null); // cloud metadata
  t.is(buildSafeFaviconUrl("10.0.0.1"), null);
  t.is(buildSafeFaviconUrl("[::1]"), null);
  t.is(buildSafeFaviconUrl("localhost"), null);
  t.is(buildSafeFaviconUrl("internal"), null);
});

test("rejects malformed hostnames with empty or bad labels", (t) => {
  t.is(buildSafeFaviconUrl("a..com"), null);
  t.is(buildSafeFaviconUrl(".evil.com"), null);
  t.is(buildSafeFaviconUrl("evil..com"), null);
  t.is(buildSafeFaviconUrl("evil.com."), null); // trailing dot
  t.is(buildSafeFaviconUrl("-evil.com"), null); // label starts with hyphen
  t.is(buildSafeFaviconUrl("evil-.com"), null); // label ends with hyphen
  t.is(buildSafeFaviconUrl("example.c"), null); // TLD too short
  // Well-formed names still pass.
  t.is(buildSafeFaviconUrl("a.co"), "https://a.co/favicon.ico");
  t.is(buildSafeFaviconUrl("my-site.io"), "https://my-site.io/favicon.ico");
});

test("rejects empty, oversized and non-string input", (t) => {
  t.is(buildSafeFaviconUrl(""), null);
  t.is(buildSafeFaviconUrl(undefined), null);
  t.is(buildSafeFaviconUrl(null), null);
  t.is(buildSafeFaviconUrl(123), null);
  t.is(buildSafeFaviconUrl("a".repeat(300) + ".com"), null);
  t.is(buildSafeFaviconUrl("has space.com"), null);
});

test("sniff recognizes raster image formats", (t) => {
  t.is(
    sniffFaviconContentType(
      Uint8Array.from([0x00, 0x00, 0x01, 0x00, 1, 2, 3, 4]),
    ),
    "image/x-icon",
  );
  t.is(
    sniffFaviconContentType(
      Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]),
    ),
    "image/png",
  );
  t.is(
    sniffFaviconContentType(Uint8Array.from([0x47, 0x49, 0x46, 0x38, 1, 2])),
    "image/gif",
  );
  t.is(
    sniffFaviconContentType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])),
    "image/jpeg",
  );
  t.is(
    sniffFaviconContentType(Uint8Array.from([0x42, 0x4d, 1, 2, 3])),
    "image/bmp",
  );
  t.is(
    sniffFaviconContentType(
      Uint8Array.from([
        0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
      ]),
    ),
    "image/webp",
  );
});

test("sniff rejects HTML/JS and other non-image bodies", (t) => {
  const html = new TextEncoder().encode(
    "<html><body><script>alert(document.domain)</script></body></html>",
  );
  t.is(sniffFaviconContentType(html), null);
  // SVG is deliberately not recognized (active content).
  const svg = new TextEncoder().encode(
    '<svg xmlns="http://www.w3.org/2000/svg">',
  );
  t.is(sniffFaviconContentType(svg), null);
  t.is(sniffFaviconContentType(new TextEncoder().encode("{}")), null);
  t.is(sniffFaviconContentType(new Uint8Array([1, 2])), null);
});

test("accepts punycode IDN TLDs", (t) => {
  t.is(
    buildSafeFaviconUrl("example.xn--p1ai"),
    "https://example.xn--p1ai/favicon.ico",
  );
});

// Spin up a local HTTP server for the fetchFavicon tests. The default agent
// (request-filtering-agent) blocks loopback, so tests that need to reach the
// local server pass a plain agent; the SSRF test uses the default one.
async function withServer(handler, fn) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    return await fn(base);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const plainAgent = () => new http.Agent();

test("fetchFavicon follows redirects (e.g. apex -> www)", async (t) => {
  await withServer(
    (req, res) => {
      if (req.url === "/favicon.ico") {
        res.writeHead(301, { Location: "/www/favicon.ico" });
        return res.end();
      }
      res.writeHead(200, { "Content-Type": "image/png" });
      res.end(PNG);
    },
    async (base) => {
      const response = await fetchFavicon(`${base}/favicon.ico`, {
        agent: plainAgent,
      });
      t.true(response.ok);
      const buffer = await response.arrayBuffer();
      t.is(sniffFaviconContentType(buffer), "image/png");
    },
  );
});

test("fetchFavicon blocks loopback targets by default", async (t) => {
  await withServer(
    (req, res) => {
      res.writeHead(200);
      res.end(PNG);
    },
    async (base) => {
      // Default agent: request-filtering-agent refuses loopback targets.
      await t.throwsAsync(fetchFavicon(`${base}/favicon.ico`));
    },
  );
});

test("fetchFavicon resolves the agent for every redirect hop", async (t) => {
  // The SSRF guard is only effective on redirects if node-fetch asks for an
  // agent per hop rather than reusing the first one.
  const hops = [];
  await withServer(
    (req, res) => {
      if (req.url === "/favicon.ico") {
        res.writeHead(302, { Location: "/other/favicon.ico" });
        return res.end();
      }
      res.writeHead(200);
      res.end(PNG);
    },
    async (base) => {
      await fetchFavicon(`${base}/favicon.ico`, {
        agent: (parsedURL) => {
          hops.push(parsedURL.href);
          return new http.Agent();
        },
      });
      t.deepEqual(hops, [`${base}/favicon.ico`, `${base}/other/favicon.ico`]);
    },
  );
});

test("fetchFavicon caps the body size without a content-length", async (t) => {
  let sent = 0;
  await withServer(
    (req, res) => {
      res.writeHead(200, { "Content-Type": "image/png" });
      const chunk = Buffer.alloc(64 * 1024);
      const write = () => {
        while (sent < MAX_FAVICON_BYTES * 4) {
          sent += chunk.length;
          if (!res.write(chunk)) return res.once("drain", write);
        }
        res.end();
      };
      write();
    },
    async (base) => {
      const response = await fetchFavicon(`${base}/favicon.ico`, {
        agent: plainAgent,
      });
      const err = await t.throwsAsync(response.arrayBuffer());
      t.is(err.type, "max-size");
      t.true(sent < MAX_FAVICON_BYTES * 4);
    },
  );
});
