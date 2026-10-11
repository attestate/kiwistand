// @format
// NOTE: The ETH/USD price for the website. The browser used to read
// Chainlink's feed from a public RPC itself; now the server reads it with its
// own RPC and every visitor gets the same cached answer, so no RPC provider
// sees who asked.
import { env } from "process";
import { Contract, providers } from "ethers";

export const ETH_USD_FEED = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419";
const ABI = [
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
];
export const DECIMALS = 8;
export const TTL_MS = 5 * 60 * 1000;

let feed;
async function readFeed() {
  if (!feed) {
    const provider = new providers.JsonRpcProvider(env.RPC_HTTP_HOST);
    feed = new Contract(ETH_USD_FEED, ABI, provider);
  }
  const { answer, updatedAt } = await feed.latestRoundData();
  return { answer: answer.toString(), updatedAt: updatedAt.toNumber() };
}

// read: () => Promise<{ answer: string, updatedAt: number }>
export function createPriceCache({ read = readFeed, now = Date.now, ttl = TTL_MS } = {}) {
  let cached;
  let pending;
  return async function ethUsd() {
    if (cached && now() - cached.fetchedAt < ttl) return cached.value;
    if (!pending) {
      pending = read()
        .then(({ answer, updatedAt }) => {
          if (!/^\d+$/.test(answer) || answer === "0") {
            throw new Error(`Unexpected ETH/USD answer: ${answer}`);
          }
          const value = { answer, decimals: DECIMALS, updatedAt };
          cached = { value, fetchedAt: now() };
          return value;
        })
        .catch((err) => {
          // A stale price beats none when the RPC hiccups.
          if (cached) return cached.value;
          throw err;
        })
        .finally(() => {
          pending = undefined;
        });
    }
    return pending;
  };
}

export const ethUsd = createPriceCache();
