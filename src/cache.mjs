import { join } from "path";
// NOTE: cache-sqlite-lru-ttl is CommonJS and require()s debounce. debounce
// 2+ is ESM-only, and Node 22's require(esm) intermittently aborted the
// process in CI ("FATAL ERROR: v8::Module::IsGraphAsync must be used on an
// instantiated module"), so package.json overrides its debounce with the
// CommonJS 1.2.1 (same behavior for its debounce(fn, 100, {immediate})).
import { SqliteCache } from "cache-sqlite-lru-ttl";
// SQLite-backed LRU cache shared across all cluster workers and persisted to
// disk. Replaces the previous in-memory LRU which caused each cluster worker
// to maintain its own isolated cache, leading to inconsistent metadata display.
const cache = new SqliteCache({
  database: join(process.env.CACHE_DIR, "metadata-cache.db"),
  defaultTtlMs: 1000 * 60 * 60 * 6, // 6 hours
  maxItems: 10000,
  compress: true,
});
export default cache;

import Database from "better-sqlite3";
import normalizeUrl from "normalize-url";
import { utils } from "ethers";
import { resolveIdentity } from "@attestate/delegator2";

import log from "./logger.mjs";
import { toDigest } from "./id.mjs";
import { nameKey, normalizeId } from "./communities.mjs";
import { COMMUNITY_KIWI_MIN_UPVOTES } from "./constants.mjs";

const dbPath = join(process.env.CACHE_DIR, "database.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

export const lifetimeCache = {
  set: (key, value) => {
    const insert = db.prepare(
      `INSERT OR REPLACE INTO ltCache (key, value) VALUES (?, ?)`,
    );
    insert.run(key, JSON.stringify(value));
  },
  get: (key) => {
    const query = db.prepare(`SELECT value FROM ltCache WHERE key = ?`);
    const row = query.get(key);
    return row && row.value ? JSON.parse(row.value) : null;
  },
  del: (key) => {
    const del = db.prepare(`DELETE FROM ltCache WHERE key = ?`);
    del.run(key);
  },
  has: (key) => {
    const query = db.prepare(`SELECT 1 FROM ltCache WHERE key = ?`);
    const row = query.get(key);
    return !!row;
  },
  keys: (prefix) => {
    const query = db.prepare(`SELECT key FROM ltCache WHERE key LIKE ?`);
    return query.all(prefix + "%").map((row) => row.key);
  },
};

export function initializeLtCache() {
  const exists = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='ltCache'`,
    )
    .get();
  if (exists) {
    log("Aborting cache.initializeLtCache early because table already exists");
    return true;
  }

  log("Creating ltCache table");
  db.exec(`CREATE TABLE IF NOT EXISTS ltCache (
     key TEXT PRIMARY KEY,
     value TEXT)`);
  return false;
}

export function initializeImpressions() {
  const exists = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='impressions'`,
    )
    .get();
  if (exists) {
    log(
      "Aborting cache.initializeImpressions early because table already exists",
    );
    return true;
  }

  log("Creating impressions table");
  db.exec(`CREATE TABLE IF NOT EXISTS impressions (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     url TEXT NOT NULL,
     hash TEXT NOT NULL,
     timestamp INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_impressions_url ON impressions(url);
  CREATE INDEX IF NOT EXISTS idx_impressions_hash ON impressions(hash);
  CREATE INDEX IF NOT EXISTS idx_impressions_timestamp ON impressions(timestamp);`);
  return false;
}

export function initializeShares() {
  const exists = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='shares'`,
    )
    .get();
  if (exists) {
    log(
      "Aborting cache.initializeShares early because table already exists",
    );
    return true;
  }

  log("Creating shares table");
  db.exec(`CREATE TABLE IF NOT EXISTS shares (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     url TEXT NOT NULL,
     hash TEXT NOT NULL,
     share_type TEXT NOT NULL,
     timestamp INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_shares_url ON shares(url);
  CREATE INDEX IF NOT EXISTS idx_shares_hash ON shares(hash);
  CREATE INDEX IF NOT EXISTS idx_shares_share_type ON shares(share_type);
  CREATE INDEX IF NOT EXISTS idx_shares_timestamp ON shares(timestamp);`);
  return false;
}

export function initialize(messages) {
  let isSetup = true;
  const tables = ["fingerprints", "submissions", "upvotes", "comments"];
  tables.forEach((table) => {
    const exists = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND
 name=?`,
      )
      .get(table);
    if (!exists) {
      isSetup = false;
    }
  });

  if (isSetup) {
    log("Aborting cache.initialize early because all tables already exist");
    return isSetup;
  }

  db.exec(`
     CREATE TABLE submissions (
         id TEXT PRIMARY KEY NOT NULL,
         href TEXT NOT NULL UNIQUE,
         title TEXT NOT NULL,
         timestamp INTEGER NOT NULL,
         signer TEXT NOT NULL,
         identity TEXT NOT NULL,
         community TEXT
     );
     CREATE INDEX IF NOT EXISTS idx_submission_href ON submissions(href);
     CREATE INDEX IF NOT EXISTS idx_submissions_community ON submissions(community);
     CREATE INDEX IF NOT EXISTS idx_submissions_timestamp ON submissions(timestamp);
     CREATE INDEX IF NOT EXISTS idx_submissions_identity ON submissions(identity);
   `);

  db.exec(`
     CREATE TABLE upvotes (
         id TEXT PRIMARY KEY NOT NULL,
         href TEXT NOT NULL,
         timestamp INTEGER NOT NULL,
         title TEXT NOT NULL,
         signer TEXT NOT NULL,
         identity TEXT NOT NULL,
         FOREIGN KEY(href) REFERENCES submissions(href)
     );
     CREATE INDEX IF NOT EXISTS idx_upvotes_submission_href ON upvotes(href);
     CREATE INDEX IF NOT EXISTS idx_upvotes_timestamp ON upvotes(timestamp);
     CREATE INDEX IF NOT EXISTS idx_upvotes_identity ON upvotes(identity);
   `);

  db.exec(`
     CREATE TABLE comments (
         id TEXT PRIMARY KEY NOT NULL,
         submission_id TEXT NOT NULL,
         timestamp INTEGER NOT NULL,
         title TEXT NOT NULL,
         signer TEXT NOT NULL,
         identity TEXT NOT NULL,
         FOREIGN KEY(submission_id) REFERENCES submissions(id)
     );
     CREATE INDEX IF NOT EXISTS idx_comments_submission_id ON comments(submission_id);
     CREATE INDEX IF NOT EXISTS idx_comments_timestamp ON comments(timestamp);
     CREATE INDEX IF NOT EXISTS idx_comments_identity ON comments(identity);
   `);

  db.exec(`
      CREATE TABLE fingerprints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        hash TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_fingerprints_url ON fingerprints(url);
      CREATE INDEX IF NOT EXISTS idx_fingerprints_hash ON fingerprints(hash);
      CREATE INDEX IF NOT EXISTS idx_url_fingerprints_timestamp ON fingerprints(timestamp);
    `);
  messages.forEach(insertMessage);
  log("initialize: Done re-inserting all messages");
}

