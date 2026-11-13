//@format
// Serves the docs site (docs/, built with Vocs) at /docs. `npm run build:docs`
// writes it to docs/dist/public as static files: a page is <page>.html (see
// docs/scripts/postbuild.mjs), the home page is index.html, and assets/ holds
// files whose names carry a content hash.
import { existsSync } from "fs";
import path from "path";
import express from "express";
import sirv from "sirv";

export const DOCS_DIR = path.resolve("docs/dist/public");

// Pages and the client router's payloads (RSC/*.txt) change with every docs
// deploy, so Cloudflare keeps them for an hour and browsers revalidate.
export const PAGE_CACHE =
  "public, s-maxage=3600, max-age=0, stale-while-revalidate=86400";
// Like the site's /assets: the names change when the content does.
export const ASSET_CACHE =
  "public, max-age=604800, s-maxage=604800, immutable, stale-while-revalidate=2592000";
// The wordmark and the other files of docs/public keep their names across
// builds.
export const FILE_CACHE =
  "public, max-age=86400, s-maxage=86400, stale-while-revalidate=600000";
export const NOT_FOUND_CACHE = "public, s-maxage=60, max-age=0";

export function cacheControl(pathname) {
  if (pathname.startsWith("/assets/")) return ASSET_CACHE;
  if (pathname.startsWith("/RSC/")) return PAGE_CACHE;
  if (pathname.endsWith(".html") || !path.posix.extname(pathname)) return PAGE_CACHE;
  return FILE_CACHE;
}

// Returns a router to mount at /docs. Without a build in `dir` every docs
// path is a plain 404. sirv indexes `dir` once, so a new build is picked up
// on the restart that follows a deploy.
export function docs({ dir = DOCS_DIR, production = process.env.NODE_ENV === "production" } = {}) {
  const router = express.Router();
  const built = existsSync(path.join(dir, "index.html"));

  if (!built) {
    router.use((req, res) => {
      res.setHeader("Cache-Control", NOT_FOUND_CACHE);
      res.status(404).type("text/plain").send("Not found");
    });
    return router;
  }

  // The client router needs the home page at /docs/, with the slash. Every
  // other page lives without one, as the docs link them.
  router.use((req, res, next) => {
    const { pathname, search } = new URL(req.originalUrl, "http://localhost");
    if (pathname === "/docs") return res.redirect(301, `/docs/${search}`);
    if (pathname.length > "/docs/".length && pathname.endsWith("/")) {
      return res.redirect(301, pathname.replace(/\/+$/, "") + search);
    }
    next();
  });

  router.use(
    sirv(dir, {
      // <page> is served from <page>.html, also when a <page>/ folder of
      // sub-pages exists next to it.
      extensions: ["html"],
      setHeaders: (res, pathname) => {
        const value = cacheControl(pathname);
        if (value === PAGE_CACHE || production) res.setHeader("Cache-Control", value);
      },
    }),
  );

  router.use((req, res) => {
    res.setHeader("Cache-Control", NOT_FOUND_CACHE);
    res.status(404).sendFile("404.html", { root: dir, cacheControl: false, lastModified: false }, (err) => {
      if (err && !res.headersSent) res.type("text/plain").send("Not found");
    });
  });

  return router;
}
