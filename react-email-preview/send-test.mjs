import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function sendTestEmail() {
  const apiKey = process.env.BUTTONDOWN_API_KEY;
  const recipientEmail = process.env.RECIPIENT_EMAIL;

  if (!apiKey || !recipientEmail) {
    console.error('Error: Please set BUTTONDOWN_API_KEY and RECIPIENT_EMAIL in your .env file.');
    process.exit(1);
  }

  try {
    // 1. Read the HTML content from the `out` directory
    const htmlContent = await fs.readFile('out/Digest.html', 'utf-8');

    // 2. Create a new email in Buttondown with the status 'draft'
    const createEmailResponse = await fetch('https://api.buttondown.email/v1/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject: 'Kiwi News Weekly Digest (Test)',
        body: htmlContent,
        status: 'draft',
      }),
    });

    if (!createEmailResponse.ok) {
      const errorData = await createEmailResponse.json();
      console.error('Error creating Buttondown email draft:', errorData);
      return;
    }

    const emailData = await createEmailResponse.json();
    console.log(`Successfully created email draft with ID: ${emailData.id}`);

    // 3. Send the created draft for review
    console.log(`Sending test email to ${recipientEmail}...`);
    const sendTestResponse = await fetch(`https://api.buttondown.email/v1/emails/${emailData.id}/send-draft`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([recipientEmail]),
    });

    if (sendTestResponse.ok) {
      console.log('Successfully sent test email!');
    } else {
      const errorText = await sendTestResponse.text();
      console.error('Failed to send test email with status:', sendTestResponse.status, errorText);
    }

  } catch (error) {
    console.error('An unexpected error occurred:', error);
  }
}

sendTestEmail();