// Communities (protocol 13.0.0, src/communities.mjs). Runs before
// `initialize`: it adds the `community` column to a submissions table made by
// an older version and creates the communities table.
//
// The table has one row per signing key and name key: the newest version
// that key signed under that name, and when the first one was created. It
// doesn't store the owner. A community belongs to the identity its signers
// resolve to through the delegations, and a node may learn a delegation
// after it stored the community, so the owner is resolved whenever posts are
// judged or communities are read. That way the rows depend only on the trie,
// and every node that knows the same delegations comes to the same result.
export function initializeCommunities(database = db) {
  const db = database;
  const submissions = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='submissions'`,
    )
    .get();
  if (submissions) {
    const columns = db
      .prepare(`PRAGMA table_info(submissions)`)
      .all()
      .map(({ name }) => name);
    if (!columns.includes("community")) {
      try {
        db.exec(`ALTER TABLE submissions ADD COLUMN community TEXT`);
      } catch (err) {
        // NOTE: Another process may have added it in the meantime.
        if (!err.message.includes("duplicate column")) throw err;
      }
    }
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_submissions_community ON submissions(community)`,
    );
  }

  // NOTE: The first 13.0.0 release keyed the table by the owner as resolved
  // when a community was stored. It's derived data, so it's dropped and
  // launch.mjs fills the new table from the trie.
  const columns = db
    .prepare(`PRAGMA table_info(communities)`)
    .all()
    .map(({ name }) => name);
  if (columns.length && !columns.includes("key")) {
    db.exec(`DROP TABLE IF EXISTS communities`);
  }

  db.exec(`
     CREATE TABLE IF NOT EXISTS communities (
         signer TEXT NOT NULL,
         key TEXT NOT NULL,
         name TEXT NOT NULL,
         about TEXT NOT NULL,
         rules TEXT NOT NULL,
         icon TEXT NOT NULL,
         color TEXT NOT NULL,
         created INTEGER NOT NULL,
         timestamp INTEGER NOT NULL,
         message TEXT NOT NULL,
         PRIMARY KEY (signer, key)
     );
     CREATE INDEX IF NOT EXISTS idx_communities_key ON communities(key);
   `);
}

// NOTE: In an UPDATE, SQLite evaluates every SET expression on the row as it
// was, so "newer" compares against the stored version throughout. Of two
// versions with the same timestamp, the one with the greater index wins, so
// every node keeps the same one.
const newerCommunity = `(excluded.timestamp > communities.timestamp OR
  (excluded.timestamp = communities.timestamp AND excluded.message > communities.message))`;
const pick = (column) =>
  `${column} = CASE WHEN ${newerCommunity} THEN excluded.${column} ELSE communities.${column} END`;
const upsertCommunity = `INSERT INTO communities
     (signer, key, name, about, rules, icon, color, created, timestamp, message)
   VALUES
     (@signer, @key, @name, @about, @rules, @icon, @color, @timestamp, @timestamp, @message)
   ON CONFLICT(signer, key) DO UPDATE SET
     created = MIN(communities.created, excluded.created),
     ${["name", "about", "rules", "icon", "color", "timestamp", "message"]
       .map(pick)
       .join(",\n     ")}`;

// Stores a version of a community: the message plus its `index` and the
// `signer` that recovered from it. Returns the row as it was before, for
// restoreCommunity.
export function insertCommunity(message, database = db) {
  const { index, name, about, rules, icon, color, timestamp, signer } = message;
  const row = {
    signer: signer.toLowerCase(),
    key: nameKey(name),
  };
  const before = database
    .prepare(`SELECT * FROM communities WHERE signer = ? AND key = ?`)
    .get(row.signer, row.key);
  database.prepare(upsertCommunity).run({
    ...row,
    name,
    about,
    rules: JSON.stringify(rules),
    icon,
    color,
    timestamp,
    message: index,
  });
  return { ...row, before };
}

// Undoes insertCommunity, e.g. when storing the message in the trie failed.
export function restoreCommunity({ signer, key, before }, database = db) {
  if (!before) {
    database
      .prepare(`DELETE FROM communities WHERE signer = ? AND key = ?`)
      .run(signer, key);
    return;
  }
  database
    .prepare(
      `UPDATE communities SET name = @name, about = @about, rules = @rules,
         icon = @icon, color = @color, created = @created,
         timestamp = @timestamp, message = @message
       WHERE signer = @signer AND key = @key`,
    )
    .run(before);
}

