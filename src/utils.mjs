import path from "path";
import { fileURLToPath } from "url";

function dirname() {
  const filename = fileURLToPath(import.meta.url);
  return path.dirname(filename);
}

export function appdir() {
  return path.resolve(dirname(), "../");
}
