
import Database from 'better-sqlite3';
import { join } from 'path';
import { fetchENSData } from './ens.mjs';
import 'dotenv/config';

// --- Contest Configuration ---
const CONTEST_START_DATE = new Date('2025-08-05T00:00:00Z');
const CONTEST_END_DATE = new Date('2025-08-12T23:59:59Z');
const PRIZE_POOL = 100; // 100 USDC
const EXCLUDED_RECIPIENTS = [
    '0xee324c588cef1bf1c1360883e4318834af66366d',
    '0x2cb8c01eabdff323c9f2600782132ace6ea37bc4'
];

// --- Database Setup ---
const dbPath = join(process.env.CACHE_DIR, "database.db");
const db = new Database(dbPath, { readonly: true });

// --- Database Functions ---

function getGlobalKarmaSnapshot(snapshotDate) {
    const snapshotTimestamp = Math.floor(snapshotDate.getTime() / 1000);
    const query = `
        SELECT identity, SUM(points) as total_karma
        FROM (
            SELECT identity, 1 as points FROM submissions WHERE timestamp <= ?
            UNION ALL
            SELECT s.identity, 1 as points FROM upvotes u JOIN submissions s ON u.href = s.href WHERE u.timestamp <= ?
        )
        GROUP BY identity
    `;
    const rows = db.prepare(query).all(snapshotTimestamp, snapshotTimestamp);
    const karmaMap = new Map();
    rows.forEach(row => karmaMap.set(row.identity.toLowerCase(), row.total_karma));
    return karmaMap;
}

function getUpvotesInPeriod(startDate, endDate) {
    const startTimestamp = Math.floor(startDate.getTime() / 1000);
    const endTimestamp = Math.floor(endDate.getTime() / 1000);
    const query = `
        SELECT u.identity as upvoter, s.identity as author
        FROM upvotes u
        JOIN submissions s ON u.href = s.href
        WHERE u.timestamp BETWEEN ? AND ?
    `;
    return db.prepare(query).all(startTimestamp, endTimestamp);
}

// --- Main Exported Function ---

export async function getContestLeaderboard() {
    // 1. Get karma snapshot and identify active voters.
    const karmaSnapshot = getGlobalKarmaSnapshot(CONTEST_START_DATE);
    const upvotesInPeriod = getUpvotesInPeriod(CONTEST_START_DATE, CONTEST_END_DATE);
    const activeVoters = new Set(upvotesInPeriod.map(upvote => upvote.upvoter.toLowerCase()));

    // 2. Re-weight the prize pool based on ACTIVE voters' karma.
    let totalActiveKarma = 0;
    for (const voter of activeVoters) {
        totalActiveKarma += karmaSnapshot.get(voter) || 0;
    }
    const votingPower = new Map();
    if (totalActiveKarma > 0) {
        for (const voter of activeVoters) {
            const voterKarma = karmaSnapshot.get(voter) || 0;
            const power = (voterKarma / totalActiveKarma) * PRIZE_POOL;
            votingPower.set(voter, power);
        }
    }

    // 3. Count upvotes cast by each user.
    const upvoteCounts = new Map();
    upvotesInPeriod.forEach(upvote => {
        const upvoter = upvote.upvoter.toLowerCase();
        upvoteCounts.set(upvoter, (upvoteCounts.get(upvoter) || 0) + 1);
    });

    // 4. Distribute voting power to calculate initial earnings for ALL authors.
    const initialEarnings = new Map();
    upvotesInPeriod.forEach(upvote => {
        const upvoter = upvote.upvoter.toLowerCase();
        const author = upvote.author.toLowerCase();
        const upvoterPower = votingPower.get(upvoter) || 0;
        const upvoterTotalUpvotes = upvoteCounts.get(upvoter) || 1;
        const valuePerUpvote = upvoterPower / upvoterTotalUpvotes;
        initialEarnings.set(author, (initialEarnings.get(author) || 0) + valuePerUpvote);
    });

    // 5. Separate winners from excluded recipients and calculate the total prize money for winners.
    const winnerEarnings = new Map();
    let totalWinnerPool = 0;
    for (const [identity, earnings] of initialEarnings.entries()) {
        if (!EXCLUDED_RECIPIENTS.includes(identity)) {
            winnerEarnings.set(identity, earnings);
            totalWinnerPool += earnings;
        }
    }

    // 6. Calculate the scaling factor and apply it to get the final leaderboard.
    const scalingFactor = totalWinnerPool > 0 ? PRIZE_POOL / totalWinnerPool : 0;
    const finalLeaderboard = Array.from(winnerEarnings.entries())
        .map(([identity, earnings]) => ({
            identity,
            earnings: earnings * scalingFactor
        }))
        .sort((a, b) => b.earnings - a.earnings);

    // 7. Resolve names and return the final data structure.
    return await Promise.all(
        finalLeaderboard.map(async (user) => {
            const ensData = await fetchENSData(user.identity).catch(() => null);
            let displayName = user.identity;
            if (ensData && !ensData.error) {
                if (ensData.farcaster && ensData.farcaster.username) {
                    displayName = `@${ensData.farcaster.username}`;
                } else if (ensData.displayName && ensData.displayName.startsWith('@')) {
                    displayName = ensData.displayName;
                } else if (ensData.ens) {
                    displayName = ensData.ens;
                }
            }
            return { ...user, displayName };
        })
    );
}