// Puts every version of the trie's communities into the table again, at
// startup (launch.mjs), in case an insert went missing. It's one transaction
// per batch and yields in between, so a node with many versions keeps
// answering.
export async function insertCommunities(messages, database = db) {
  const batch = 500;
  const insert = database.transaction((versions) => {
    for (const message of versions) insertCommunity(message, database);
  });
  for (let i = 0; i < messages.length; i += batch) {
    const versions = messages
      .slice(i, i + batch)
      .filter((message) => message && message.signer && message.name);
    try {
      insert(versions);
    } catch (err) {
      log(`Failed to insert a batch of communities: ${err.toString()}`);
    }
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function ownerOf(signer, delegations) {
  return resolveIdentity(delegations, signer).toLowerCase();
}

// The rows that make up the community `<owner>/<key>`: every key that signed
// a version under that name and resolves to the owner.
function rowsOf(id, delegations, database) {
  const [owner, key] = normalizeId(id).split("/");
  if (!owner || !key) return [];
  let rows;
  try {
    rows = database
      .prepare(`SELECT * FROM communities WHERE key = ?`)
      .all(key);
  } catch (err) {
    // NOTE: The table doesn't exist before initializeCommunities ran.
    if (err.message.includes("no such table")) return [];
    throw err;
  }
  return rows.filter((row) => ownerOf(row.signer, delegations) === owner);
}

// When the community was first created (its oldest version's timestamp), or
// undefined if this node doesn't have it. Nodes judge posts to a community by
// it.
export function communityCreatedAt(id, delegations = {}, database = db) {
  const rows = rowsOf(id, delegations, database);
  return rows.length ? Math.min(...rows.map((row) => row.created)) : undefined;
}

// A community from its rows: the newest version's content, the oldest
// version's creation time.
function merge(owner, rows) {
  const newest = rows.reduce((a, b) =>
    b.timestamp > a.timestamp ||
    (b.timestamp === a.timestamp && b.message > a.message)
      ? b
      : a,
  );
  return {
    id: `${owner}/${newest.key}`,
    owner: utils.getAddress(owner),
    name: newest.name,
    about: newest.about,
    rules: JSON.parse(newest.rules),
    icon: newest.icon,
    color: newest.color,
    created: Math.min(...rows.map((row) => row.created)),
    timestamp: newest.timestamp,
    index: `0x${newest.message}`,
  };
}

export function getCommunity(id, delegations = {}, database = db) {
  const rows = rowsOf(id, delegations, database);
  if (!rows.length) return null;
  return merge(normalizeId(id).split("/")[0], rows);
}

export function listCommunities(delegations = {}, database = db) {
  const groups = new Map();
  for (const row of database.prepare(`SELECT * FROM communities`).all()) {
    const owner = ownerOf(row.signer, delegations);
    const id = `${owner}/${row.key}`;
    if (!groups.has(id)) groups.set(id, { owner, rows: [] });
    groups.get(id).rows.push(row);
  }
  return [...groups.values()]
    .map(({ owner, rows }) => merge(owner, rows))
    .sort((a, b) => a.created - b.created || (a.id < b.id ? -1 : 1));
}

// How many stories each community has and when the newest one came in, by
// the ID its posts name (`submissions.community`). With `id`, only that
// community's entry. A community without stories has no entry.
export function communityActivity(id) {
  const rows = db
    .prepare(
      `SELECT community AS id, COUNT(*) AS stories, MAX(timestamp) AS lastStory
       FROM submissions
       WHERE ${id === undefined ? "community IS NOT NULL" : "community = ?"}
       GROUP BY community`,
    )
    .all(...(id === undefined ? [] : [id.toLowerCase()]));
  return new Map(
    rows.map(({ id, stories, lastStory }) => [id, { stories, lastStory }]),
  );
}

// Which stories a feed reads (communities, protocol 13.0.0). listNewest and
// getBest take one; without it they read every story.
// - KIWI_NEW: Kiwi News' New, the stories without a community.
// - KIWI_TOP: Kiwi News' Hot and Best, which also take a community's story
//   once it has COMMUNITY_KIWI_MIN_UPVOTES upvotes.
// - inCommunity(id): one community's stories.
export const KIWI_NEW = Object.freeze({ kiwi: "new" });
export const KIWI_TOP = Object.freeze({ kiwi: "top" });
export function inCommunity(id) {
  return { community: id.toLowerCase() };
}

function scopeFilter(scope, alias) {
  if (!scope) return null;
  if (typeof scope.community === "string") {
    return { sql: `${alias}.community = ?`, params: [scope.community] };
  }
  if (scope.kiwi === "new") {
    return { sql: `${alias}.community IS NULL`, params: [] };
  }
  if (scope.kiwi === "top") {
    // NOTE: Counted like the feeds' `upvotes`: the submission is one.
    return {
      sql: `(${alias}.community IS NULL OR
        (SELECT COUNT(*) FROM upvotes kiwi_u WHERE kiwi_u.href = ${alias}.href) + 1 >= ?)`,
      params: [COMMUNITY_KIWI_MIN_UPVOTES],
    };
  }
  throw new Error(`Unknown feed scope: ${JSON.stringify(scope)}`);
}

// NOTE: The `community` column holds the ID a story's submission named.
// Readers hand it on as `communityId`, so the bare ID never goes out as a
// story's `community`: the API puts the community object there
// (src/communities-api.mjs `withCommunities`). Before the column exists
// (initializeCommunities), it is null.
function readCommunity({ community, ...row }) {
  return { ...row, communityId: community ?? null };
}

export function initializeNotifications() {
  const tableExists = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='notifications'",
    )
    .get();

  if (tableExists) return;

  db.exec(`
     CREATE TABLE notifications (
       identity TEXT NOT NULL PRIMARY KEY,
       timestamp INTEGER NOT NULL
     );
   `);
}

export function initializeReactions() {
  const tableExists = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='reactions'",
    )
    .get();

  if (tableExists) {
    log(
      "Aborting cache.initializeReactions early because table already exists",
    );
    return;
  }

  log("Creating reactions table");
  db.exec(`
    CREATE TABLE reactions (
      id TEXT PRIMARY KEY NOT NULL,
      comment_id TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      title TEXT NOT NULL,
      signer TEXT NOT NULL,
      identity TEXT NOT NULL,
      FOREIGN KEY(comment_id) REFERENCES comments(id)
    );
    CREATE INDEX IF NOT EXISTS idx_reactions_comment_id ON reactions(comment_id);
    CREATE INDEX IF NOT EXISTS idx_reactions_timestamp ON reactions(timestamp);
    CREATE INDEX IF NOT EXISTS idx_reactions_identity ON reactions(identity);
  `);
}

export function isReactionComment(title) {
  const trimmedTitle = title.trim();
  return /^\p{Emoji}+$/u.test(trimmedTitle);
}

export function getCommentAuthorById(commentId) {
  try {
    const [, commentHex] = commentId.split(":");

    const query = `
      SELECT identity 
      FROM comments 
      WHERE id = ?
    `;

    const row = db.prepare(query).get(`kiwi:${commentHex}`);
    return row ? row.identity : null;
  } catch (error) {
    log(`Error in getCommentAuthorById: ${error}`);
    return null;
  }
}

export function getTimestamp(identity) {
  const row = db
    .prepare(`SELECT timestamp FROM notifications WHERE identity = ?`)
    .get(identity);
  return row ? row.timestamp : null;
}

