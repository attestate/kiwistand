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

function subjectFor() {
  return `Kiwi News Weekly Digest — ${formatDateForSubject()}`;
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

sendDigest();
