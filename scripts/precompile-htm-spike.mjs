// Spike: precompile a single view file with babel-plugin-htm and write the
// result next to the source for inspection. This is intentionally minimal — it
// proves the toolchain works and gives us something to benchmark against the
// runtime htm version. Not wired into the build yet.
import { readFile, writeFile } from "fs/promises";
import { fileURLToPath } from "url";
import path from "path";
import { transformAsync } from "@babel/core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const target = process.argv[2] || "src/views/shortcut.mjs";
const inputPath = path.resolve(repoRoot, target);
const outputPath = inputPath.replace(/\.mjs$/, ".compiled.mjs");

const source = await readFile(inputPath, "utf8");

const result = await transformAsync(source, {
  filename: inputPath,
  babelrc: false,
  configFile: false,
  sourceType: "module",
  plugins: [
    [
      "babel-plugin-htm",
      {
        tag: "html",
        // vhtml's default export is a hyperscript function with the shape
        // vhtml(tag, props, ...children) returning an HTML string. The plugin
        // emits direct pragma(tag, props, ...children) calls, so we point it
        // straight at vhtml. After compilation, `import htm from "htm"` and
        // `const html = htm.bind(vhtml)` become dead code (we can leave them
        // in or strip them — leaving them in for now keeps the diff small).
        pragma: "vhtml",
      },
    ],
  ],
});

await writeFile(outputPath, result.code, "utf8");
console.log(`wrote ${path.relative(repoRoot, outputPath)}`);
