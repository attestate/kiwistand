import Parser from "rss-parser";
import { subDays } from "date-fns";
import path from "path";
import { env } from "process";
import { FileSystemCache } from "node-fetch-cache";

import log from "./logger.mjs";
import { fetchCache } from "./utils.mjs";

// Setup cache for RSS feeds
const oneSec = 1000;
const cache = new FileSystemCache({
  cacheDirectory: path.resolve(env.CACHE_DIR, "rssfeeds"),
  ttl: oneSec * 60 * 30, // 30min cache
});

const parser = new Parser();
let stories = [];
let alreadyRunning = false;

// Create a fetch function with our cache
const fetchWithCache = fetchCache(fetch, cache);

export async function recompute(feedUrls) {
  if (alreadyRunning) {
    log("Feed recompute already running, skipping");
    return;
  }
  
  alreadyRunning = true;
  try {
    // Create a new array instead of modifying the existing one
    // to avoid race conditions
    const newStories = [];
    
    // Process feeds in parallel with Promise.all
    const results = await Promise.allSettled(
      feedUrls.map(url => extract(url))
    );
    
    // Process results
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        newStories.push(...result.value);
      } else {
        log(`Feed "${feedUrls[index]}" errored: ${result.reason.toString()}`);
      }
    });
    
    // Only replace the stories array once all processing is complete
    stories = newStories;
    log(`Successfully processed ${stories.length} feed items from ${feedUrls.length} feeds`);
  } catch (err) {
    log(`Unexpected error in feeds.recompute: ${err.toString()}`);
  } finally {
    alreadyRunning = false;
  }
}

export function latest() {
  const cutoffDate = subDays(new Date(), 1);
  const cutoffTimestamp = cutoffDate.getTime() / 1000;

  let articles = [...stories];
  articles = articles.filter((article) => article.date > cutoffTimestamp);
  articles.sort((a, b) => b.date - a.date);
  articles = articles.map((article) => ({
    timestamp: article.date,
    href: article.url,
    title: article.title,
  }));

  return articles;
}

async function extract(feedUrl) {
  try {
    log(`Fetching feed: ${feedUrl}`);
    // Always use direct fetch first with proper headers
    try {
      const directResponse = await fetch(feedUrl, {
        headers: {
          'User-Agent': 'Kiwi News Feed Reader (https://news.kiwistand.com)',
          'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, text/html'
        },
        signal: AbortSignal.timeout(15000) // 15 second timeout
      });
      
      if (directResponse.ok) {
        const feedContent = await directResponse.text();
        try {
          const feed = await parser.parseString(feedContent);
          log(`Successfully parsed feed ${feedUrl} with ${feed.items?.length || 0} items`);
          
          // Only return items that have all required fields
          return (feed.items || [])
            .filter(item => item.title && item.link && item.pubDate)
            .map((item) => ({
              date: new Date(item.pubDate).getTime() / 1000,
              title: item.title,
              url: item.link,
            }));
        } catch (parseErr) {
          log(`Error parsing feed content from ${feedUrl}: ${parseErr.toString()}`);
          return [];
        }
      } else {
        log(`Feed fetch failed with status ${directResponse.status}: ${feedUrl}`);
      }
    } catch (directErr) {
      log(`Direct fetch failed for ${feedUrl}: ${directErr.toString()}`);
    }
    
    // Don't try to use the cache for now since it's causing issues
    return [];
  } catch (err) {
    log(`Unexpected error extracting feed from ${feedUrl}: ${err.toString()}`);
    return [];
  }
}
