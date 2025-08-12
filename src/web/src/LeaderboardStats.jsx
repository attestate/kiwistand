import React, { useEffect, useState } from 'react';
import { eligible } from '@attestate/delegator2';
import { getLocalAccount } from './session.mjs';

export default function LeaderboardStats({ allowlist, delegations, address }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      if (!address) {
        // Try to get from local account
        const localAccount = getLocalAccount(null, allowlist);
        if (!localAccount || !localAccount.identity) {
          setLoading(false);
          return;
        }
        address = localAccount.identity;
      }

      // Check if user is eligible
      const identity = eligible(allowlist, delegations, address);
      if (!identity) {
        setLoading(false);
        return;
      }

      try {
        // Fetch user stats from an API endpoint
        const response = await fetch(`/api/contest-stats?address=${identity}`);
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Error fetching leaderboard stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [address, allowlist, delegations]);

  useEffect(() => {
    if (!loading && stats) {
      // Update karma value
      const karmaEl = document.querySelector('.user-karma-value');
      if (karmaEl) {
        karmaEl.textContent = stats.karma || '0';
      }

      // Update voting power
      const votingPowerEl = document.querySelector('.user-voting-power');
      if (votingPowerEl) {
        if (stats.votingPower && stats.votingPower > 0) {
          votingPowerEl.innerHTML = `<span>${stats.votingPower.toFixed(2)}</span><img src="/usdc-logo.svg" style="width: 18px; height: 18px; margin-left: 4px;" alt="USDC" />`;
        } else {
          votingPowerEl.textContent = '0.00';
        }
      }

      // Update prize
      const prizeEl = document.querySelector('.user-prize-value');
      if (prizeEl) {
        if (stats.earnings && stats.earnings > 0) {
          prizeEl.innerHTML = `<span>${stats.earnings.toFixed(2)}</span><img src="/usdc-logo.svg" style="width: 18px; height: 18px; margin-left: 4px;" alt="USDC" />`;
        } else {
          prizeEl.textContent = 'N/A';
        }
      }

      // Update rank
      const rankEl = document.querySelector('.user-rank-value');
      if (rankEl) {
        rankEl.textContent = stats.rank ? `#${stats.rank}` : 'Unranked';
      }
    }
  }, [loading, stats]);

  return null; // This component doesn't render anything visible
}