import path from "path";
import { fileURLToPath } from "url";

export function dirname() {
  const filename = fileURLToPath(import.meta.url);
  return path.dirname(filename);
}

export function appdir() {
  return path.resolve(dirname(), "../");
}
