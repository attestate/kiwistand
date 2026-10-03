//@format
import { env } from "process";
import { appendFile, readFile } from "fs/promises";
import path from "path";

import { LRUCache } from "lru-cache";

import log from "./logger.mjs";

// NOTE: Content reports, e.g. from the iOS app's "Report" button. Apple
// requires apps with user-generated content to let people report it, so we
// store each report as a line in a JSONL file that admins can read via
// GET /api/v1/reports (x-admin-key).
const REPORTS_FILE = path.join(env.DATA_DIR || "data", "reports.jsonl");
const TYPES = ["story", "comment", "user"];
const MAX_ID_LENGTH = 200;
const MAX_REASON_LENGTH = 1000;
const MAX_REPORTS_PER_HOUR = 20;

const counts = new LRUCache({ max: 10000, ttl: 60 * 60 * 1000 });

export function validate(body) {
  const { type, id, reason = "" } = body || {};
  if (!TYPES.includes(type)) return `type must be one of ${TYPES.join(", ")}`;
  if (typeof id !== "string" || !id || id.length > MAX_ID_LENGTH)
    return `id must be a string of 1-${MAX_ID_LENGTH} characters`;
  if (typeof reason !== "string" || reason.length > MAX_REASON_LENGTH)
    return `reason must be a string of at most ${MAX_REASON_LENGTH} characters`;
  return null;
}

export function setupRoutes(app, { sendError, sendStatus, requireAdminAuth }) {
  app.post("/api/v1/reports", async (request, reply) => {
    reply.header("Cache-Control", "no-cache");

    const error = validate(request.body);
    if (error) return sendError(reply, 400, "Bad Request", error);

    const ip = request.header("cf-connecting-ip") || request.ip;
    const count = counts.get(ip) || 0;
    if (count >= MAX_REPORTS_PER_HOUR) {
      return sendError(reply, 429, "Too Many Requests", "Too many reports");
    }
    counts.set(ip, count + 1);

    const { type, id, reason = "" } = request.body;
    const report = { type, id, reason, timestamp: Date.now() };
    try {
      await appendFile(REPORTS_FILE, JSON.stringify(report) + "\n");
    } catch (err) {
      log(`Error storing report: ${err.toString()}`);
      return sendError(reply, 500, "Internal Server Error", "Couldn't store report");
    }
    log(`New ${type} report for ${id}`);
    return sendStatus(reply, 200, "OK", "Report received");
  });

  app.get("/api/v1/reports", async (request, reply) => {
    reply.header("Cache-Control", "no-cache");
    if (!requireAdminAuth(request, reply)) return;

    let content = "";
    try {
      content = await readFile(REPORTS_FILE, "utf8");
    } catch (err) {
      if (err.code !== "ENOENT") {
        log(`Error reading reports: ${err.toString()}`);
        return sendError(reply, 500, "Internal Server Error", "Couldn't read reports");
      }
    }
    const reports = content
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .reverse();
    return sendStatus(reply, 200, "OK", "Reports", { reports });
  });
}
