// Writes src/web/src/phosphor.json, the community icons' data: every icon of
// Phosphor Icons 2.1.1 (MIT) in the regular weight, with its tags and
// categories, from a copy of the `@phosphor-icons/core` 2.1.1 package:
//
//   node scripts/phosphor-icons.mjs <path to @phosphor-icons/core>
//
// The server draws community icons from it (views/components/communities.mjs)
// and the web client loads it only on the pages that pick an icon. The names
// are the protocol's (src/phosphor-icons.mjs).
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

import { PHOSPHOR_ICONS } from "../src/phosphor-icons.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const core = path.resolve(process.argv[2] || "");
const pkg = JSON.parse(readFileSync(path.join(core, "package.json"), "utf8"));
if (pkg.name !== "@phosphor-icons/core" || pkg.version !== "2.1.1") {
  console.error("Pass the path of @phosphor-icons/core 2.1.1");
  process.exit(1);
}
const { icons } = await import(pathToFileURL(path.join(core, "dist/index.mjs")));

// The picker's chips: Phosphor's categories, with the iOS app's labels.
const categories = [
  ["technology & development", "Tech"],
  ["finances", "Finance"],
  ["nature", "Nature"],
  ["people", "People"],
  ["media", "Media"],
  ["design", "Design"],
  ["communications", "Communication"],
  ["games", "Games"],
  ["health & wellness", "Health"],
  ["brands", "Brands"],
  ["commerce", "Commerce"],
  ["office", "Office"],
  ["editor", "Editor"],
  ["maps & travel", "Travel"],
  ["weather", "Weather"],
  ["objects", "Objects"],
  ["system", "System"],
  ["arrows", "Arrows"],
];
const names = categories.map(([name]) => name);

const rows = icons.map((icon) => {
  const file = path.join(core, "assets/regular", `${icon.name}.svg`);
  const svg = readFileSync(file, "utf8");
  const paths = [...svg.matchAll(/<path d="([^"]+)"\/>/g)].map((m) => m[1]);
  if (paths.length !== 1) throw new Error(`${icon.name}: ${paths.length} paths`);
  const tags = icon.tags.filter((tag) => !tag.startsWith("*"));
  const kinds = icon.categories.map((name) => names.indexOf(name));
  if (kinds.includes(-1)) throw new Error(`${icon.name}: unknown category`);
  return [icon.name, paths[0], tags.join(","), kinds];
});

const listed = new Set(rows.map(([name]) => name));
const missing = PHOSPHOR_ICONS.filter((name) => !listed.has(name));
if (missing.length || listed.size !== PHOSPHOR_ICONS.length) {
  throw new Error(`Doesn't match src/phosphor-icons.mjs: ${missing.join(", ")}`);
}

const out = path.join(root, "src/web/src/phosphor.json");
writeFileSync(
  out,
  JSON.stringify({
    version: pkg.version,
    categories: categories.map(([name, label]) => ({ name, label })),
    icons: rows,
  }),
);
console.log(`Wrote ${rows.length} icons to ${path.relative(root, out)}`);
