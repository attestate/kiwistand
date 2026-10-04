import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { extractBody } from './lib/html.mjs';

// Always load env from project root (../.env)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

function formatDateForSubject(date = new Date()) {
  return date.toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: '2-digit'
  });
}

// The digest data the email was rendered from (scripts/generate-digest.mjs).
async function readDigest() {
  const file = process.env.DIGEST_DATA
    ? path.resolve(process.env.DIGEST_DATA)
    : path.resolve(__dirname, '..', 'digest-data.json');
  try {
    return JSON.parse(await fs.readFile(file, 'utf-8'));
  } catch {
    return null;
  }
}

// Leads with the week's top story, which gets more opens than a date.
function subjectFor(digest) {
  const top = digest?.stories?.[0];
  const title = top?.metadata?.compliantTitle || top?.title;
  if (!title) return `Kiwi News Weekly Digest — ${formatDateForSubject()}`;
  const short = title.length > 70 ? `${title.slice(0, 69).trimEnd()}…` : title;
  return `Kiwi Weekly: ${short}`;
}

async function sendDigest() {
  const apiKey = process.env.BUTTON_DOWN_API_KEY; // unified root env var

  if (!apiKey) {
    console.error('Error: Please set BUTTON_DOWN_API_KEY in your project root .env file.');
    process.exit(1);
  }

  try {
    // 1) Read the latest exported digest
    const outPath = path.resolve(__dirname, 'out', 'Digest.html');
    const fullHtml = await fs.readFile(outPath, 'utf-8');
    // Buttondown wraps the body in its own template, so carry the <style>
    // blocks from <head> (dark mode) over into the body.
    const head = fullHtml.split(/<body\b/i)[0];
    const styles = head.match(/<style\b[\s\S]*?<\/style>/gi) || [];
    const htmlContent = styles.join('\n') + extractBody(fullHtml);

    // 2) Create the email in Buttondown: a draft to review by default, or
    // sent right away with --publish.
    const publish = process.argv.includes("--publish");
    const status = publish ? "about_to_send" : "draft";
    const digest = await readDigest();
    // Never send last week's stories again: a stale digest means the
    // generate step failed.
    const age = digest?.generatedAt ? Date.now() - new Date(digest.generatedAt).getTime() : Infinity;
    if (publish && !(age < 6 * 60 * 60 * 1000)) {
      console.error('Error: digest-data.json is missing or older than 6 hours; not sending.');
      process.exit(1);
    }
    // Send at most one issue a week. A manual run and a (late) scheduled
    // run can both happen on the same Sunday; the workflow's concurrency
    // group runs them one after the other, so the second one sees the
    // first one's email here. If Buttondown can't tell us, don't send.
    if (publish) {
      const recent = await recentlySentEmail(apiKey);
      if (recent === undefined) {
        console.error('Error: could not check Buttondown for this week\'s issue; not sending.');
        process.exit(1);
      }
      if (recent) {
        console.log(`Already sent this week: "${recent.subject}" (${recent.status}, ${recent.publish_date || recent.creation_date}). Not sending again.`);
        return;
      }
    }
    const subject = subjectFor(digest);
    console.log(`Subject: ${subject}`);
    const createEmailResponse = await fetch('https://api.buttondown.email/v1/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ subject, body: htmlContent, status }),
    });

    if (!createEmailResponse.ok) {
      const errorText = await createEmailResponse.text();
      console.error('Error creating Buttondown email draft:', createEmailResponse.status, errorText);
      process.exit(1);
    }

    const emailData = await createEmailResponse.json();
    const id = emailData.id;
    console.log(`Created Buttondown ${publish ? "email (sending)" : "draft"} with ID: ${id}`);
  } catch(err) {
    console.error("Error", err);
    process.exit(1);
  }
}

// The newest email that went (or is going) out in the last 6 days, null if
// none, undefined if Buttondown couldn't be asked.
const SENDING = ["about_to_send", "in_flight", "scheduled", "sent"];
async function recentlySentEmail(apiKey, now = Date.now()) {
  try {
    const response = await fetch('https://api.buttondown.email/v1/emails?ordering=-creation_date', {
      headers: { 'Authorization': `Token ${apiKey}` },
    });
    if (!response.ok) return undefined;
    const { results } = await response.json();
    if (!Array.isArray(results)) return undefined;
    const weekAgo = now - 6 * 24 * 60 * 60 * 1000;
    return results.find((email) => {
      const when = new Date(email.publish_date || email.creation_date).getTime();
      return SENDING.includes(email.status) && when > weekAgo;
    }) ?? null;
  } catch {
    return undefined;
  }
}

sendDigest();
