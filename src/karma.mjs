import normalizeUrl from "normalize-url";

import cache from "./cache.mjs";

export function getBaselineSubmissions() {
  const submissions = Object.values(all())
    .filter((user) => user)
    .map((user) => user.submissions)
    .sort((a, b) => a - b);
  const middle = Math.floor(submissions.length / 2);
  return submissions.length % 2
    ? submissions[middle]
    : (submissions[middle - 1] + submissions[middle]) / 2;
}

export function getBaselineUpvotes() {
  const upvotes = Object.values(all())
    .filter((user) => user)
    .map((user) => user.points)
    .sort((a, b) => a - b);
  const middle = Math.floor(upvotes.length / 2);
  return upvotes.length % 2
    ? upvotes[middle]
    : (upvotes[middle - 1] + upvotes[middle]) / 2;
}

export function score(identity) {
  const user = cache.get(identity);
  if (!user) {
    return 0;
  }

  const baselineSubmissions = getBaselineSubmissions();
  const baselineUpvotes = getBaselineUpvotes();

  return (
    (user.points + baselineUpvotes) / (user.submissions + baselineSubmissions)
  );
}

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

export function totalSubmissions(identity) {
  const user = cache.get(identity);
  return user && user.submissions ? user.submissions : 0;
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
