
import Database from 'better-sqlite3';
import { join } from 'path';
import { fetchENSData } from './ens.mjs';
import 'dotenv/config';

// --- Contest Configuration ---
const CONTEST_START_DATE = new Date('2025-08-05T00:00:00Z');
const CONTEST_END_DATE = new Date('2025-08-12T23:59:59Z');
const PRIZE_POOL = 100; // 100 USDC
const EXCLUDED_RECIPIENTS = [
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

// --- Main Exported Function ---

export async function getContestLeaderboard(userIdentity = null) {
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
    
    // Get user's voter info if identity provided
    let userVoterInfo = null;
    if (userIdentity) {
        const userIdentityLower = userIdentity.toLowerCase();
        const userKarma = karmaSnapshot.get(userIdentityLower) || 0;
        // User only has voting power if they're an active voter (voted during the period)
        const userVotingPower = activeVoters.has(userIdentityLower) ? (votingPower.get(userIdentityLower) || 0) : 0;
        userVoterInfo = {
            karma: userKarma,
            votingPower: userVotingPower,
            isActiveVoter: activeVoters.has(userIdentityLower)
        };
    }

    // 3. Count upvotes cast by each user.
    const upvoteCounts = new Map();
    upvotesInPeriod.forEach(upvote => {
        const upvoter = upvote.upvoter.toLowerCase();
        upvoteCounts.set(upvoter, (upvoteCounts.get(upvoter) || 0) + 1);
    });

    // 4. Distribute voting power to calculate initial earnings for ALL authors and track story details.
    const initialEarnings = new Map();
    const storyEarnings = new Map(); // Track earnings per story
    const storyUpvoters = new Map(); // Track upvoters per story
    
    upvotesInPeriod.forEach(upvote => {
        const upvoter = upvote.upvoter.toLowerCase();
        const author = upvote.author.toLowerCase();
        const upvoterPower = votingPower.get(upvoter) || 0;
        const upvoterTotalUpvotes = upvoteCounts.get(upvoter) || 1;
        const valuePerUpvote = upvoterPower / upvoterTotalUpvotes;
        
        initialEarnings.set(author, (initialEarnings.get(author) || 0) + valuePerUpvote);
        
        // Track story-level data
        const storyKey = `${author}:${upvote.href}`;
        if (!storyEarnings.has(storyKey)) {
            // Extract index from id (format is "kiwi:0x...")
            const index = upvote.id ? upvote.id.replace('kiwi:', '') : '';
            storyEarnings.set(storyKey, {
                href: upvote.href,
                title: upvote.title,
                index: index,
                author: author,
                earnings: 0,
                upvoters: []
            });
        }
        const story = storyEarnings.get(storyKey);
        story.earnings += valuePerUpvote;
        story.upvoters.push({
            identity: upvoter,
            contribution: valuePerUpvote
        });
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
        .filter(user => user.earnings > 0.005) // Filter out users with less than 0.01 USDC (accounting for rounding)
        .sort((a, b) => b.earnings - a.earnings);

    // 7. Resolve names and add top stories for each user.
    const leaderboard = await Promise.all(
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
            
            // Get ALL stories for this user with scaled earnings
            const allUserStories = Array.from(storyEarnings.values())
                .filter(story => story.author === user.identity.toLowerCase())
                .map(story => ({
                    ...story,
                    earnings: story.earnings * scalingFactor,
                    upvoters: story.upvoters.map(u => ({
                        ...u,
                        contribution: u.contribution * scalingFactor
                    }))
                }))
                .filter(story => story.earnings > 0.005) // Filter out stories with less than 0.01 USDC
                .sort((a, b) => b.earnings - a.earnings);
            
            // Take top stories and calculate remainder
            const userStories = allUserStories.slice(0, 4); // Show top 4 stories
            const remainingStories = allUserStories.slice(4); // Rest of the stories
            const remainingEarnings = remainingStories.reduce((sum, story) => sum + story.earnings, 0);
            
            // Resolve ENS for upvoters
            for (const story of userStories) {
                // Filter out contributors with 0.00 USDC and sort by contribution (highest first) before slicing
                const significantUpvoters = story.upvoters
                    .filter(upvoter => upvoter.contribution > 0.005) // Filter out contributors with less than 0.01 USDC
                    .sort((a, b) => b.contribution - a.contribution);
                
                story.upvotersData = await Promise.all(
                    significantUpvoters.slice(0, 5).map(async (upvoter) => {
                        const upvoterEns = await fetchENSData(upvoter.identity).catch(() => null);
                        return {
                            identity: upvoter.identity,
                            contribution: upvoter.contribution,
                            ensData: upvoterEns
                        };
                    })
                );
                
                // Update the upvoters list to only include significant contributors
                story.upvoters = significantUpvoters;
            }
            
            return { 
                ...user, 
                displayName, 
                ensData, 
                topStories: userStories,
                remainingStoriesCount: remainingStories.length,
                remainingStoriesEarnings: remainingEarnings
            };
        })
    );
    
    return {
        leaderboard,
        userVoterInfo,
        contestDates: {
            start: CONTEST_START_DATE,
            end: CONTEST_END_DATE
        }
    };
}

export async function getTotalKarmaLeaderboard(userIdentity = null) {
    const TOP_USERS_COUNT = 50;
    const TOTAL_POOL = 100; // 100 USDC total voting power pool
    
    // Get all-time karma for all users
    const allUsers = getAllTimeKarma();
    
    // Get top 50 users
    const top50Users = allUsers.slice(0, TOP_USERS_COUNT);
    
    // Calculate total karma for top 50
    const totalTop50Karma = top50Users.reduce((sum, user) => sum + user.karma, 0);
    
    // Calculate USDC voting power for each top 50 user
    const leaderboardWithPower = await Promise.all(
        top50Users.map(async (user, index) => {
            const votingPower = totalTop50Karma > 0 
                ? (user.karma / totalTop50Karma) * TOTAL_POOL 
                : 0;
            
            // Fetch ENS data
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
                identity: user.identity,
                displayName,
                ensData,
                karma: user.karma,
                votingPower
            };
        })
    );
    
    // Find current user's data if they exist
    let currentUserData = null;
    if (userIdentity) {
        const userIdentityLower = userIdentity.toLowerCase();
        const userIndex = allUsers.findIndex(u => u.identity === userIdentityLower);
        
        if (userIndex !== -1) {
            const userData = allUsers[userIndex];
            const isInTop50 = userIndex < TOP_USERS_COUNT;
            const votingPower = isInTop50 && totalTop50Karma > 0
                ? (userData.karma / totalTop50Karma) * TOTAL_POOL
                : 0;
            
            // Fetch ENS data for current user
            const ensData = await fetchENSData(userData.identity).catch(() => null);
            let displayName = userData.identity;
            if (ensData && !ensData.error) {
                if (ensData.farcaster && ensData.farcaster.username) {
                    displayName = `@${ensData.farcaster.username}`;
                } else if (ensData.displayName && ensData.displayName.startsWith('@')) {
                    displayName = ensData.displayName;
                } else if (ensData.ens) {
                    displayName = ensData.ens;
                }
            }
            
            currentUserData = {
                rank: userIndex + 1,
                identity: userData.identity,
                displayName,
                ensData,
                karma: userData.karma,
                votingPower,
                isInTop50
            };
        }
    }
    
    return {
        leaderboard: leaderboardWithPower,
        currentUserData,
        totalUsers: allUsers.length,
        thresholdKarma: top50Users[top50Users.length - 1]?.karma || 0
    };
}
