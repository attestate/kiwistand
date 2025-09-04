import { render } from '@react-email/render';
import React from 'react';
import dotenv from 'dotenv';

import { getStories } from '../src/views/best.mjs';
import DigestEmail from '../react-email-preview/emails/Digest.jsx';

dotenv.config();

async function renderAndSend() {
  const apiKey = process.env.BUTTONDOWN_API_KEY;
  const recipientEmail = process.env.RECIPIENT_EMAIL;

  if (!apiKey || !recipientEmail) {
    console.error('Error: Please set BUTTONDOWN_API_KEY and RECIPIENT_EMAIL in your .env file.');
    process.exit(1);
  }

  try {
    // 1. Fetch the top 3 stories with full metadata
    console.log('Fetching top 3 stories...');
    const stories = await getStories(null, 0, 'week', null);
    const topThreeStories = stories.slice(0, 3);
    console.log(`Found ${topThreeStories.length} stories.`);

    // 2. Render the email with the fetched data
    console.log('Rendering email...');
    const html = render(React.createElement(DigestEmail, { stories: topThreeStories }));

    // 3. Create a new email draft in Buttondown
    console.log('Creating draft in Buttondown...');
    const createEmailResponse = await fetch('https://api.buttondown.email/v1/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject: 'Kiwi News Weekly Digest (Test)',
        body: html,
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

    // 4. Send the created draft for review
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

renderAndSend();