export function setTimestamp(identity, timestamp) {
  // NOTE: For a user without a 'lastValue' in their cookies and no server
  // value this function would throw and return the error to the user, so we
  // have to have a default value, which we set to the current time.
  if (!timestamp) {
    timestamp = Math.floor(new Date().getTime() / 1000);
  }

  db.prepare(
    `
     INSERT INTO notifications (identity, timestamp) VALUES (?, ?)
     ON CONFLICT(identity) DO UPDATE SET timestamp = excluded.timestamp;
   `,
  ).run(identity, timestamp);
}

export function countOutbounds(url) {
  const normalizedUrl = normalizeUrl(url, {
    stripWWW: false,
  });

  const query = db.prepare(`
     SELECT COUNT(DISTINCT hash) AS uniqueHashCount
     FROM fingerprints 
     WHERE url = ?
   `);
  const result = query.get(normalizedUrl);
  return result.uniqueHashCount;
}

export function countImpressions(url) {
  const normalizedUrl = normalizeUrl(url, {
    stripWWW: false,
  });

  const query = db.prepare(`
     SELECT COUNT(DISTINCT hash) AS uniqueHashCount
     FROM impressions 
     WHERE url = ?
   `);
  const result = query.get(normalizedUrl);
  return result ? result.uniqueHashCount : 0;
}

export function trackOutbound(url, hash) {
  const normalizedUrl = normalizeUrl(url, {
    stripWWW: false,
  });
  const timestamp = Math.floor(Date.now() / 1000);
  const insert = db.prepare(
    `INSERT INTO fingerprints(url, hash, timestamp) VALUES (?,?,?)`,
  );
  insert.run(normalizedUrl, hash, timestamp);
}

export function trackImpression(url, hash) {
  const normalizedUrl = normalizeUrl(url, {
    stripWWW: false,
  });
  const timestamp = Math.floor(Date.now() / 1000);
  const insert = db.prepare(
    `INSERT INTO impressions(url, hash, timestamp) VALUES (?,?,?)`,
  );
  insert.run(normalizedUrl, hash, timestamp);
}

export function trackShare(url, hash, shareType) {
  const normalizedUrl = normalizeUrl(url, {
    stripWWW: false,
  });
  const timestamp = Math.floor(Date.now() / 1000);
  const insert = db.prepare(
    `INSERT INTO shares(url, hash, share_type, timestamp) VALUES (?,?,?,?)`,
  );
  insert.run(normalizedUrl, hash, shareType, timestamp);
}

export function countShares(url) {
  const normalizedUrl = normalizeUrl(url, {
    stripWWW: false,
  });

  const query = db.prepare(`
     SELECT COUNT(DISTINCT hash) AS uniqueHashCount
     FROM shares
     WHERE url = ?
   `);
  const result = query.get(normalizedUrl);
  return result ? result.uniqueHashCount : 0;
}

function countUniqueHashesByUrl(table, normalizedUrls) {
  const counts = new Map();
  if (normalizedUrls.length === 0) return counts;
  const rows = db
    .prepare(
      `SELECT url, COUNT(DISTINCT hash) AS uniqueHashCount
       FROM ${table}
       WHERE url IN (SELECT value FROM json_each(?))
       GROUP BY url`,
    )
    .all(JSON.stringify(normalizedUrls));
  for (const row of rows) {
    counts.set(row.url, row.uniqueHashCount);
  }
  return counts;
}

// Batched version of countOutbounds, countImpressions and countShares: runs
// one query per table for all hrefs instead of several queries per href.
// Returns a Map from the original href to { outbounds, impressions, shares },
// or to null when the href can't be normalized (the single-URL functions
// throw in that case).
export function countEngagements(hrefs) {
  const normalized = new Map();
  for (const href of new Set(hrefs)) {
    try {
      normalized.set(href, normalizeUrl(href, { stripWWW: false }));
    } catch (err) {
      normalized.set(href, null);
    }
  }

  const urls = [...new Set(normalized.values())].filter((url) => url !== null);
  const outbounds = countUniqueHashesByUrl("fingerprints", urls);
  const impressions = countUniqueHashesByUrl("impressions", urls);
  const shares = countUniqueHashesByUrl("shares", urls);

  const result = new Map();
  for (const [href, url] of normalized) {
    if (url === null) {
      result.set(href, null);
      continue;
    }
    result.set(href, {
      outbounds: outbounds.get(url) || 0,
      impressions: impressions.get(url) || 0,
      shares: shares.get(url) || 0,
    });
  }
  return result;
}

// Calculate karma directly from SQLite database
export function calculateKarmaFromDB(identity, endDate) {
  try {
    let dateFilterSubmissions = "";
    let dateFilterUpvotes = "";

    if (endDate) {
      dateFilterSubmissions = "AND s.timestamp <= ?";
      dateFilterUpvotes = "AND u.timestamp <= ?";
    }

    const query = `
      SELECT COUNT(DISTINCT s.href) + COUNT(u.rowid) AS total_karma
      FROM submissions s
      LEFT JOIN upvotes u ON s.href = u.href ${dateFilterUpvotes}
      WHERE s.identity = ? ${dateFilterSubmissions}
    `;

    let fullParams;
    if (endDate) {
      const endTimestamp = Math.floor(endDate.getTime() / 1000);
      fullParams = [endTimestamp, identity, endTimestamp];
    } else {
      fullParams = [identity];
    }

    const result = db.prepare(query).get(fullParams);
    return result.total_karma;
  } catch (err) {
    log(`Error calculating karma from DB: ${err.toString()}`);
    return 0;
  }
}

// Get top karma users directly from database
export function getKarmaRanking() {
  try {
    const query = `
      WITH submission_counts AS (
        SELECT identity, COUNT(*) as submission_count
        FROM submissions
        GROUP BY identity
      ),
      upvote_counts AS (
        SELECT s.identity, COUNT(*) as upvote_count
        FROM submissions s
        JOIN upvotes u ON s.href = u.href
        GROUP BY s.identity
      )
      SELECT 
        sc.identity as identity,
        COALESCE(sc.submission_count, 0) + COALESCE(uc.upvote_count, 0) as karma
      FROM submission_counts sc
      LEFT JOIN upvote_counts uc ON sc.identity = uc.identity
      
      UNION
      
      SELECT 
        uc.identity as identity,
        COALESCE(sc.submission_count, 0) + COALESCE(uc.upvote_count, 0) as karma
      FROM upvote_counts uc
      LEFT JOIN submission_counts sc ON uc.identity = sc.identity
      WHERE sc.identity IS NULL
      
      ORDER BY karma DESC
    `;

    const results = db.prepare(query).all();
    return results.map((row) => ({
      identity: row.identity,
      karma: row.karma,
    }));
  } catch (err) {
    log(`Error in getKarmaRanking: ${err.toString()}`);
    return [];
  }
}

