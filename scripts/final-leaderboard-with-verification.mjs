
import Database from 'better-sqlite3';
import { join } from 'path';
import { fetchENSData } from '../src/ens.mjs';
import 'dotenv/config';

const dbPath = join(process.env.CACHE_DIR, "database.db");
const db = new Database(dbPath, { readonly: true });

const EXCLUDED_RECIPIENTS = [
    '0xee324c588cef1bf1c1360883e4318834af66366d',
    '0x2cb8c01eabdff323c9f2600782132ace6ea37bc4'
];
const PRIZE_POOL = 100; // 100 USDC

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
    rows.forEach(row => {
        karmaMap.set(row.identity.toLowerCase(), row.total_karma);
    });
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


// --- Main Logic ---

async function generateFinalLeaderboard() {
    console.log('Generating final definitive weighted karma leaderboard with verification...');

    const contestStartDate = new Date('2025-06-27T00:00:00Z');
    const contestEndDate = new Date('2025-07-07T23:59:59Z');

    // 1. Get karma snapshot for ALL users.
    console.log(`Calculating global karma snapshot as of ${contestStartDate.toDateString()}...`);
    const karmaSnapshot = getGlobalKarmaSnapshot(contestStartDate);

    // 2. Identify active voters during the contest period.
    console.log('Identifying active voters...');
    const upvotesInPeriod = getUpvotesInPeriod(contestStartDate, contestEndDate);
    const activeVoters = new Set(upvotesInPeriod.map(upvote => upvote.upvoter.toLowerCase()));
    console.log(`Found ${activeVoters.size} active voters.`);

    // 3. Re-weight the prize pool based on ACTIVE voters' karma.
    let totalActiveKarma = 0;
    for (const voter of activeVoters) {
        totalActiveKarma += karmaSnapshot.get(voter) || 0;
    }
    console.log(`Total karma of active voters: ${totalActiveKarma}`);

    // 4. Calculate the re-weighted voting power for each active voter.
    const votingPower = new Map();
    for (const voter of activeVoters) {
        const voterKarma = karmaSnapshot.get(voter) || 0;
        const power = (voterKarma / totalActiveKarma) * PRIZE_POOL;
        votingPower.set(voter, power);
    }

    // 5. Count upvotes cast by each user.
    const upvoteCounts = new Map();
    upvotesInPeriod.forEach(upvote => {
        const upvoter = upvote.upvoter.toLowerCase();
        upvoteCounts.set(upvoter, (upvoteCounts.get(upvoter) || 0) + 1);
    });

    // 6. Distribute voting power and calculate earnings.
    console.log('Distributing re-weighted voting power...');
    const finalEarnings = new Map();
    upvotesInPeriod.forEach(upvote => {
        const upvoter = upvote.upvoter.toLowerCase();
        const author = upvote.author.toLowerCase();

        const upvoterPower = votingPower.get(upvoter) || 0;
        const upvoterTotalUpvotes = upvoteCounts.get(upvoter) || 1;
        const valuePerUpvote = upvoterPower / upvoterTotalUpvotes;

        finalEarnings.set(author, (finalEarnings.get(author) || 0) + valuePerUpvote);
    });

    // 7. Filter out excluded recipients, sort, and prepare for display.
    const leaderboard = Array.from(finalEarnings.entries())
        .filter(([identity]) => !EXCLUDED_RECIPIENTS.includes(identity))
        .map(([identity, earnings]) => ({ identity, earnings }))
        .sort((a, b) => b.earnings - a.earnings);

    // 8. Display the final leaderboard with resolved names.
    console.log('\n--------------------------------------------------------------------------');
    console.log('Final Definitive Weighted Contest Leaderboard:');
    console.log('--------------------------------------------------------------------------');

    const leaderboardWithNames = await Promise.all(
        leaderboard.slice(0, 25).map(async (user, index) => {
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
            return {
                rank: index + 1,
                ...user,
                displayName,
            };
        })
    );

    console.log('Rank | Prize (USDC) | User');
    console.log('---- | ------------ | ------------------------------------------');
    leaderboardWithNames.forEach(user => {
        const display = user.displayName !== user.identity ? `${user.displayName} (${user.identity})` : user.identity;
        console.log(
            `${user.rank.toString().padEnd(4)} | ${user.earnings.toFixed(4).padEnd(12)} | ${display}`
        );
    });
    console.log('--------------------------------------------------------------------------');

    // 9. Verify the total prize pool distribution.
    const totalDistributed = leaderboard.reduce((sum, user) => sum + user.earnings, 0);
    console.log(`\nVerification: Total USDC Distributed = ${totalDistributed.toFixed(4)}`);
    console.log('--------------------------------------------------------------------------');
}

generateFinalLeaderboard().catch(console.error);
