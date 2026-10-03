#!/usr/bin/env node
// @format
//
// Shows why a link gets the preview it gets: the parser's debug log, its
// output, and the raw preview tags of the page as fetched from this machine.
//
//   node scripts/preview-debug.mjs <url> [<url> ...]
//
// The parser's caches go to a throwaway temp dir.
import { env } from "process";
import path from "path";
import os from "os";
import { mkdtempSync, rmSync } from "fs";

env.DEBUG = env.DEBUG || "@attestate/kiwistand";
const tmp = mkdtempSync(path.join(os.tmpdir(), "preview-debug-"));
env.CACHE_DIR = tmp;
const { metadata } = await import("../src/parser.mjs");

const tagPattern =
  /<meta[^>]+(?:property|name)=["'](?:og:|twitter:)(?:title|image|description)[^>]*>|<link[^>]+rel=["'](?:image_src|icon|apple-touch-icon)["'][^>]*>|<title[^>]*>[^<]*<\/title>/gi;

for (const url of process.argv.slice(2)) {
  console.log(`\n===== ${url}`);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": env.USER_AGENT || "Mozilla/5.0" },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    const html = await response.text();
    console.log(`status ${response.status}, ${response.headers.get("content-type")}, ${html.length} bytes, final ${response.url}`);
    console.log((html.match(tagPattern) || ["(no preview tags)"]).slice(0, 20).join("\n"));
    console.log(`<img> tags: ${(html.match(/<img\b/gi) || []).length}`);
  } catch (err) {
    console.log(`raw fetch failed: ${err.message}`);
  }
  try {
    console.log("metadata:", JSON.stringify(await metadata(url), null, 2));
  } catch (err) {
    console.log(`metadata threw: ${err.message}`);
  }
}
rmSync(tmp, { recursive: true, force: true });
process.exit(0);
