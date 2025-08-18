
import Database from 'better-sqlite3';
import { join } from 'path';
import { fetchENSData } from './ens.mjs';
import 'dotenv/config';

// --- Contest Configuration ---
const CONTEST_START_DATE = new Date('2025-08-18T10:00:00Z'); // Aug 18 12pm noon CEST (UTC+2)
const CONTEST_END_DATE = new Date('2025-08-22T16:00:00Z'); // Aug 22 6pm CEST (UTC+2)
const PRIZE_POOL = 100; // 100 USDC
const EXCLUDED_RECIPIENTS = [
    '0xee324c588cef1bf1c1360883e4318834af66366d',
    '0x2cb8c01eabdff323c9f2600782132ace6ea37bc4'
];

// --- Database Setup ---
const dbPath = join(process.env.CACHE_DIR, "database.db");
const db = new Database(dbPath, { readonly: true });

// --- Memoization for expensive calculations ---
let memoizedContestData = null;
let memoizedContestDataTimestamp = null;

// --- Helper Functions ---

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
    return new Map(rows.map(row => [row.identity.toLowerCase(), row.total_karma]));
}

function getAllTimeKarma() {
    const query = `
        SELECT identity, SUM(points) as total_karma
        FROM (
            SELECT identity, 1 as points FROM submissions
            UNION ALL
            SELECT s.identity, 1 as points FROM upvotes u JOIN submissions s ON u.href = s.href
        )
        GROUP BY identity
        ORDER BY total_karma DESC
    `;
    const rows = db.prepare(query).all();
    return rows.map(row => ({
        identity: row.identity.toLowerCase(),
        karma: row.total_karma
    }));
}

function getUpvotesInPeriod(startDate, endDate) {
    const startTimestamp = Math.floor(startDate.getTime() / 1000);
    const endTimestamp = Math.floor(endDate.getTime() / 1000);
    const query = `
        SELECT u.identity as upvoter, s.identity as author, s.href, s.title, s.id
        FROM upvotes u
        JOIN submissions s ON u.href = s.href
        WHERE u.timestamp BETWEEN ? AND ?
    `;
    return db.prepare(query).all(startTimestamp, endTimestamp);
}

// --- Centralized Earnings Calculation ---

