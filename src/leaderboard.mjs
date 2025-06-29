import { getKarmaRankingByDate } from './cache.mjs';
import * as ens from './ens.mjs';
import * as moderation from './views/moderation.mjs';

const ROUND_DURATION_WEEKS = 1;

export async function getLeaderboard() {
  const { startDate, endDate } = getCurrentRoundDates();
  const leaderboard = getKarmaRankingByDate(startDate, endDate);
  
  // Get banned profiles from moderation system
  let bannedAddresses = [];
  try {
    const policy = await moderation.getLists();
    bannedAddresses = policy.profiles || [];
  } catch (err) {
    // If moderation fails, continue with empty banlist
    console.error('Failed to get banned profiles:', err);
  }
  
  // Filter out banned addresses and specific addresses that don't want to participate
  const filteredLeaderboard = leaderboard.filter(user => 
    user.identity.toLowerCase() !== '0x2cb8c01eabdff323c9f2600782132ace6ea37bc4' &&
    user.identity.toLowerCase() !== '0xee324c588cef1bf1c1360883e4318834af66366d' &&
    !bannedAddresses.includes(user.identity.toLowerCase())
  );
  
  // Resolve ENS data for each user
  const resolvedUsers = await Promise.allSettled(
    filteredLeaderboard.map(async (user) => {
      try {
        const ensData = await ens.resolve(user.identity);
        return {
          ...user,
          displayName: ensData.displayName || user.identity,
          ensData
        };
      } catch (err) {
        return {
          ...user,
          displayName: user.identity,
          ensData: null
        };
      }
    })
  );

  return resolvedUsers
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);
}

export async function getCurrentUserRank(identity) {
  const leaderboard = await getLeaderboard();
  const rank = leaderboard.findIndex((user) => user.identity === identity);
  return rank !== -1 ? rank + 1 : null;
}

export function getTimeRemainingInRound() {
  const { endDate } = getCurrentRoundDates();
  const now = new Date();
  const remaining = endDate.getTime() - now.getTime();
  return remaining > 0 ? remaining : 0;
}

function getCurrentRoundDates() {
  // Fixed competition period: From today (June 27, 2025) to July 7, 2025
  const startDate = new Date('2025-06-27');
  startDate.setHours(0, 0, 0, 0);
  
  const endDate = new Date('2025-07-07');
  endDate.setHours(23, 59, 59, 999);

  return { startDate, endDate };
}
