
import { getKarmaRankingByDate } from '../src/cache.mjs';
// We need to use a different function to get the Farcaster data.
// Let's look inside ens.mjs again to find the right function.
// After inspection, `fetchNeynarData` is the correct function.
import { fetchNeynarData } from '../src/ens.mjs';
import 'dotenv/config';

async function generateContestLeaderboard() {
  console.log('Generating final contest leaderboard with Farcaster names...');

  const startDate = new Date('2024-06-27T00:00:00Z');
  const endDate = new Date('2024-07-07T23:59:59Z');
  const prizePool = 100; // 100 USDC
  const minKarma = 5; // Minimum karma to be eligible for a prize
  const excludedAddresses = [
    '0xee324c588cef1bf1c1360883e4318834af66366d'
  ];

  console.log(`Contest period: ${startDate.toDateString()} to ${endDate.toDateString()}`);

  const leaderboard = getKarmaRankingByDate(startDate, endDate);

  const eligibleUsers = leaderboard
    .filter(user => user.karma >= minKarma)
    .filter(user => !excludedAddresses.includes(user.identity.toLowerCase()));

  if (eligibleUsers.length === 0) {
    console.log('No eligible users found for the contest period.');
    return;
  }

  const totalKarma = eligibleUsers.reduce((sum, user) => sum + user.karma, 0);

  console.log(`
Total karma from eligible users: ${totalKarma}`);
  console.log(`Prize pool: ${prizePool} USDC`);
  console.log('--------------------------------------------------------------------------');
  console.log('Final Contest Leaderboard (with Farcaster Names):');
  console.log('--------------------------------------------------------------------------');

  const leaderboardWithPrizes = await Promise.all(
    eligibleUsers.map(async (user, index) => {
      const prize = (user.karma / totalKarma) * prizePool;
      const neynarData = await fetchNeynarData(user.identity).catch(() => null);
      
      let displayName = user.identity;
      if (neynarData && neynarData.farcaster && neynarData.farcaster.username) {
        displayName = `@${neynarData.farcaster.username}`;
      }

      return {
        rank: index + 1,
        identity: user.identity,
        displayName: displayName,
        karma: user.karma,
        prize: prize.toFixed(4),
      };
    })
  );
  
  // Sort by rank as promises may resolve out of order
  leaderboardWithPrizes.sort((a, b) => a.rank - b.rank);

  console.log('Rank | Karma | Prize (USDC) | User');
  console.log('---- | ----- | ------------ | ------------------------------------------');
  leaderboardWithPrizes.forEach(user => {
    const display = user.displayName !== user.identity ? `${user.displayName} (${user.identity})` : user.identity;
    console.log(
      `${user.rank.toString().padEnd(4)} | ${user.karma.toString().padEnd(5)} | ${user.prize.toString().padEnd(12)} | ${display}`
    );
  });

  console.log('--------------------------------------------------------------------------');
}

generateContestLeaderboard().catch(console.error);
