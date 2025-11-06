import normalizeUrl from "normalize-url";
import { format } from "date-fns";

import { lifetimeCache as cache, calculateKarmaFromDB, getKarmaRanking } from "./cache.mjs";
import log from "./logger.mjs";

const karmaPrefix = `karma-present`;

// Legacy functions for backward compatibility
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
  // First try to get fresh karma from the database
  try {
    const dbKarma = calculateKarmaFromDB(identity, endDate);
    return dbKarma;
  } catch (err) {
    log(`Error in karma.resolve using DB: ${err.toString()}`);
    // Fall back to cache if DB query fails
  }
  
  // Fall back to cached karma if DB is unavailable or query fails
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
  // TODO: The following code is suboptimal because it relies to give submitters
  // credit through this submissions map that is only temporarily available at
  // the time of executing this function, and so if someone wanted to credit
  // a story submitter with karma, this wouldn't work as we'd have to load the
  // entire context again.
  const submissions = new Map();

  messages.forEach((message) => {
    // Skip normalization for text posts and kiwi references
    const normalizedUrl = (message.href.startsWith('data:') || message.href.startsWith('kiwi:'))
      ? message.href
      : normalizeUrl(message.href);

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
  try {
    // Get top karma users directly from database
    const results = getKarmaRanking();
    if (results && results.length > 0) {
      return results;
    }
  } catch (err) {
    log(`Error in karma.ranking using DB: ${err.toString()}`);
    // Fall back to cache-based ranking
  }
  
  // Fall back to cache-based ranking
  const list = [];
  for (const [identity, data] of Object.entries(all())) {
    if (data && data.points) {
      list.push({ identity, karma: data.points });
    }
  }

  return list.sort((a, b) => b.karma - a.karma);
}
