import { parentPort } from 'worker_threads';
import ogs from 'open-graph-scraper-lite';

// Listen for HTML to parse
parentPort.on('message', async ({ html }) => {
  try {
    const result = await ogs({ html });
    parentPort.postMessage({ success: true, result: result.result });
  } catch (error) {
    parentPort.postMessage({ success: false, error: error.message });
  }
});