export async function calculateContestData() {
    // Return memoized data if it's recent (e.g., within 5 minutes)
    if (memoizedContestData && memoizedContestDataTimestamp && (new Date() - memoizedContestDataTimestamp < 5 * 60 * 1000)) {
        return memoizedContestData;
    }

    // 1. Initial Data Fetch
    const karmaSnapshot = getGlobalKarmaSnapshot(CONTEST_START_DATE);
    const upvotesInPeriod = getUpvotesInPeriod(CONTEST_START_DATE, CONTEST_END_DATE);
    const activeVoters = new Set(upvotesInPeriod.map(upvote => upvote.upvoter.toLowerCase()));

    // 2. Calculate Voting Power with a flatter distribution
    const scaledKarma = new Map();
    let totalActiveScaledKarma = 0;
    activeVoters.forEach(voter => {
        const karma = karmaSnapshot.get(voter) || 0;
        // Use a root to flatten the distribution curve
        const scaled = Math.pow(karma, 1/2.5);
        scaledKarma.set(voter, scaled);
        totalActiveScaledKarma += scaled;
    });

    const votingPower = new Map();
    if (totalActiveScaledKarma > 0) {
        activeVoters.forEach(voter => {
            const power = ((scaledKarma.get(voter) || 0) / totalActiveScaledKarma) * PRIZE_POOL;
            votingPower.set(voter, power);
        });
    }

    // 3. Calculate Initial (Unscaled) Contributions
    const upvoteCounts = new Map();
    upvotesInPeriod.forEach(upvote => {
        const upvoter = upvote.upvoter.toLowerCase();
        upvoteCounts.set(upvoter, (upvoteCounts.get(upvoter) || 0) + 1);
    });

    const initialStoryEarnings = new Map();
    upvotesInPeriod.forEach(upvote => {
        const upvoter = upvote.upvoter.toLowerCase();
        const author = upvote.author.toLowerCase();
        const valuePerUpvote = (votingPower.get(upvoter) || 0) / (upvoteCounts.get(upvoter) || 1);

        const storyKey = `${author}:${upvote.href}`;
        if (!initialStoryEarnings.has(storyKey)) {
            initialStoryEarnings.set(storyKey, {
                href: upvote.href, title: upvote.title, id: upvote.id, author, earnings: 0, upvoters: []
            });
        }
        const story = initialStoryEarnings.get(storyKey);
        story.earnings += valuePerUpvote;
        story.upvoters.push({ identity: upvoter, contribution: valuePerUpvote });
    });

    // 4. Calculate Scaling Factor
    const initialAuthorEarnings = new Map();
    initialStoryEarnings.forEach(story => {
        initialAuthorEarnings.set(story.author, (initialAuthorEarnings.get(story.author) || 0) + story.earnings);
    });

    let totalWinnerPool = 0;
    initialAuthorEarnings.forEach((earnings, identity) => {
        if (!EXCLUDED_RECIPIENTS.includes(identity)) {
            totalWinnerPool += earnings;
        }
    });
    const scalingFactor = totalWinnerPool > 0 ? PRIZE_POOL / totalWinnerPool : 1;

    // 5. Calculate Final Leaderboard with Scaled Earnings and Compression
    let finalLeaderboard = [];
    initialAuthorEarnings.forEach((earnings, identity) => {
        if (!EXCLUDED_RECIPIENTS.includes(identity)) {
            finalLeaderboard.push({ identity, earnings: earnings * scalingFactor });
        }
    });

    finalLeaderboard = finalLeaderboard
        .filter(user => user.earnings > 0.005)
        .sort((a, b) => b.earnings - a.earnings);

    if (finalLeaderboard.length > 0 && finalLeaderboard[0].earnings > 50) {
        const compressionFactor = 50 / finalLeaderboard[0].earnings;
        finalLeaderboard.forEach(user => { user.earnings *= compressionFactor; });
        const newTotal = finalLeaderboard.reduce((sum, u) => sum + u.earnings, 0);
        if (newTotal > 0) {
            const normalizationFactor = PRIZE_POOL / newTotal;
            finalLeaderboard.forEach(user => { user.earnings *= normalizationFactor; });
        }
    }
    
    // 6. Calculate Final Story Earnings (applying scaling and re-mapping from final user earnings)
    const finalUserEarningsMap = new Map(finalLeaderboard.map(u => [u.identity, u.earnings]));
    const finalStoryEarnings = new Map();
    initialStoryEarnings.forEach((story, key) => {
        const authorTotalInitial = initialAuthorEarnings.get(story.author) || 0;
        const authorTotalFinal = finalUserEarningsMap.get(story.author) || 0;
        
        if (authorTotalInitial > 0) {
            const storyRatio = story.earnings / authorTotalInitial;
            const finalStoryEarning = authorTotalFinal * storyRatio;
            
            finalStoryEarnings.set(key, {
                ...story,
                earnings: finalStoryEarning,
                upvoters: story.upvoters.map(u => ({
                    ...u,
                    contribution: (u.contribution / authorTotalInitial) * authorTotalFinal
                })).filter(u => u.contribution > 0.005)
            });
        }
    });

    memoizedContestData = { finalLeaderboard, finalStoryEarnings, karmaSnapshot, activeVoters, votingPower };
    memoizedContestDataTimestamp = new Date();
    
    return memoizedContestData;
}

// --- Main Exported Functions ---

