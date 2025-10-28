#!/usr/bin/env node

import WebSocket from 'ws';
import dotenv from 'dotenv';

dotenv.config();

const WS_URL = process.env.SNAPCHAIN_WS_URL || 'ws://46.62.141.24:8080';
const BEARER_TOKEN = process.env.SNAPCHAIN_BEARER_TOKEN;

if (!BEARER_TOKEN) {
  console.error('Error: SNAPCHAIN_BEARER_TOKEN not found in .env file');
  process.exit(1);
}

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  ws.send(BEARER_TOKEN);
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());

    if (message.status === 'authenticated') {
      return;
    }

    console.log(`FID: ${message.fid}`);
    console.log(`Text: ${message.text}`);
    console.log('Embeds:');
    message.embeds.forEach(embed => {
      console.log(`  ${embed}`);
    });
    console.log('');
  } catch (error) {
    console.error('Error parsing message:', error);
  }
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error.message);
});

ws.on('close', () => {
  process.exit(0);
});

process.on('SIGINT', () => {
  ws.close();
  setTimeout(() => {
    process.exit(0);
  }, 100);
});
