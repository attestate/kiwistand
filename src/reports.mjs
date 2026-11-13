// @format
// Reports of objectionable content (App Review Guideline 1.2). The iOS app's
// "Report post", "Report comment" and "Report user" send them here, so
// reporting works in the app without a mail account. Each report is kept in
// reports.db and emailed to the moderators (REPORTS_EMAIL), who act on it
// within 24 hours, as the community rules (/guidelines) promise.
import { env } from "process";
import path from "path";

import Database from "better-sqlite3";
import postmark from "postmark";

import log from "./logger.mjs";

export const TYPES = ["story", "comment", "user"];
const MAX_TARGET = 200;
const MAX_REASON = 1000;

let db;
function database() {
  if (db) return db;
  db = new Database(path.join(env.DATA_DIR, "reports.db"));
  db.exec(`
     CREATE TABLE IF NOT EXISTS reports (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       type TEXT NOT NULL,
       target TEXT NOT NULL,
       reason TEXT NOT NULL,
       created INTEGER NOT NULL
     )
   `);
  return db;
}

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
  if (type === "user") return `${base}/upvotes?address=${target}`;
  if (type === "comment") return null;
  const index = target.replace(/^kiwi:/, "").replace(/^0x/, "");
  return `${base}/stories?index=0x${index}`;
}

export function save(report, now = Date.now(), database_ = database()) {
  const created = Math.floor(now / 1000);
  const { lastInsertRowid } = database_
    .prepare(
      `INSERT INTO reports (type, target, reason, created)
       VALUES (?, ?, ?, ?)`,
    )
    .run(report.type, report.target, report.reason, created);
  return { ...report, id: Number(lastInsertRowid), created };
}

let client;
async function notify(report) {
  const to = env.REPORTS_EMAIL;
  if (env.NODE_ENV !== "production" || !env.POSTMARK_API_KEY || !to) {
    log(`reports: Not emailing report ${report.id}, no REPORTS_EMAIL`);
    return;
  }
  client ??= new postmark.ServerClient(env.POSTMARK_API_KEY);
  await client.sendEmail({
    From: "Kiwi News reports <noreply@news.kiwistand.com>",
    To: to,
    Subject: `Report #${report.id}: ${report.type} ${report.target}`,
    TextBody: [
      `A ${report.type} was reported. Act on it within 24 hours.`,
      "",
      `Type: ${report.type}`,
      `ID: ${report.target}`,
      `Reason: ${report.reason || "(none given)"}`,
      ...(link(report) ? [`Open: ${link(report)}`] : []),
    ].join("\n"),
    MessageStream: "outbound",
  });
}

// Keeps a report and emails it; the email failing doesn't lose the report.
export async function add(body) {
  const report = save(parse(body));
  try {
    await notify(report);
  } catch (err) {
    log(`reports: Emailing report ${report.id} failed: ${err.message}`);
  }
  return report;
}
