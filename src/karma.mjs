import NodeCache from "node-cache";
import normalizeUrl from "normalize-url";

import cache from "./cache.mjs";

function increment(identity) {
  const points = cache.get(identity);
  if (typeof points !== undefined && Number.isInteger(points)) {
    cache.set(identity, points + 1);
  } else {
    cache.set(identity, 1);
  }
}

export function all() {
  const map = {};
  for (const key of cache.keys()) {
    map[key] = cache.get(key);
  }
  return map;
}

export function resolve(identity) {
  const points = cache.get(identity);
  return points ? points : 0;
}

export function count(messages) {
  cache.flushAll();

  messages = messages.sort((a, b) => a.timestamp - b.timestamp);
  const submissions = new Map();

  messages.forEach((message) => {
    const normalizedUrl = normalizeUrl(message.href);
    const cacheEnabled = true;

    if (!submissions.has(normalizedUrl)) {
      submissions.set(normalizedUrl, message.identity);
      increment(message.identity);
    } else {
      const submitter = submissions.get(normalizedUrl);
      increment(submitter);
    }
  });
}

export function ranking() {
  const points = all();
  const list = [];
  for (const identity of Object.keys(points)) {
    const karma = points[identity];
    list.push({ identity, karma });
  }

  return list.sort((a, b) => b.karma - a.karma);
}
