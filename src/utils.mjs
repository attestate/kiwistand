import path from "path";
import { fileURLToPath } from "url";

function dirname() {
  const filename = fileURLToPath(import.meta.url);
  return path.dirname(filename);
}

export function truncate(comment, maxLength = 260) {
  if (
    !comment ||
    (comment && comment.length <= maxLength) ||
    (comment && comment.length === 0)
  )
    return comment;
  return comment.slice(0, comment.lastIndexOf(" ", maxLength)) + "...";
}

export function truncateName(name) {
  const maxLength = 12;
  if (
    !name ||
    (name && name.length <= maxLength) ||
    (name && name.length === 0)
  )
    return name;
  return name.slice(0, maxLength) + "...";
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
