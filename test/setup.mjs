// Loaded via ava's `require` config before every test file. Creates the
// throwaway directories that `ava.environmentVariables` points CACHE_DIR and
// DATA_DIR at, so tests run without a local .env.
import { mkdirSync } from "fs";

for (const dir of [process.env.CACHE_DIR, process.env.DATA_DIR]) {
  if (dir) mkdirSync(dir, { recursive: true });
}