export function getBest(amount, from, orderBy, domain, startDatetime, scope) {
  let orderClause = "upvotesCount DESC";
  if (orderBy === "new") {
    orderClause = "s.timestamp DESC";
  }
  const filter = scopeFilter(scope, "s");

  const query = `
     SELECT
       s.*,
       COUNT(u.id) AS upvotesCount,
       GROUP_CONCAT(u.identity) AS upvoters
     FROM
       submissions s
     LEFT JOIN
       upvotes u ON s.href = u.href
     WHERE
       (
         ? = '' OR
         s.href GLOB 'https://*.' || ? || '/*' OR
         s.href GLOB 'https://' || ? || '/*'
       )
       AND (? = 0 OR s.timestamp > ?)
       ${filter ? `AND ${filter.sql}` : ""}
     GROUP BY
       s.href
     ORDER BY
       ${orderClause}
     LIMIT ? OFFSET ?
   `;

  const submissions = db
    .prepare(query)
    .all(
      domain,
      domain,
      domain,
      startDatetime,
      startDatetime,
      ...(filter ? filter.params : []),
      amount,
      from,
    )
    .map(readCommunity);

  return submissions.map((submission) => {
    const [, index] = submission.id.split("0x");
    const upvotersArray = submission.upvoters
      ? submission.upvoters.split(",")
      : [];
    upvotersArray.unshift(submission.identity);
    delete submission.id;
    return {
      ...submission,
      index,
      upvotes: submission.upvotesCount + 1,
      upvoters: upvotersArray,
    };
  });
}

export function getSubmissionCount(identity) {
  const query = `
    SELECT COUNT(*) as count
    FROM submissions
    WHERE identity = ?
  `;
  
  const result = db.prepare(query).get(identity);
  return result ? result.count : 0;
}

export function getSubmissions(identity, amount, from, orderBy, domains) {
  let orderClause = "upvotesCount DESC";
  if (orderBy === "new") {
    orderClause = "s.timestamp DESC";
  }

  const query = `
     SELECT
       s.*,
       (SELECT COUNT(*) FROM upvotes WHERE href = s.href) AS upvotesCount,
       GROUP_CONCAT(u.identity) AS upvoters
     FROM
       submissions s
     LEFT JOIN
       upvotes u ON s.href = u.href
     WHERE
       s.identity = ?
     GROUP BY
       s.href
     ORDER BY
       ${orderClause}
     LIMIT ? OFFSET ?
   `;

  const submissions = db
    .prepare(query)
    .all(identity, amount, from)
    .map(readCommunity);

  return submissions.map((submission) => {
    const [, index] = submission.id.split("0x");
    const upvotersArray = submission.upvoters
      ? submission.upvoters.split(",")
      : [];
    upvotersArray.unshift(submission.identity);
    delete submission.id;
    return {
      ...submission,
      index,
      upvotes: submission.upvotesCount + 1,
      upvoters: upvotersArray,
    };
  });
}

export function getUpvotes(identity) {
  const threeWeeksAgo = Math.floor(Date.now() / 1000) - 1814400;

  const submissions = db
    .prepare(`SELECT * from submissions WHERE identity = ? AND timestamp >= ?`)
    .all(identity, threeWeeksAgo)
    .map(readCommunity)
    .map((upvote) => ({
      ...upvote,
      index: upvote.id.split("0x")[1],
    }));

  const query = `
     SELECT u.*
     FROM upvotes u
     JOIN submissions s ON u.href = s.href
     WHERE s.identity = ? AND u.timestamp >= ? AND s.timestamp >= ?
   `;
  const upvotes = db
    .prepare(query)
    .all(identity, threeWeeksAgo, threeWeeksAgo)
    .map((upvote) => ({
      ...upvote,
      index: upvote.id.split("0x")[1],
    }));
  return [...submissions, ...upvotes];
}

export function getReactionsToComments(identity) {
  const threeWeeksAgo = Math.floor(Date.now() / 1000) - 1814400;

  // Get reactions to the user's comments
  const reactions = db
    .prepare(
      `
      SELECT 
        r.*,
        c.title AS comment_title,
        s.title AS submission_title,
        s.id AS submission_id
      FROM 
        reactions r
      JOIN 
        comments c ON r.comment_id = c.id
      JOIN
        submissions s ON c.submission_id = s.id
      WHERE 
        c.identity = ? AND 
        r.identity != ? AND
        r.timestamp >= ?
      ORDER BY
        r.timestamp DESC
    `,
    )
    .all(identity, identity, threeWeeksAgo)
    .map((reaction) => {
      const commentId = reaction.comment_id;
      const submissionId = reaction.submission_id;
      delete reaction.comment_id;
      delete reaction.submission_id;

      return {
        ...reaction,
        commentId,
        submissionId,
        index: reaction.id.split("0x")[1],
        type: "reaction",
      };
    });

  return reactions;
}

export function getComments(identity) {
  const threeWeeksAgo = Math.floor(Date.now() / 1000) - 1814400;
  const comments = db
    .prepare(
      `
     SELECT
       c.*,
       s.title AS submission_title
     FROM
       comments c
     JOIN
       submissions s ON c.submission_id = s.id
     WHERE
       s.identity = ? AND
       c.identity != ? AND
       c.timestamp >= ?
   `,
    )
    .all(identity, identity, threeWeeksAgo)
    .map((comment) => {
      const href = comment.submission_id;
      delete comment.submission_id;

      return {
        ...comment,
        href,
        index: comment.id.split("0x")[1],
      };
    });

  const involvedComments = db
    .prepare(
      `
     SELECT
      c1.*,
      (SELECT title FROM submissions WHERE id = c1.submission_id) AS submission_title
     FROM
      comments AS c1
     WHERE
        submission_id
          IN (
            SELECT submission_id 
            FROM comments
            WHERE identity = ?
            AND timestamp >= ?
          )
      AND
        identity != ?
      AND c1.timestamp > (
        SELECT MIN(c2.timestamp)
        FROM comments AS c2
        WHERE c2.identity = ?
        AND c2.submission_id = c1.submission_id
      )
   `,
    )
    .all(identity, threeWeeksAgo, identity, identity)
    .map((comment) => {
      const href = comment.submission_id;
      delete comment.submission_id;

      return {
        ...comment,
        href,
        index: comment.id.split("0x")[1],
      };
    });
  const uniqueComments = new Map(
    [...comments, ...involvedComments].map((comment) => [comment.id, comment]),
  );

  return Array.from(uniqueComments.values()).sort(
    (a, b) => a.timestamp - b.timestamp,
  );
}

