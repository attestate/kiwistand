//@format
import test from "ava";
import { execFileSync, spawnSync } from "child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
  chmodSync,
  copyFileSync,
} from "fs";
import { tmpdir } from "os";
import path from "path";
import { fileURLToPath } from "url";

import { deployFiles, findForbidden } from "../scripts/deploy-files.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

function write(root, file, content = "x") {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), content);
}

function git(root, ...args) {
  execFileSync("git", ["-C", root, ...args], { stdio: "ignore" });
}

// A checkout like a developer's: tracked code, gitignored build outputs, and
// untracked secrets lying around.
function makeRepo() {
  const root = mkdtempSync(path.join(tmpdir(), "deploy-files-test-"));
  git(root, "init", "-q");
  write(root, ".gitignore", "src/public/assets/*\nsrc/public/manifest.json\n.env\n");
  write(root, "package.json", "{}");
  write(root, "src/index.mjs");
  write(root, "test/id_test.mjs");
  write(root, "docs/src/pages/index.mdx");
  write(root, ".env-copy", "KEY=");
  git(root, "add", "-A");

  // build outputs (gitignored or untracked)
  write(root, "src/public/manifest.json", "{}");
  write(root, "src/public/.vite/manifest.json", "{}");
  write(root, "src/public/news.min.css");
  write(root, "src/public/pages.min.css");
  write(root, "src/public/assets/index-abc123.js");
  write(root, "docs/dist/public/index.html");
  write(root, "docs/dist/public/assets/main-def456.js");

  // untracked secrets and server-only files
  write(root, ".env", "SECRET=1");
  write(root, ".keys.json", "{}");
  write(root, "mcp.config.json", "{}");
  write(root, ".aider.chat.history.md");
  write(root, "staging.kiwistand.com/key.pem");
  write(root, "src/fingerprint.mjs");
  write(root, "data/db");
  write(root, "notes.txt");
  return root;
}

test("ships tracked files and build outputs, never untracked files", (t) => {
  const root = makeRepo();
  t.teardown(() => rmSync(root, { recursive: true, force: true }));

  const list = deployFiles(root);
  t.deepEqual(list, [
    ".gitignore",
    "docs/dist/public/assets/main-def456.js",
    "docs/dist/public/index.html",
    "package.json",
    "src/index.mjs",
    "src/public/.vite/manifest.json",
    "src/public/assets/index-abc123.js",
    "src/public/manifest.json",
    "src/public/news.min.css",
    "src/public/pages.min.css",
    "test/id_test.mjs",
  ]);
  for (const secret of [".env", ".keys.json", "mcp.config.json", ".aider.chat.history.md"]) {
    t.false(list.includes(secret), secret);
  }
  t.false(list.some((f) => f.startsWith("staging.kiwistand.com/")));
  t.false(list.includes("src/fingerprint.mjs"));
  t.false(list.includes("data/db"));
  // The docs ship as their build, not as sources.
  t.false(list.includes("docs/src/pages/index.mdx"));
});

test("refuses to deploy a tracked .env", (t) => {
  const root = makeRepo();
  t.teardown(() => rmSync(root, { recursive: true, force: true }));
  git(root, "add", "-f", ".env");

  const err = t.throws(() => deployFiles(root));
  t.regex(err.message, /Refusing to deploy/);
  t.regex(err.message, /\.env\s+\(matches \.env\*\)/);
});

test("refuses to deploy without build outputs", (t) => {
  const root = makeRepo();
  t.teardown(() => rmSync(root, { recursive: true, force: true }));
  rmSync(path.join(root, "src/public/manifest.json"));

  t.throws(() => deployFiles(root), { message: /npm run build/ });
});

test("refuses to deploy without the docs build", (t) => {
  const root = makeRepo();
  t.teardown(() => rmSync(root, { recursive: true, force: true }));
  rmSync(path.join(root, "docs/dist"), { recursive: true });

  t.throws(() => deployFiles(root), { message: /npm run build:docs/ });
});

