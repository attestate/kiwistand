import { parentPort } from 'worker_threads';

import { parseArticle, parseDiscourseTopic, parseArxivAbs } from './article.mjs';

// Runs in a worker so that the main thread can terminate it on timeout:
// JSDOM and Readability take seconds to minutes on a few KB of unclosed tags.
parentPort.on('message', ({ kind, html, url, topic }) => {
  try {
    let result;
    if (kind === 'article') result = parseArticle(html, url);
    else if (kind === 'discourse') result = parseDiscourseTopic(topic, url);
    else if (kind === 'arxiv') result = parseArxivAbs(html);
    else throw new Error(`Unknown kind ${kind}`);
    parentPort.postMessage({ success: true, result });
  } catch (error) {
    parentPort.postMessage({ success: false, error: error.message });
  }
});
