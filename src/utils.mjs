import path from "path";
import { fileURLToPath } from "url";

function dirname() {
  const filename = fileURLToPath(import.meta.url);
  return path.dirname(filename);
}

export function appdir() {
  return path.resolve(dirname(), "../");
}

export function elog(err, msg) {
  if (msg) {
    console.error(`Message: ${msg}`);
  }
  console.error(`Stack Trace: ${err.stack}`);
}