test("skips tracked files deleted from the working tree", (t) => {
  const root = makeRepo();
  t.teardown(() => rmSync(root, { recursive: true, force: true }));
  rmSync(path.join(root, "src/index.mjs"));

  t.false(deployFiles(root).includes("src/index.mjs"));
});

test("guard patterns", (t) => {
  const bad = [
    ".env",
    ".env.production",
    "src/.env.local",
    ".keys.json",
    "staging.kiwistand.com/key.pem",
    "certs/server.key",
    "cert.p12",
    "mcp.config.json",
    ".aider.input.history",
    "id_rsa",
    ".ssh/id_ed25519.pub",
    "data/messages.db",
    "cache/database.db",
    "bootstrap/x",
    "certificates/cert.pem",
    "logs/out.log",
    "node_modules/a/index.js",
  ];
  t.deepEqual(
    findForbidden(bad).map((h) => h.file),
    bad,
  );
  const good = [
    "test/id_test.mjs",
    "src/public/manifest.json",
    "src/keys.mjs",
    "src/data/x.mjs",
    "src/views/env.mjs",
    "keyboard.md",
  ];
  t.deepEqual(findForbidden(good), []);
});

// scripts/server-install.sh with a fake `npm` on PATH.
function makeServer(npmExit) {
  const dir = mkdtempSync(path.join(tmpdir(), "server-install-test-"));
  mkdirSync(path.join(dir, "scripts"));
  copyFileSync(
    path.join(here, "../scripts/server-install.sh"),
    path.join(dir, "scripts/server-install.sh"),
  );
  write(dir, "package-lock.json", '{"v":1}');
  write(dir, "node_modules/old/index.js", "old");
  const bin = path.join(dir, "bin");
  mkdirSync(bin);
  // Like npm ci: deletes node_modules, then installs (or fails halfway).
  write(
    bin,
    "npm",
    `#!/usr/bin/env bash\necho "$@" >> "${dir}/npm-calls"\nrm -rf node_modules\nmkdir -p node_modules/new\n${
      npmExit ? `exit ${npmExit}` : "echo new > node_modules/new/index.js"
    }\n`,
  );
  chmodSync(path.join(bin, "npm"), 0o755);
  const run = () =>
    spawnSync("bash", [path.join(dir, "scripts/server-install.sh")], {
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
      encoding: "utf8",
    });
  const calls = () =>
    existsSync(path.join(dir, "npm-calls"))
      ? readFileSync(path.join(dir, "npm-calls"), "utf8").trim().split("\n")
      : [];
  return { dir, run, calls };
}

const hasSha256sum = spawnSync("sha256sum", ["--version"]).status === 0;
const shaTest = hasSha256sum ? test : test.skip;

shaTest("server install runs npm ci once per lockfile", (t) => {
  const { dir, run, calls } = makeServer(0);
  t.teardown(() => rmSync(dir, { recursive: true, force: true }));

  t.is(run().status, 0);
  t.deepEqual(calls(), ["ci"]);
  t.true(existsSync(path.join(dir, ".deployed-lock.sha256")));
  t.false(existsSync(path.join(dir, "node_modules.prev")));

  t.is(run().status, 0);
  t.deepEqual(calls(), ["ci"], "unchanged lockfile: no second npm ci");

  write(dir, "package-lock.json", '{"v":2}');
  t.is(run().status, 0);
  t.deepEqual(calls(), ["ci", "ci"]);
});

shaTest("server install fails loudly and restores node_modules when npm ci fails", (t) => {
  const { dir, run, calls } = makeServer(1);
  t.teardown(() => rmSync(dir, { recursive: true, force: true }));

  const res = run();
  t.is(res.status, 1);
  t.regex(res.stderr, /npm ci FAILED/);
  t.deepEqual(calls(), ["ci"]);
  t.is(readFileSync(path.join(dir, "node_modules/old/index.js"), "utf8"), "old");
  t.false(existsSync(path.join(dir, "node_modules/new")));
  t.false(existsSync(path.join(dir, ".deployed-lock.sha256")), "retried next deploy");
});
