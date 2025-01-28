import { env } from "process";
import path from "path";
import { randomBytes } from "crypto";

import Database from "better-sqlite3";
import postmark from "postmark";
import { eligible } from "@attestate/delegator2";

import { EIP712_MESSAGE } from "./constants.mjs";
import * as id from "./id.mjs";
import * as registry from "./chainstate/registry.mjs";
import log from "./logger.mjs";

const DATA_DIR = env.DATA_DIR;
const DB_FILE = path.join(DATA_DIR, "email_subscriptions.db");

const db = new Database(DB_FILE);
let client;
if (env.POSTMARK_API_KEY) {
  client = new postmark.ServerClient(env.POSTMARK_API_KEY);
}

db.exec(`
   CREATE TABLE IF NOT EXISTS email_subscriptions (
     address TEXT PRIMARY KEY,
     email TEXT NOT NULL,
     secret TEXT NOT NULL UNIQUE
   )
 `);

db.exec(`
   CREATE INDEX IF NOT EXISTS idx_email_secret
   ON email_subscriptions (email, secret)
 `);

db.exec(`
   CREATE UNIQUE INDEX IF NOT EXISTS idx_secret
   ON email_subscriptions (secret)
 `);

export async function syncSuppressions() {
  if (!client) {
    log("Skipping syncing suppressions because POSTMARK_API_KEY isn't defined");
    return;
  }

  let page = 1;
  const perPage = 100;

  while (true) {
    const response = await client.getSuppressions("outbound", {
      count: perPage,
      offset: (page - 1) * perPage,
    });

    const suppressedRecipients = response.Suppressions.map(
      (s) => s.EmailAddress,
    );

    const removeStmt = db.prepare(`
      DELETE FROM email_subscriptions
      WHERE email IN (${suppressedRecipients.map(() => "?").join(",")})
    `);
    removeStmt.run(suppressedRecipients);

    if (suppressedRecipients.length < perPage) {
      break;
    }
    page++;
  }
}

export async function validate(message) {
  const signer = id.ecrecover(message, EIP712_MESSAGE);
  const allowlist = await registry.allowlist();
  const delegations = await registry.delegations();
  const identity = eligible(allowlist, delegations, signer);

  if (!identity) {
    throw new Error(
      "Body must include a validly signed message from an eligible signer.",
    );
  }

  return identity;
}

export async function addSubscription(address, email) {
  const secret = randomBytes(32).toString("hex");
  const stmt = db.prepare(`
     INSERT OR REPLACE INTO email_subscriptions
     (address, email, secret) VALUES (?, ?, ?)
   `);
  stmt.run(address, email, secret);
  return secret;
}

export async function byAddress(address) {
  const stmt = db.prepare(
    "SELECT email, secret FROM email_subscriptions WHERE address = ?",
  );
  const result = stmt.get(address);
  return result ? { email: result.email, secret: result.secret } : null;
}

export async function send(receiver, { sender, title, message, data }) {
  if (env.NODE_ENV !== "production" || !client) {
    log(
      "Skipping sending email notification because either not production environment or POSTMARK_API_KEY missing",
    );
    return;
  }

  const { email, secret } = await byAddress(receiver);
  if (!email || !secret) return;

  const unsubscribeUrl = `https://news.kiwistand.com/unsubscribe/${secret}`;

  try {
    await client.sendEmail({
      From: `${sender} <noreply@news.kiwistand.com>`,
      To: email,
      Subject: title,
      TextBody: `${message}\n\nView comment: ${data.url}\n\n\n\nUnsubscribe: ${unsubscribeUrl}`,
      MessageStream: "outbound",
    });
  } catch (err) {
    log(
      `Error trying to send an email to ${email} from sender ${sender}, error ${err.stack}`,
    );
  }
}

export async function unsubscribe(secret) {
  const stmt = db.prepare(
    "SELECT address FROM email_subscriptions WHERE secret = ?",
  );
  const exists = stmt.get(secret);
  if (!exists) return false;

  const remove = db.prepare("DELETE FROM email_subscriptions WHERE secret = ?");
  remove.run(secret);
  return true;
}
