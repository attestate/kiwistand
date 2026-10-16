// Writes minified copies of the stylesheets the server renders into every
// page, src/public/news.css and pages.css, as news.min.css and pages.min.css.
// The server sends them in their place (src/http.mjs): comments and
// whitespace are ~40% of news.css even gzipped, and it blocks rendering.
// Each starts with a comment naming its source's hash, so the server skips
// a copy that is older than its source (e.g. news.css edited without a
// build). Run by `npm run build` after vite.
import { readFileSync, writeFileSync } from "fs";
import { createHash } from "crypto";
import { fileURLToPath } from "url";
import path from "path";
import { transformWithEsbuild } from "vite";

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");

for (const name of ["news", "pages"]) {
  const source = readFileSync(path.join(publicDir, `${name}.css`), "utf8");
  const hash = createHash("md5").update(source).digest("hex").substring(0, 8);
  // NOTE: No target, so esbuild only drops whitespace and comments and
  // shortens values; it doesn't rewrite modern syntax (:has(), nesting).
  const { code } = await transformWithEsbuild(source, `${name}.css`, {
    loader: "css",
    minify: true,
    sourcemap: false,
    legalComments: "none",
  });
  writeFileSync(path.join(publicDir, `${name}.min.css`), `/*${hash}*/${code}`);
  console.log(
    `${name}.css: ${(source.length / 1024).toFixed(1)} KB -> ${name}.min.css ${(code.length / 1024).toFixed(1)} KB`,
  );
}