export async function getContestLeaderboard(userIdentity = null) {
    const { finalLeaderboard, finalStoryEarnings, karmaSnapshot, activeVoters, votingPower } = await calculateContestData();

    const leaderboard = await Promise.all(
        finalLeaderboard.map(async (user) => {
            const ensData = await fetchENSData(user.identity).catch(() => null);
            const displayName = (ensData?.farcaster?.username ? `@${ensData.farcaster.username}` : (ensData?.displayName || ensData?.ens)) || user.identity;

            const allUserStories = Array.from(finalStoryEarnings.values())
                .filter(story => story.author === user.identity.toLowerCase())
                .sort((a, b) => b.earnings - a.earnings);

            const userStories = allUserStories.slice(0, 4);
            const remainingStories = allUserStories.slice(4);
            const remainingEarnings = remainingStories.reduce((sum, story) => sum + story.earnings, 0);

            for (const story of userStories) {
                story.upvoters.sort((a, b) => b.contribution - a.contribution);
                story.upvotersData = await Promise.all(
                    story.upvoters.slice(0, 5).map(async (upvoter) => ({
                        ...upvoter,
                        ensData: await fetchENSData(upvoter.identity).catch(() => null)
                    }))
                );
            }
            
            return { 
                ...user, displayName, ensData, 
                topStories: userStories,
                remainingStoriesCount: remainingStories.length,
                remainingStoriesEarnings: remainingEarnings
            };
        })
    );
    
    let userVoterInfo = null;
    if (userIdentity) {
        const lowerIdentity = userIdentity.toLowerCase();
        userVoterInfo = {
            karma: karmaSnapshot.get(lowerIdentity) || 0,
            votingPower: activeVoters.has(lowerIdentity) ? (votingPower.get(lowerIdentity) || 0) : 0,
            isActiveVoter: activeVoters.has(lowerIdentity)
        };
    }
    
    return {
        leaderboard, userVoterInfo,
        contestDates: { start: CONTEST_START_DATE, end: CONTEST_END_DATE }
    };
}

export async function getVoterLeaderboard(userIdentity = null) {
    const { finalStoryEarnings } = await calculateContestData();
    const allUsersKarma = new Map(getAllTimeKarma().map(u => [u.identity, u.karma]));

    const voterContributions = new Map();
    finalStoryEarnings.forEach(story => {
        story.upvoters.forEach(upvoter => {
            const current = voterContributions.get(upvoter.identity) || { total: 0, votes: [] };
            current.total += upvoter.contribution;
            current.votes.push({
                title: story.title,
                href: story.href,
                author: story.author,
                amount: upvoter.contribution
            });
            voterContributions.set(upvoter.identity, current);
        });
    });

    let voterLeaderboard = Array.from(voterContributions.entries())
        .map(([identity, data]) => ({
            identity,
            votingPower: data.total,
            votes: data.votes.sort((a, b) => b.amount - a.amount),
            karma: allUsersKarma.get(identity) || 0
        }))
        .filter(u => u.votingPower > 0.005)
        .sort((a, b) => b.votingPower - a.votingPower);

    const leaderboard = await Promise.all(
        voterLeaderboard.map(async (user, index) => {
            const ensData = await fetchENSData(user.identity).catch(() => null);
            const displayName = (ensData?.farcaster?.username ? `@${ensData.farcaster.username}` : (ensData?.displayName || ensData?.ens)) || user.identity;
            
            const votes = await Promise.all(user.votes.map(async vote => {
                const authorEns = await fetchENSData(vote.author).catch(() => null);
                const authorName = (authorEns?.farcaster?.username ? `@${authorEns.farcaster.username}` : (authorEns?.displayName || authorEns?.ens)) || vote.author;
                return { ...vote, author: authorName, date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
            }));

            return {
                rank: index + 1,
                ...user,
                displayName,
                ensData,
                votes
            };
        })
    );

    let currentUserData = null;
    if (userIdentity) {
        const lowerIdentity = userIdentity.toLowerCase();
        const userData = leaderboard.find(u => u.identity === lowerIdentity);
        if (userData) {
            currentUserData = { ...userData, isOnLeaderboard: true };
        } else {
            const karma = allUsersKarma.get(lowerIdentity) || 0;
            if (karma > 0) {
                 const ensData = await fetchENSData(lowerIdentity).catch(() => null);
                 const displayName = (ensData?.farcaster?.username ? `@${ensData.farcaster.username}` : (ensData?.displayName || ensData?.ens)) || lowerIdentity;
                 currentUserData = {
                    rank: 'N/A', identity: lowerIdentity, displayName, ensData,
                    karma, votingPower: 0, isOnLeaderboard: false, votes: []
                 }
            }
        }
    }
    
    return {
        leaderboard,
        currentUserData,
    };
}

export async function getStoriesUSDCEarnings() {
    const { finalStoryEarnings } = await calculateContestData();
    const earningsMap = new Map();
    
    finalStoryEarnings.forEach(story => {
        const index = story.id ? story.id.replace('kiwi:', '').replace('0x', '') : null;
        if (index && story.earnings > 0) {
            earningsMap.set(index, story.earnings);
        }
    });
    
    return earningsMap;
}
