import NodeCache from "node-cache";
const cache = new NodeCache({ stdTTL: 60 * 60 });
export default cache;

import { join } from "path";

import { subYears, formatISO } from "date-fns";
import Database from "better-sqlite3";
import { add } from "date-fns";
import normalizeUrl from "normalize-url";
import { ethers } from "ethers";

import log from "./logger.mjs";

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
         identity TEXT NOT NULL
     );
     CREATE INDEX IF NOT EXISTS idx_submission_href ON submissions(href);
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

export async function getRecommendations(candidates, fingerprint, identity) {
  if (identity) {
    const commentedStories = db
      .prepare(
        `
      SELECT DISTINCT submission_id 
      FROM comments 
      WHERE identity = ?
    `,
      )
      .all(identity)
      .map((row) => row.submission_id);

    candidates = candidates.filter((story) => {
      return (
        story.identity !== identity &&
        !story.upvoters.includes(identity) &&
        !commentedStories.includes(`kiwi:0x${story.index}`)
      );
    });
  }

  const clickedUrls = db
    .prepare(
      `
    SELECT DISTINCT url 
    FROM fingerprints 
    WHERE hash = ?
  `,
    )
    .all(fingerprint)
    .map((row) => row.url);

  return candidates.filter(
    (story) =>
      !clickedUrls.includes(normalizeUrl(story.href, { stripWWW: false })),
  );
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

export function getRandomIndex() {
  const row = db
    .prepare(`SELECT id FROM submissions ORDER BY RANDOM() LIMIT 1`)
    .get();
  if (!row) {
    throw new Error("Nothing found in db");
  }
  const [, index] = row.id.split("kiwi:");
  return index;
}

export function getContributionsData(identity) {
  const endDate = new Date();
  const startDate = new Date(new Date().getFullYear(), 0, 1);
  const startTimestamp = Math.floor(startDate.getTime() / 1000);
  const endTimestamp = Math.floor(endDate.getTime() / 1000);

  const query = `
     SELECT date(timestamp, 'unixepoch') AS date, COUNT(*) AS count
     FROM (
       SELECT timestamp FROM submissions WHERE timestamp BETWEEN ? AND ? AND identity = ?
       UNION ALL
       SELECT timestamp FROM upvotes WHERE timestamp BETWEEN ? AND ? AND identity = ?
     )
     GROUP BY date
     ORDER BY date
   `;
  const params = [
    startTimestamp,
    endTimestamp,
    identity,
    startTimestamp,
    endTimestamp,
    identity,
  ];
  const rawData = db.prepare(query).all(params);

  const contributions = rawData.map(({ date, count }) => ({
    date,
    count,
    color: "#654515",
    intensity: count,
  }));

  let contributionsData = {
    years: [
      {
        year: startDate.getFullYear().toString(),
        total: contributions.reduce((acc, curr) => acc + curr.count, 0),
        range: {
          start: formatISO(startDate, { representation: "date" }),
          end: formatISO(endDate, { representation: "date" }),
        },
      },
    ],
    contributions,
  };

  return contributionsData;
}

export function getHashesPerDateRange(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const dates = [];
  const counts = [];

  for (let day = start; day <= end; day = add(day, { days: 1 })) {
    const dayStartTimestamp = Math.floor(day.getTime() / 1000);
    const nextDay = add(day, { days: 1 });
    const dayEndTimestamp = Math.floor(nextDay.getTime() / 1000) - 1;

    const query = `
        SELECT COUNT(DISTINCT hash) AS count
        FROM fingerprints
        WHERE timestamp >= ? AND timestamp <= ?
      `;
    const params = [dayStartTimestamp, dayEndTimestamp];
    const result = db.prepare(query).get(params);
    dates.push(day);
    counts.push(result.count);
  }

  return { dates, counts };
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

export function getImpressionsWithTimestamps(startTimestamp, endTimestamp) {
  const query = db.prepare(`
    SELECT url, hash, timestamp
    FROM impressions
    WHERE timestamp >= ? AND timestamp <= ?
    ORDER BY timestamp
  `);
  
  return query.all(startTimestamp, endTimestamp);
}

export function getOutboundsWithTimestamps(startTimestamp, endTimestamp) {
  const query = db.prepare(`
    SELECT url, hash, timestamp
    FROM fingerprints
    WHERE timestamp >= ? AND timestamp <= ?
    ORDER BY timestamp
  `);
  
  return query.all(startTimestamp, endTimestamp);
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

export function getNumberOfOnlineUsers() {
  const timestamp24HoursAgo = Math.floor(Date.now() / 1000 - 24 * 60 * 60);

  const uniqueIdentities = new Set();

  const tables = ["submissions", "upvotes", "comments"];
  tables.forEach((table) => {
    const stmt = db.prepare(`
       SELECT DISTINCT identity FROM ${table}
       WHERE timestamp > ?
     `);
    const identities = stmt.all(timestamp24HoursAgo);
    identities.forEach((identity) => uniqueIdentities.add(identity.identity));
  });

  return uniqueIdentities.size;
}

// Calculate karma directly from SQLite database
export function calculateKarmaFromDB(identity, endDate) {
  try {
    let dateFilter = "";
    let params = [identity];

    if (endDate) {
      const endTimestamp = Math.floor(endDate.getTime() / 1000);
      dateFilter = "AND s.timestamp <= ?";
      params.push(endTimestamp);
    }

    // Count submissions
    const submissionsQuery = `
      SELECT COUNT(*) as count, href
      FROM submissions s
      WHERE s.identity = ? ${dateFilter}
      GROUP BY href
    `;

    const submissions = db.prepare(submissionsQuery).all(params);

    // For each submission, count upvotes
    let totalKarma = 0;

    for (const submission of submissions) {
      // Each submission gives 1 base point
      totalKarma += 1;

      // Count upvotes for this submission
      let upvotesQuery = `
        SELECT COUNT(*) as count
        FROM upvotes u
        WHERE u.href = ?
      `;

      const upvoteParams = [submission.href];

      // Add timestamp filter if needed
      if (endDate) {
        upvotesQuery += " AND u.timestamp <= ?";
        upvoteParams.push(Math.floor(endDate.getTime() / 1000));
      }

      const upvotes = db.prepare(upvotesQuery).get(upvoteParams);
      totalKarma += upvotes.count;
    }

    return totalKarma;
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

export function getBest(amount, from, orderBy, domain, startDatetime) {
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
       (
         ? = '' OR
         s.href GLOB 'https://*.' || ? || '/*' OR
         s.href GLOB 'https://' || ? || '/*'
       )
       AND (? = 0 OR s.timestamp > ?)
     GROUP BY
       s.href
     ORDER BY
       ${orderClause}
     LIMIT ? OFFSET ?
   `;

  const submissions = db
    .prepare(query)
    .all(domain, domain, domain, startDatetime, startDatetime, amount, from);

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

  const submissions = db.prepare(query).all(identity, amount, from);

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
    .map((upvote) => ({
      ...upvote,
      index: upvote.id.split("0x")[1],
    }));

  const query = `
     SELECT u.*
     FROM upvotes u
     JOIN submissions s ON u.href = s.href
     WHERE s.identity = ? AND u.timestamp >= ?
   `;
  const upvotes = db
    .prepare(query)
    .all(identity, threeWeeksAgo)
    .map((upvote) => ({
      ...upvote,
      index: upvote.id.split("0x")[1],
    }));
  return [...submissions, ...upvotes];
}

export function getAllComments() {
  const threeWeeksAgo = Math.floor(Date.now() / 1000) - 1814400;
  return db
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
       c.timestamp >= ?
     ORDER BY
      timestamp DESC
     LIMIT 30
   `,
    )
    .all(threeWeeksAgo)
    .map((comment) => {
      const href = comment.submission_id;
      delete comment.submission_id;

      return {
        ...comment,
        href,
        index: comment.id.split("0x")[1],
      };
    });
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

export function getLastComment(submissionId) {
  const lastComment = db
    .prepare(
      `
     SELECT * FROM comments WHERE submission_id = ? ORDER BY timestamp DESC LIMIT 1
   `,
    )
    .get(submissionId);

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

export function getSubmission(index, href, identityFilter, hrefs) {
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
    const normalizedHref = normalizeUrl(href, {
      stripWWW: false,
    });
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

export function listNewest(limit = 30, lookbackUnixTime) {
  const query = `
     SELECT * FROM submissions
     ${lookbackUnixTime ? "WHERE timestamp > ?" : ""}
     ORDER BY timestamp DESC
     LIMIT ?
   `;
  const params = lookbackUnixTime ? [lookbackUnixTime, limit] : [limit];
  const submissions = db.prepare(query).all(params);

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

export function insertMessage(message) {
  const { type, href, index, title, timestamp, signature, signer, identity } =
    message;

  if (type === "amplify") {
    const normalizedHref = normalizeUrl(href, {
      stripWWW: false,
    });
    const submissionExists =
      db
        .prepare(`SELECT COUNT(*) AS count FROM submissions WHERE href = ?`)
        .get(normalizedHref).count > 0;
    if (!submissionExists) {
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
  } else {
    throw new Error("Unsupported message type");
  }
}
