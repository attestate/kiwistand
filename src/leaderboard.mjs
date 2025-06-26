import { getKarmaRankingByDate } from './cache.mjs';
import * as ens from './ens.mjs';

const ROUND_DURATION_WEEKS = 1;

export async function getLeaderboard() {
  const { startDate, endDate } = getCurrentRoundDates();
  const leaderboard = getKarmaRankingByDate(startDate, endDate);
  
  // Filter out specific addresses
  const filteredLeaderboard = leaderboard.filter(user => 
    user.identity.toLowerCase() !== '0x2cb8c01eabdff323c9f2600782132ace6ea37bc4' &&
    user.identity.toLowerCase() !== '0xee324c588cef1bf1c1360883e4318834af66366d'
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
  const now = new Date();
  const weekStartsOn = 1; // Monday
  const dayOfWeek = now.getDay();
  const daysSinceStart = (dayOfWeek - weekStartsOn + 7) % 7;
  
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - daysSinceStart);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + (ROUND_DURATION_WEEKS * 7));

  return { startDate, endDate };
}
