//@format
// The site links to its own docs at /docs (src/docs.mjs), not to the old
// docs sites: kiwistand.github.io/kiwi-docs and attestate.com/kiwistand.
import test from "ava";
import { readdirSync, readFileSync } from "fs";
import path from "path";

import footer from "../src/views/components/footer.mjs";
import { SideFooter } from "../src/views/components/right-column.mjs";

const RETIRED = ["kiwistand.github.io/kiwi-docs", "attestate.com/kiwistand"];

// htm returns an array for several root elements.
const render = (view) => [].concat(view).join("");
const hrefs = (html) => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
const linkTo = (html, label) => {
  const match = html.match(new RegExp(`href="([^"]*)"[^>]*>\\s*${label}\\s*</a`));
  return match && match[1];
};

test("the footer's Docs and API lead to /docs", (t) => {
  const html = render(footer("light", "/"));
  t.is(linkTo(html, "Docs"), "/docs/");
  t.is(linkTo(html, "API"), "/docs/http-api");
  for (const href of hrefs(html)) {
    t.false(RETIRED.some((old) => href.includes(old)), href);
  }
});

test("the side column's About and API lead to /docs", (t) => {
  const html = render(SideFooter());
  t.is(linkTo(html, "About"), "/docs/");
  t.is(linkTo(html, "API"), "/docs/http-api");
  for (const href of hrefs(html)) {
    t.false(RETIRED.some((old) => href.includes(old)), href);
  }
});

// Sources only: no dependencies, builds or generated files.
const SKIP = ["node_modules", "dist", "assets", "previews", "changelog.md"];

function* files(dir, extensions) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.includes(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* files(file, extensions);
    else if (extensions.includes(path.extname(entry.name))) yield file;
  }
}

test("nothing in the site or the docs links to the retired docs sites", (t) => {
  const sources = [
    ...files("src", [".mjs", ".jsx", ".txt"]),
    ...files("docs/src", [".mdx", ".md", ".tsx", ".ts"]),
    "docs/vocs.config.ts",
    "readme.md",
  ];
  t.true(sources.length > 100);
  for (const file of sources) {
    const text = readFileSync(file, "utf8");
    for (const old of RETIRED) {
      t.false(text.includes(old), `${file} links to ${old}`);
    }
  }
});
