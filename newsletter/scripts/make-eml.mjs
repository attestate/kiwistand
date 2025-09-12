#!/usr/bin/env node
import fs from 'fs';

const [,, inPath = 'out/Digest.html', outPath = 'out/Digest.eml', subject = 'Kiwi Digest (Preview)'] = process.argv;

const html = fs.readFileSync(new URL('../' + inPath, import.meta.url), 'utf8');
const crlf = (s) => s.replace(/\r?\n/g, '\r\n');

const boundary = '==KiwiBoundary' + Math.random().toString(36).slice(2);
const messageId = '<' + Date.now() + '.' + Math.random().toString(36).slice(2) + '@kiwi.test>';

// Plain text fallback (very simple)
const text = 'Kiwi preview email. This message contains HTML content. If you cannot see it, open the attached HTML or view in a browser.';

// Base64 encode HTML and wrap at 76 char lines
const htmlBase64 = Buffer.from(crlf(html), 'utf8').toString('base64').replace(/.{1,76}/g, '$&\r\n');

const headers = [
  'From: Kiwi <preview@kiwi.test>',
  'To: You <you@local>',
  'Date: ' + new Date().toUTCString(),
  'Subject: ' + subject,
  'Message-ID: ' + messageId,
  'MIME-Version: 1.0',
  `Content-Type: multipart/alternative; boundary="${boundary}"`,
  '',
];

const parts = [
  `--${boundary}`,
  'Content-Type: text/plain; charset=UTF-8',
  'Content-Transfer-Encoding: 7bit',
  '',
  crlf(text),
  `--${boundary}`,
  'Content-Type: text/html; charset=UTF-8',
  'Content-Transfer-Encoding: base64',
  '',
  htmlBase64,
  `--${boundary}--`,
  '',
];

const eml = headers.join('\r\n') + parts.join('\r\n');

fs.writeFileSync(new URL('../' + outPath, import.meta.url), eml);

console.log(`Wrote ${outPath}`);
