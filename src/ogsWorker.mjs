import { parentPort } from 'worker_threads';
import ogs from 'open-graph-scraper-lite';
import { load } from 'cheerio';

// Listen for HTML to parse
parentPort.on('message', async ({ html }) => {
  try {
    const result = await ogs({ html });
    // NOTE: Remote HTML is only parsed here, where the main thread can
    // terminate us on timeout. cheerio is linear in the input, unlike
    // node-html-parser, which takes seconds on a few KB of unclosed tags.
    const canonical = load(html)('link[rel="canonical"]').attr('href');
    parentPort.postMessage({ success: true, result: result.result, canonical });
  } catch (error) {
    parentPort.postMessage({ success: false, error: error.message });
  }
});
