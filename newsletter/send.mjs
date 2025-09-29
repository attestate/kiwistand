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

async function sendDigest() {
  const apiKey = process.env.BUTTON_DOWN_API_KEY; // unified root env var

  if (!apiKey) {
    console.error('Error: Please set BUTTON_DOWN_API_KEY in your project root .env file.');
    process.exit(1);
  }

  try {
    // 1) Read the latest exported digest
    const outPath = path.resolve(__dirname, 'out', 'Digest.html');
    let htmlContent = await fs.readFile(outPath, 'utf-8');
    htmlContent = extractBody(htmlContent);

    // 2) Create a new email draft in Buttondown
    const subject = `Kiwi News Weekly Digest — ${formatDateForSubject()}`;
    const createEmailResponse = await fetch('https://api.buttondown.email/v1/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ subject, body: htmlContent, status: 'draft' }),
    });

    if (!createEmailResponse.ok) {
      const errorText = await createEmailResponse.text();
      console.error('Error creating Buttondown email draft:', createEmailResponse.status, errorText);
      process.exit(1);
    }

    const emailData = await createEmailResponse.json();
    const id = emailData.id;
    console.log(`Created Buttondown draft with ID: ${id}`);
  } catch(err) {
    console.error("Error", err);
  }
}

sendDigest();
