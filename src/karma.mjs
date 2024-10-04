import normalizeUrl from "normalize-url";

import cache from "./cache.mjs";

function increment(identity) {
  let user = cache.get(identity);
  if (user) {
    user.points = Number.isInteger(user.points) ? user.points + 1 : 1;
  } else {
    user = { points: 1, submissions: 0 };
  }
  cache.set(identity, user);
}

function record(identity) {
  let user = cache.get(identity);
  if (user) {
    user.submissions = Number.isInteger(user.submissions)
      ? user.submissions + 1
      : 1;
  } else {
    user = { points: 0, submissions: 1 };
  }
  cache.set(identity, user);
}

export function all() {
  const map = {};
  for (const key of cache.keys()) {
    map[key] = cache.get(key);
  }
  return map;
}

export function resolve(identity) {
  const user = cache.get(identity);
  return user && user.points ? user.points : 0;
}

export async function count(messages) {
  cache.flushAll();

  messages = messages.sort((a, b) => a.timestamp - b.timestamp);
  const submissions = new Map();

  messages.forEach((message) => {
    const normalizedUrl = normalizeUrl(message.href);
    const cacheEnabled = true;

    if (!submissions.has(normalizedUrl)) {
      submissions.set(normalizedUrl, message.identity);
      increment(message.identity);
      record(message.identity);
    } else {
      const submitter = submissions.get(normalizedUrl);
      increment(submitter);
    }
  });
}

export function rank(identity) {
  const ranks = ranking();
  return ranks.findIndex((r) => r.identity === identity) + 1;
}

export function ranking() {
  const list = [];
  for (const [identity, data] of Object.entries(all())) {
    if (data && data.points) {
      list.push({ identity, karma: data.points });
    }
  }

  return list.sort((a, b) => b.karma - a.karma);
}
