import { getKarmaRankingByDate } from './cache.mjs';
import * as ens from './ens.mjs';
import * as moderation from './views/moderation.mjs';
import { startOfWeek, endOfWeek, addHours } from 'date-fns';

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



export function getTimeRemainingInRound() {
  const { endDate } = getCurrentRoundDates();
  const now = new Date();
  const remaining = endDate.getTime() - now.getTime();
  return remaining > 0 ? remaining : 0;
}

function getCurrentRoundDates() {
  const now = new Date();
  
  // Get UTC offset for CET/CEST
  const cetOffset = getCETOffset(now);
  
  // Adjust current time to CET/CEST
  const nowInCET = addHours(now, cetOffset);
  
  // Get start of week (Monday) in CET
  const startDate = startOfWeek(nowInCET, { weekStartsOn: 1 });
  
  // Get end of week (Sunday) in CET  
  const endDate = endOfWeek(nowInCET, { weekStartsOn: 1 });
  
  // Adjust back to server timezone by subtracting the offset
  const startDateLocal = addHours(startDate, -cetOffset);
  const endDateLocal = addHours(endDate, -cetOffset);
  
  return { startDate: startDateLocal, endDate: endDateLocal };
}

function getCETOffset(date) {
  // Get UTC offset in hours
  const utcOffset = -date.getTimezoneOffset() / 60;
  
  // CET = UTC+1, CEST = UTC+2
  // Determine if we're in DST (last Sunday of March to last Sunday of October)
  const year = date.getFullYear();
  const lastSundayMarch = new Date(year, 2, 31);
  lastSundayMarch.setDate(31 - lastSundayMarch.getDay());
  
  const lastSundayOctober = new Date(year, 9, 31);
  lastSundayOctober.setDate(31 - lastSundayOctober.getDay());
  
  const isCEST = date >= lastSundayMarch && date < lastSundayOctober;
  const cetOffset = isCEST ? 2 : 1;
  
  // Return the difference between CET and current timezone
  return cetOffset - utcOffset;
}
