//@format
import test from "ava";
import express from "express";
import http from "http";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";

import { docs, PAGE_CACHE, ASSET_CACHE, FILE_CACHE, NOT_FOUND_CACHE } from "../src/docs.mjs";
import { createLoadBalancerApp } from "../src/load-balancer.mjs";

function write(root, file, content) {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), content);
}

// A docs build as `npm run build:docs` writes it: pages as <page>.html, a
// page with sub-pages next to its folder, hashed assets, the router's
// payloads and the 404 page.
function makeBuild() {
  const dir = mkdtempSync(path.join(tmpdir(), "docs-test-"));
  write(dir, "index.html", "<h1>home</h1>");
  write(dir, "protocol.html", "<h1>protocol</h1>");
  write(dir, "guide.html", "<h1>guide</h1>");
  write(dir, "guide/figures.html", "<h1>guide figures</h1>");
  write(dir, "assets/main-abc123.js", "console.log(1)");
  write(dir, "RSC/R/protocol.txt", "rsc");
  write(dir, "wordmark-light.svg", "<svg/>");
  write(dir, "404.html", "<h1>not found</h1>");
  return dir;
}

const listen = (app) =>
  new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });

async function serve(t, options) {
  const app = express();
  app.use("/docs", docs(options));
  app.use((req, res) => res.status(418).send("app"));
  const server = await listen(app);
  t.teardown(() => server.close());
  const { port } = server.address();
  const get = (p) => fetch(`http://127.0.0.1:${port}${p}`, { redirect: "manual" });
  // fetch resolves "..", http.request sends the path as it is.
  get.raw = (p) =>
    new Promise((resolve, reject) => {
      http
        .get({ host: "127.0.0.1", port, path: p }, (res) => {
          let body = "";
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () => resolve({ status: res.statusCode, body }));
        })
        .on("error", reject);
    });
  return get;
}

test("serves the pages, assets and payloads of the docs build", async (t) => {
  const dir = makeBuild();
  t.teardown(() => rmSync(dir, { recursive: true, force: true }));
  const get = await serve(t, { dir, production: true });

  for (const [p, body] of [
    ["/docs/", "<h1>home</h1>"],
    ["/docs/protocol", "<h1>protocol</h1>"],
    // guide.html, although a guide/ folder exists
    ["/docs/guide", "<h1>guide</h1>"],
    ["/docs/guide/figures", "<h1>guide figures</h1>"],
  ]) {
    const res = await get(p);
    t.is(res.status, 200, p);
    t.is(await res.text(), body, p);
    t.regex(res.headers.get("content-type"), /^text\/html/, p);
    t.is(res.headers.get("cache-control"), PAGE_CACHE, p);
  }

  const asset = await get("/docs/assets/main-abc123.js");
  t.is(asset.status, 200);
  t.regex(asset.headers.get("content-type"), /javascript/);
  t.is(asset.headers.get("cache-control"), ASSET_CACHE);

  const rsc = await get("/docs/RSC/R/protocol.txt");
  t.is(rsc.status, 200);
  t.is(rsc.headers.get("cache-control"), PAGE_CACHE);

  const logo = await get("/docs/wordmark-light.svg");
  t.is(logo.status, 200);
  t.is(logo.headers.get("cache-control"), FILE_CACHE);
});

test("redirects /docs to /docs/ and drops other trailing slashes", async (t) => {
  const dir = makeBuild();
  t.teardown(() => rmSync(dir, { recursive: true, force: true }));
  const get = await serve(t, { dir });

  let res = await get("/docs");
  t.is(res.status, 301);
  t.is(res.headers.get("location"), "/docs/");

  res = await get("/docs?q=1");
  t.is(res.headers.get("location"), "/docs/?q=1");

  res = await get("/docs/protocol/");
  t.is(res.status, 301);
  t.is(res.headers.get("location"), "/docs/protocol");
});

test("answers unknown docs paths with the docs' 404 page", async (t) => {
  const dir = makeBuild();
  t.teardown(() => rmSync(dir, { recursive: true, force: true }));
  const get = await serve(t, { dir });

  for (const p of ["/docs/nope", "/docs/assets/missing.js"]) {
    const res = await get(p);
    t.is(res.status, 404, p);
    t.is(await res.text(), "<h1>not found</h1>", p);
    t.is(res.headers.get("cache-control"), NOT_FOUND_CACHE, p);
  }

  // Nothing outside the build: the file next to it isn't served.
  write(path.dirname(dir), `${path.basename(dir)}-secret.txt`, "secret");
  t.teardown(() => rmSync(`${dir}-secret.txt`, { force: true }));
  for (const p of [
    `/docs/../${path.basename(dir)}-secret.txt`,
    `/docs/%2e%2e/${path.basename(dir)}-secret.txt`,
    "/docs/..%2fpackage.json",
  ]) {
    const res = await get.raw(p);
    t.not(res.body, "secret", p);
    t.not(res.status, 200, p);
  }

  // Outside /docs the app answers as before.
  t.is((await get("/documents")).status, 418);
});

test("only sets cache headers for static files in production", async (t) => {
  const dir = makeBuild();
  t.teardown(() => rmSync(dir, { recursive: true, force: true }));
  const get = await serve(t, { dir, production: false });

  t.is((await get("/docs/assets/main-abc123.js")).headers.get("cache-control"), null);
  t.is((await get("/docs/protocol")).headers.get("cache-control"), PAGE_CACHE);
});

test("is a clean 404 when the docs aren't built", async (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "docs-test-empty-"));
  t.teardown(() => rmSync(dir, { recursive: true, force: true }));
  const get = await serve(t, { dir: path.join(dir, "missing") });

  for (const p of ["/docs", "/docs/", "/docs/protocol"]) {
    const res = await get(p);
    t.is(res.status, 404, p);
    t.is(await res.text(), "Not found", p);
  }
});

test("the load balancer sends /docs to the workers", async (t) => {
  const upstream = async (name) => {
    const app = express();
    app.use((req, res) => res.send(`${name} ${req.originalUrl}`));
    const server = await listen(app);
    t.teardown(() => server.close());
    return server.address().port;
  };
  const primaryPort = await upstream("primary");
  const workerBasePort = await upstream("worker");
  const lb = await listen(createLoadBalancerApp({ primaryPort, workerBasePort, workerCount: 1 }));
  t.teardown(() => lb.close());
  const base = `http://127.0.0.1:${lb.address().port}`;

  for (const p of ["/docs", "/docs/", "/docs/protocol", "/docs/assets/main-abc123.js"]) {
    t.is(await (await fetch(base + p, { redirect: "manual" })).text(), `worker ${p}`, p);
  }
  t.is(await (await fetch(base + "/documents")).text(), "primary /documents");
});