export function getThreadParticipants(submissionId, lastCommentTimestamp) {
  const participants = db
    .prepare(
      `
      SELECT DISTINCT identity, timestamp 
      FROM comments 
      WHERE submission_id = ? 
        AND timestamp < ? 
      ORDER BY timestamp ASC
    `,
    )
    .all(submissionId, lastCommentTimestamp);

  return participants;
}

export function getLastComment(submissionId, bannedAddresses = []) {
  // Get all comments for the submission, ordered by timestamp descending
  const comments = db
    .prepare(
      `
     SELECT * FROM comments WHERE submission_id = ? ORDER BY timestamp DESC
   `,
    )
    .all(submissionId);

  // Filter out comments from banned addresses and get the first valid one
  const lastComment = comments.find(comment => 
    !bannedAddresses.includes(comment.identity.toLowerCase())
  );

  if (!lastComment) return null;

  const { id, submission_id, ...rest } = lastComment;
  const [, index] = id.split("0x");

  // Get previous participants in the thread
  const previousParticipants = getThreadParticipants(
    submission_id,
    lastComment.timestamp,
  );

  return {
    ...rest,
    submissionId: submission_id,
    index,
    type: "comment",
    previousParticipants,
  };
}

export function getSubmission(index, href, identityFilter, hrefs, bannedAddresses = []) {
  let submission;
  if (index) {
    submission = db
      .prepare(
        `
     SELECT * FROM submissions WHERE id = ?
   `,
      )
      .get(`kiwi:${index}`);
  }

  if (href) {
    // Skip normalization for text posts and kiwi references
    const normalizedHref = (href.startsWith('data:') || href.startsWith('kiwi:'))
      ? href
      : normalizeUrl(href, { stripWWW: false });
    submission = db
      .prepare(
        `
     SELECT * FROM submissions WHERE href = ?
   `,
      )
      .get(normalizedHref);
  }

  if (!submission && href) {
    throw new Error(`Couldn't find submission with href: ${href}`);
  }
  if (!submission && index) {
    throw new Error(`Couldn't find submission with index: ${index}`);
  }
  submission = readCommunity(submission);
  // NOTE: The feeds hide a banned profile's stories (moderation.moderate), so
  // the story pages, link preview cards and the app's story API, which pass
  // bannedAddresses, mustn't show them either.
  if (bannedAddresses.includes(submission.identity.toLowerCase())) {
    throw new Error(`Submission was moderated: ${index || href}`);
  }


  let upvotesCount =
    db
      .prepare(
        `
     SELECT COUNT(*) AS count FROM upvotes WHERE href = ?
   `,
      )
      .get(submission.href).count + 1;

  let upvoters = db
    .prepare(
      `
       SELECT identity, timestamp FROM upvotes WHERE href = ?
     `,
    )
    .all(submission.href);

  if (
    (identityFilter && !hrefs) ||
    (identityFilter &&
      hrefs &&
      hrefs.length !== 0 &&
      hrefs.includes(submission.href))
  ) {
    let validatedUpvoters = [];
    // NOTE: When I tried using a map and Promise allSettled to parallelize,
    // the ethers component of identityFilter was constantly failing with call
    // exceptions. So when I serialized this call it started working.
    for (const upvoter of upvoters) {
      try {
        const validated = identityFilter(upvoter, submission.identity);
        validatedUpvoters.push(validated);
      } catch (err) {}
    }
    upvotesCount = validatedUpvoters.length + 1;
    upvoters = validatedUpvoters;
  }

  upvoters = [
    { identity: submission.identity, timestamp: submission.timestamp },
    ...upvoters,
  ];

  const comments = db
    .prepare(
      `
     SELECT * FROM comments WHERE submission_id = ? ORDER BY timestamp ASC
   `,
    )
    .all(submission.id)
    .filter((comment) => {
      // Filter out comments from banned addresses
      return !bannedAddresses.includes(comment.identity.toLowerCase());
    })
    .map((comment) => {
      const [, index] = comment.id.split("0x");
      const originalCommentId = comment.id;
      delete comment.id;
      const submissionId = comment.submission_id;
      delete comment.submission_id;

      const reactions = db
        .prepare(
          `
          SELECT title as emoji, COUNT(*) as count, GROUP_CONCAT(identity) as reactors
          FROM reactions 
          WHERE comment_id = ?
          GROUP BY title
          ORDER BY count DESC, timestamp ASC
        `,
        )
        .all(originalCommentId);

      return {
        ...comment,
        submissionId,
        index,
        type: "comment",
        reactions: reactions.map((reaction) => ({
          emoji: reaction.emoji,
          count: reaction.count,
          reactors: reaction.reactors.split(","),
        })),
      };
    });

  const [, indexExtracted] = submission.id.split("0x");
  delete submission.id;

  return {
    ...submission,
    index: indexExtracted,
    upvotes: upvotesCount,
    upvoters,
    comments,
  };
}

export function listSitemapMonths() {
  return db.prepare(`
    SELECT DISTINCT strftime('%Y-%m', timestamp, 'unixepoch') AS month
    FROM submissions
    ORDER BY month DESC
  `).all().map((row) => row.month);
}

// Every story's id and title, newest first, for resolving a story URL that
// lost its ?index= (src/storyslug.mjs).
export function listSubmissionTitles() {
  return db
    .prepare(`SELECT id, title FROM submissions ORDER BY timestamp DESC`)
    .all();
}

