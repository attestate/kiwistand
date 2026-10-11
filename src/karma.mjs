import { format } from "date-fns";

import { lifetimeCache as cache, calculateKarmaFromDB, getKarmaRanking } from "./cache.mjs";
import log from "./logger.mjs";

const karmaPrefix = `karma-present`;

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
