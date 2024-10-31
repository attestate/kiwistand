import normalizeUrl from "normalize-url";
import { format } from "date-fns";

import { lifetimeCache as cache } from "./cache.mjs";

const karmaPrefix = `karma-present`;

function increment(identity, prefix) {
  let user = cache.get(`${prefix}-${identity}`);
  if (user) {
    user.points = Number.isInteger(user.points) ? user.points + 1 : 1;
  } else {
    user = { points: 1, submissions: 0 };
  }
  cache.set(`${prefix}-${identity}`, user);
}

function record(identity, prefix) {
  let user = cache.get(`${prefix}-${identity}`);
  if (user) {
    user.submissions = Number.isInteger(user.submissions)
      ? user.submissions + 1
      : 1;
  } else {
    user = { points: 0, submissions: 1 };
  }
  cache.set(`${prefix}-${identity}`, user);
}

export function resolve(identity, endDate) {
  let prefix = karmaPrefix;
  if (endDate) {
    prefix = datePrefix(endDate);
  }
  const user = cache.get(`${prefix}-${identity}`);
  return user && user.points ? user.points : 0;
}

function datePrefix(date) {
  return `karma-${format(date, "yyyy-MM-dd")}`;
}

export function count(messages, endDate) {
  let prefix = karmaPrefix;
  if (endDate) {
    prefix = datePrefix(endDate);
    messages = messages.filter(
      (message) => new Date(message.timestamp * 1000) <= endDate,
    );
  }
  for (const key of cache.keys(`${prefix}-`)) {
    cache.del(key);
  }
  messages = messages.sort((a, b) => a.timestamp - b.timestamp);
  const submissions = new Map();

  messages.forEach((message) => {
    const normalizedUrl = normalizeUrl(message.href);

    if (!submissions.has(normalizedUrl)) {
      submissions.set(normalizedUrl, message.identity);
      increment(message.identity, prefix);
      record(message.identity, prefix);
    } else {
      const submitter = submissions.get(normalizedUrl);
      increment(submitter, prefix);
    }
  });
}

export function all() {
  const map = {};
  for (const key of cache.keys(`${karmaPrefix}-`)) {
    if (key.includes(karmaPrefix)) {
      const [_, address] = key.split(`${karmaPrefix}-`);
      map[address] = cache.get(key);
    }
  }
  return map;
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