// A month's stories with what src/indexable.mjs needs: upvotes (including the
// submitter's, like getSubmission) and comments, without those of
// `bannedAddresses` (lowercase), which story pages hide too.
export function listSitemapEntries(month, bannedAddresses = []) {
  const rows = db.prepare(`
    SELECT
      s.id, s.title, s.href, s.identity, s.timestamp,
      (SELECT COUNT(*) FROM upvotes u WHERE u.href = s.href) + 1 AS upvotes,
      (SELECT COUNT(*) FROM comments c
        WHERE c.submission_id = s.id
          AND lower(c.identity) NOT IN (SELECT value FROM json_each(?))
      ) AS comments
    FROM submissions s
    WHERE strftime('%Y-%m', s.timestamp, 'unixepoch') = ?
    ORDER BY s.timestamp DESC
  `).all(JSON.stringify(bannedAddresses), month);
  return rows.map((row) => {
    const [, index] = row.id.split("0x");
    return {
      index,
      title: row.title,
      href: row.href,
      identity: row.identity,
      timestamp: row.timestamp,
      upvotes: row.upvotes,
      comments: row.comments,
    };
  });
}

// The stories submitted in [start, end) with their upvotes, comments and
// outbound clicks, ranked like the newsletter (src/digest.mjs): upvotes * 3 +
// comments * 2 + clicks. The counts are correlated subqueries on indexed
// columns (upvotes.href, comments.submission_id, fingerprints.url) and the
// range uses idx_submissions_timestamp, so this only touches one week.
export function getWeekStories(start, end, amount) {
  const rows = db
    .prepare(
      `SELECT * FROM (
         SELECT
           s.*,
           (SELECT COUNT(*) FROM upvotes u WHERE u.href = s.href) + 1 AS upvotes,
           (SELECT COUNT(*) FROM comments c WHERE c.submission_id = s.id) AS comments,
           (SELECT COUNT(DISTINCT f.hash) FROM fingerprints f WHERE f.url = s.href) AS clicks
         FROM submissions s
         WHERE s.timestamp >= ? AND s.timestamp < ?
       )
       ORDER BY upvotes * 3 + comments * 2 + clicks DESC, upvotes DESC, timestamp ASC
       LIMIT ?`,
    )
    .all(start, end, amount)
    .map(readCommunity);
  return rows.map(({ id, ...row }) => ({ ...row, index: id.split("0x")[1] }));
}

// Timestamps of the last submission before `start` and the first one from
// `end` on, to link a week to its non-empty neighbours.
export function getNeighbourTimestamps(start, end) {
  return db
    .prepare(
      `SELECT
         (SELECT MAX(timestamp) FROM submissions WHERE timestamp < ?) AS previous,
         (SELECT MIN(timestamp) FROM submissions WHERE timestamp >= ?) AS next`,
    )
    .get(start, end);
}

// One row per week (Monday to Sunday, UTC) with submissions, newest first.
// The unix epoch was a Thursday, so shifting by 3 days aligns the buckets to
// Mondays. With `activity`, also the latest submission, upvote or comment on
// each week's stories (for the sitemap's lastmod).
const MONDAY_OFFSET = 3 * 24 * 60 * 60;
const WEEK_SECS = 7 * 24 * 60 * 60;
export function listWeeks({ activity = false } = {}) {
  const latest = activity
    ? `MAX(
         s.timestamp,
         COALESCE((SELECT MAX(u.timestamp) FROM upvotes u WHERE u.href = s.href), 0),
         COALESCE((SELECT MAX(c.timestamp) FROM comments c WHERE c.submission_id = s.id), 0)
       )`
    : "s.timestamp";
  return db
    .prepare(
      `SELECT bucket, COUNT(*) AS stories, MAX(latest) AS lastActivity FROM (
         SELECT (s.timestamp + ${MONDAY_OFFSET}) / ${WEEK_SECS} AS bucket, ${latest} AS latest
         FROM submissions s
       )
       GROUP BY bucket
       ORDER BY bucket DESC`,
    )
    .all()
    .map(({ bucket, stories, lastActivity }) => ({
      start: bucket * WEEK_SECS - MONDAY_OFFSET,
      stories,
      lastActivity,
    }));
}

// `scope`: which stories, see KIWI_NEW, KIWI_TOP and inCommunity.
export function listNewest(limit = 30, lookbackUnixTime, scope) {
  const where = [];
  const params = [];
  if (lookbackUnixTime) {
    where.push("s.timestamp > ?");
    params.push(lookbackUnixTime);
  }
  const filter = scopeFilter(scope, "s");
  if (filter) {
    where.push(filter.sql);
    params.push(...filter.params);
  }
  const query = `
     SELECT s.* FROM submissions s
     ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY s.timestamp DESC
     LIMIT ?
   `;
  params.push(limit);
  const submissions = db.prepare(query).all(params).map(readCommunity);

  const submissionsWithUpvotes = submissions.map((submission) => {
    const upvotes =
      db
        .prepare(
          `
       SELECT COUNT(*) AS count FROM upvotes
       WHERE href = ?
     `,
        )
        .get(submission.href).count + 1;

    const upvoters = [
      submission.identity,
      ...db
        .prepare(
          `
       SELECT identity FROM upvotes
       WHERE href = ?
     `,
        )
        .all(submission.href)
        .map((upvote) => upvote.identity),
    ];

    const [, index] = submission.id.split("0x");
    delete submission.id;
    return {
      ...submission,
      index,
      upvotes,
      upvoters,
    };
  });

  return submissionsWithUpvotes;
}

export function addCompoundIndexes() {
  log("Creating compound indexes for database optimization");
  try {
    db.exec(`
      -- Comments table indexes
      CREATE INDEX IF NOT EXISTS idx_comments_identity_timestamp ON comments(identity, timestamp);
      CREATE INDEX IF NOT EXISTS idx_comments_submission_id_identity ON comments(submission_id, identity);
      CREATE INDEX IF NOT EXISTS idx_comments_identity_submission_id ON comments(identity, submission_id);
      CREATE INDEX IF NOT EXISTS idx_comments_submission_id_timestamp ON comments(submission_id, timestamp);
      
      -- Reactions table indexes
      CREATE INDEX IF NOT EXISTS idx_reactions_comment_id_identity ON reactions(comment_id, identity);
      CREATE INDEX IF NOT EXISTS idx_reactions_identity_timestamp ON reactions(identity, timestamp);
      
      -- Upvotes table indexes
      CREATE INDEX IF NOT EXISTS idx_upvotes_href_identity ON upvotes(href, identity);
    `);
    log("Successfully created compound indexes");
  } catch (error) {
    log(`Error creating compound indexes: ${error.toString()}`);
  }
}

