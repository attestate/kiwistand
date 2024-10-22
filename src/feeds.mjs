import Parser from "rss-parser";
import { subDays } from "date-fns";

import log from "./logger.mjs";

const parser = new Parser();
let stories = [];
let alreadyRunning = false;

export async function recompute(feedUrls) {
  if (alreadyRunning) return;
  alreadyRunning = true;
  stories = [];

  await Promise.all(
    feedUrls.map((url) =>
      extract(url)
        .then((data) => {
          stories = [...stories, ...data];
        })
        .catch((err) => {
          log(`Feed "${url}" errored: ${err.toString()}`);
        }),
    ),
  );

  alreadyRunning = false;
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
  const feed = await parser.parseURL(feedUrl);
  return feed.items.map((item) => ({
    date: new Date(item.pubDate).getTime() / 1000,
    title: item.title,
    url: item.link,
  }));
}
