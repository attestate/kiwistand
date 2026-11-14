// @format
// Reports of objectionable content (App Review Guideline 1.2). The iOS app's
// "Report post", "Report comment" and "Report user" send them here, so
// reporting works in the app without a mail account; so does Settings ->
// "Delete account" (Guideline 5.1.1(v)). Each report is a line in
// DATA_DIR/reports.csv, which opens in Excel or Numbers, and the account in
// REPORTS_ADDRESS gets a push in the iOS app saying a report came in (the
// push says nothing about it). The moderators act on it within 24 hours,
// as the community rules (/guidelines) promise.
import { env } from "process";
import { appendFileSync, existsSync } from "fs";
import path from "path";

import log from "./logger.mjs";
import { sendPushNotification } from "./onesignal.mjs";

export const TYPES = ["story", "comment", "user", "account-deletion"];
const MAX_TARGET = 200;
const MAX_REASON = 1000;
const HEADER = ["time", "type", "id", "reason", "link"];

// The report in a request body, or throws with what's wrong.
export function parse(body) {
  const { type, id, reason = "" } = body ?? {};
  if (!TYPES.includes(type)) {
    throw new Error(`"type" must be one of ${TYPES.join(", ")}`);
  }
  if (
    typeof id !== "string" ||
    !id.length ||
    id.length > MAX_TARGET ||
    !/^[\w:.\-@]+$/.test(id)
  ) {
    throw new Error(`"id" must be a story, comment or user ID`);
  }
  if (typeof reason !== "string" || reason.length > MAX_REASON) {
    throw new Error(`"reason" must be text of up to ${MAX_REASON} characters`);
  }
  return { type, target: id, reason: reason.trim() };
}

// Where a moderator looks at the reported story or user. A comment's ID
// doesn't name its story, so a comment has no link.
export function link({ type, target }) {
  const base = "https://news.kiwistand.com";
  if (type === "user" || type === "account-deletion") {
    return `${base}/upvotes?address=${target}`;
  }
  if (type === "comment") return null;
  const index = target.replace(/^kiwi:/, "").replace(/^0x/, "");
  return `${base}/stories?index=0x${index}`;
}

// One CSV field. Anyone can write the reason, so a value that Excel would
// run as a formula (=, +, -, @) gets a leading apostrophe.
function field(value) {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function row(report, now = Date.now()) {
  const values = [
    new Date(now).toISOString(),
    report.type,
    report.target,
    report.reason,
    link(report) ?? "",
  ];
  return values.map(field).join(",") + "\n";
}

// Appends a parsed report to reports.csv, with the header if the file is new.
export function save(report, now = Date.now(), dir = env.DATA_DIR) {
  const file = path.join(dir, "reports.csv");
  const header = existsSync(file) ? "" : HEADER.map(field).join(",") + "\n";
  appendFileSync(file, header + row(report, now));
  log(`reports: ${report.type} ${report.target} reported`);
  return report;
}

// Pushes "A new report came in" to REPORTS_ADDRESS, at most once a minute
// per process, so a burst of reports doesn't flood the phone.
const PUSH_GAP = 60 * 1000;
let lastPush = 0;
export function notify(now = Date.now(), send = sendPushNotification) {
  const address = env.REPORTS_ADDRESS;
  if (!address || now - lastPush < PUSH_GAP) return false;
  lastPush = now;
  Promise.resolve(
    send([address], {
      title: "New report",
      body: "A new report came in. Check reports.csv.",
    }),
  ).catch((err) => log(`reports: Push failed: ${err.message}`));
  return true;
}