export function insertMessage(message) {
  const { type, href, index, title, timestamp, signature, signer, identity } =
    message;

  if (type === "amplify") {
    // Skip normalization for text posts and kiwi references
    const normalizedHref = (href.startsWith('data:') || href.startsWith('kiwi:'))
      ? href
      : normalizeUrl(href, { stripWWW: false });
    const submissionExists =
      db
        .prepare(`SELECT COUNT(*) AS count FROM submissions WHERE href = ?`)
        .get(normalizedHref).count > 0;
    if (!submissionExists && message.community !== undefined) {
      // A submission to a community (an upvote never changes it).
      db.prepare(
        `INSERT INTO submissions (id, href, title, timestamp, signer, identity, community) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        `kiwi:0x${index}`,
        normalizedHref,
        title,
        timestamp,
        signer,
        identity,
        message.community.toLowerCase(),
      );
    } else if (!submissionExists) {
      // Insert as submission if it doesn't exist
      const insertSubmission = db.prepare(
        `INSERT INTO submissions (id, href, title, timestamp, signer, identity) VALUES (?, ?, ?, ?, ?, ?)`,
      );
      insertSubmission.run(
        `kiwi:0x${index}`,
        normalizedHref,
        title,
        timestamp,
        signer,
        identity,
      );
    } else {
      // Insert as upvote
      const insertUpvote = db.prepare(
        `INSERT INTO upvotes (id, href, timestamp, title, signer, identity) VALUES (?, ?, ?, ?, ?, ?)`,
      );
      insertUpvote.run(
        `kiwi:0x${index}`,
        normalizedHref,
        timestamp,
        title,
        signer,
        identity,
      );
    }
  } else if (type === "comment") {
    if (isReactionComment(title)) {
      // Insert reaction
      const insertReaction = db.prepare(
        `INSERT INTO reactions (id, comment_id, timestamp, title, signer, identity) VALUES (?, ?, ?, ?, ?, ?)`,
      );
      try {
        insertReaction.run(
          `kiwi:0x${index}`,
          href,
          timestamp,
          title.trim(),
          signer,
          identity,
        );
      } catch (err) {
        log(
          `Failing to insert reaction "${title}", error: "${err.toString()}"`,
        );
      }
      return;
    }

    // Insert comment
    const insertComment = db.prepare(
      `INSERT INTO comments (id, submission_id, timestamp, title, signer, identity) VALUES (?, ?, ?, ?, ?, ?)`,
    );
    try {
      insertComment.run(
        `kiwi:0x${index}`,
        href,
        timestamp,
        title,
        signer,
        identity,
      );
    } catch (err) {
      log(`Failing to insert comment "${title}", error: "${err.toString()}"`);
    }
  } else if (type === "community") {
    // NOTE: store.mjs's atomicPut writes the row before the trie.
    return;
  } else {
    throw new Error("Unsupported message type");
  }
}

// Returns the number of comments for a given submission id (e.g. 'kiwi:0x...')
export function countComments(submissionId, bannedAddresses = []) {
  try {
    if (!submissionId) return 0;

    // Fast count first
    let total = db
      .prepare(`SELECT COUNT(*) AS count FROM comments WHERE submission_id = ?`)
      .get(submissionId).count;

    if (!bannedAddresses || bannedAddresses.length === 0) {
      return total;
    }

    // If we need to exclude banned addresses, compute filtered count
    const placeholders = bannedAddresses.map(() => '?').join(',');
    const stmt = db.prepare(`
      SELECT COUNT(*) AS count FROM comments
      WHERE submission_id = ? AND LOWER(identity) NOT IN (${placeholders})
    `);
    const row = stmt.get(submissionId, ...bannedAddresses.map((a) => a.toLowerCase()));
    return row?.count ?? 0;
  } catch (err) {
    log(`countComments error for ${submissionId}: ${err.toString()}`);
    return 0;
  }
}

// Batched version of countComments (without banned addresses): returns a Map
// from submission id to its comment count in a single query.
export function countCommentsBatch(submissionIds) {
  const counts = new Map();
  if (submissionIds.length === 0) return counts;
  try {
    const rows = db
      .prepare(
        `SELECT submission_id, COUNT(*) AS count FROM comments
         WHERE submission_id IN (SELECT value FROM json_each(?))
         GROUP BY submission_id`,
      )
      .all(JSON.stringify([...new Set(submissionIds)]));
    for (const row of rows) {
      counts.set(row.submission_id, row.count);
    }
  } catch (err) {
    log(`countCommentsBatch error: ${err.toString()}`);
  }
  return counts;
}

export async function storeMiniAppUpvote({ fid, href, title, timestamp, walletAddress }) {
  try {
    // Normalize the URL to prevent duplicate upvotes on same story
    // Skip normalization for text posts and kiwi references
    const normalizedHref = (href.startsWith('data:') || href.startsWith('kiwi:'))
      ? href
      : normalizeUrl(href, { stripWWW: false });
    
    // Check if this user has already upvoted this normalized URL
    const existingUpvote = db.prepare(`
      SELECT id FROM upvotes 
      WHERE identity = ? AND href = ? AND signer LIKE 'miniapp:%'
    `).get(walletAddress, normalizedHref);
    
    if (existingUpvote) {
      throw new Error("User has already upvoted this story");
    }
    
    // Create a message object similar to protocol messages for consistent hashing
    const messageForDigest = {
      title,
      href: normalizedHref, // Use normalized URL for consistency
      type: "amplify",
      timestamp,
      fid, // Include FID to make it unique from protocol messages
    };
    
    // Generate proper index using the same digest function as protocol
    const { index } = toDigest(messageForDigest);
    const id = `kiwi:0x${index}`;
    
    // Store in upvotes table with miniapp signature format
    const dummySigner = `miniapp:${fid}`;
    
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO upvotes 
      (id, href, timestamp, title, signer, identity) 
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(id, normalizedHref, timestamp, title, dummySigner, walletAddress);
    
    if (result.changes === 0) {
      throw new Error("Duplicate mini app upvote");
    }
    
    log(`Stored mini app upvote: FID ${fid} (${walletAddress}) for ${href}`);
    return { success: true, id };
  } catch (error) {
    log(`Error storing mini app upvote: ${error.message}`);
    throw error;
  }
}