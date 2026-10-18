import { parentPort } from 'worker_threads';
import { parse as parser } from 'node-html-parser';

import log from './logger.mjs';

// Runs in a worker so that the main thread can terminate it on timeout:
// node-html-parser takes seconds on a few KB of unclosed tags.
parentPort.on('message', ({ html }) => {
  try {
    const dom = parser(html);

    // Try to extract Arweave transaction ID from meta tags or script tags
    let arweaveId = null;
    const metaTags = dom.querySelectorAll('meta');
    for (const meta of metaTags) {
      const property = meta.getAttribute('property') || meta.getAttribute('name');
      if (property && property.includes('arweave')) {
        arweaveId = meta.getAttribute('content');
        break;
      }
    }

    // If no Arweave ID in meta tags, look in script tags
    if (!arweaveId) {
      const scriptTags = dom.querySelectorAll('script');
      for (const script of scriptTags) {
        const content = script.innerHTML;
        // Look for Arweave transaction ID patterns (43 character base64url strings)
        const arweaveMatch = content.match(/["']([a-zA-Z0-9_-]{43})["']/);
        if (arweaveMatch && content.includes('arweave')) {
          arweaveId = arweaveMatch[1];
          break;
        }
      }
    }

    // Extract basic metadata from the page
    const title = dom.querySelector('meta[property="og:title"]')?.getAttribute('content') || 
                  dom.querySelector('title')?.text || '';
    const description = dom.querySelector('meta[property="og:description"]')?.getAttribute('content') || 
                        dom.querySelector('meta[name="description"]')?.getAttribute('content') || '';

    // Try to extract article content
    let content = '';
    // Common selectors for article content in blog platforms
    const contentSelectors = [
      // Paragraph.xyz specific selectors
      'div.prose.prose-lg',
      'div[class*="prose"]',
      '#__next main div.prose',
      '#main-post-body',
      // Generic selectors
      'article[class*="prose"]',
      'article',
      '[class*="article-content"]',
      '[class*="post-content"]',
      'main article',
      'main',
      '.content'
    ];

    log(`Attempting to extract content from page...`);
    for (const selector of contentSelectors) {
      const contentElement = dom.querySelector(selector);
      if (contentElement) {
        content = contentElement.innerHTML;
        log(`Found content using selector: "${selector}", content length: ${content.length}, first 200 chars: ${content.substring(0, 200).replace(/\n/g, '\\n')}`);

        // If content looks like it's just plain text without HTML tags, check if we need to look deeper
        if (content.length < 500 && !content.includes('<p>') && !content.includes('<br>')) {
          log(`Content seems too short or lacks HTML, continuing search...`);
          continue;
        }
        break;
      }
    }

    if (!content) {
      log(`No content found with selectors, trying to find any div with substantial text...`);
      // Last resort: find any div with substantial text content
      const allDivs = dom.querySelectorAll('div');
      for (const div of allDivs) {
        const text = div.textContent || '';
        if (text.length > 1000 && div.innerHTML.includes('<p>')) {
          content = div.innerHTML;
          log(`Found content in generic div, length: ${content.length}`);
          break;
        }
      }
    }

    parentPort.postMessage({
      success: true,
      result: { arweaveId, title, description, content },
    });
  } catch (error) {
    parentPort.postMessage({ success: false, error: error.message });
  }
});
