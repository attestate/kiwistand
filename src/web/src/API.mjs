// @format
import { readContract } from "@wagmi/core";
import { mainnet, optimism } from "wagmi/chains";

import { getCookie, setCookie } from "./session.mjs";

export const EIP712_DOMAIN = {
  name: "kiwinews",
  version: "1.0.0",
  salt: "0xfe7a9d68e99b6942bb3a36178b251da8bd061c20ed1e795207ae97183b590e5b",
};

export const EIP712_TYPES = {
  Message: [
    { name: "title", type: "string" },
    { name: "href", type: "string" },
    { name: "type", type: "string" },
    { name: "timestamp", type: "uint256" },
  ],
};

export function messageFab(title, href, type = "amplify") {
  return {
    title,
    href,
    type,
    timestamp: Math.floor(Date.now() / 1000),
  };
}

function getApiUrl(endpoint, port = window.location.port) {
  const hostname = window.location.hostname;
  return `${window.location.protocol}//${hostname}${
    port ? ":" + port : ""
  }${endpoint}`;
}

const API_PORT = 8443;
export async function send(
  message,
  signature,
  wait = false,
  endpoint = `/api/v1/messages?wait=${wait}`,
  port = API_PORT,
) {
  const body = JSON.stringify({
    ...message,
    signature,
  });

  const url = getApiUrl(endpoint, port);

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
    });
  } catch (err) {
    console.error(err);
  }

  let result;
  try {
    result = await response.json();
  } catch (err) {
    return {
      status: "error",
      code: "NA",
      message: "NA",
      details: "Couldn't parse response json",
    };
  }
  return result;
}

export async function fetchNotifications(address) {
  const lastUpdate = parseInt(getCookie("lastUpdate"), 10) || 0;
  const url = getApiUrl(
    `/api/v1/activity?address=${address}&lastUpdate=${lastUpdate}`,
  );

  const response = await fetch(url, {
    method: "GET",
  });

  let data;
  try {
    data = await response.json();
  } catch (err) {
    console.log(err);
    return [];
  }

  // Always set lastUpdate cookie on /activity page
  if (window.location.pathname === '/activity' && data?.data?.notifications?.length > 0) {
    const latestNotification = data.data.notifications[0];
    const timestamp = latestNotification.timestamp;
    console.log("Setting lastUpdate on activity page to:", timestamp);
    setCookie("lastUpdate", timestamp);
  } else if (
    (data?.data?.lastServerValue && lastUpdate <= parseInt(data.data.lastServerValue, 10)) ||
    (!lastUpdate && data?.data?.lastServerValue)
  ) {
    const value = parseInt(data.data.lastServerValue, 10);
    console.log("Setting lastUpdate in browser to:", value);
    setCookie("lastUpdate", value);
  }

  return data.data.notifications;
}

const address = "0x66747bdc903d17c586fa09ee5d6b54cc85bbea45";
const abi = [
  {
    inputs: [],
    name: "saleDetails",
    outputs: [
      {
        components: [
          { internalType: "bool", name: "publicSaleActive", type: "bool" },
          { internalType: "bool", name: "presaleActive", type: "bool" },
          { internalType: "uint256", name: "publicSalePrice", type: "uint256" },
          { internalType: "uint64", name: "publicSaleStart", type: "uint64" },
          { internalType: "uint64", name: "publicSaleEnd", type: "uint64" },
          { internalType: "uint64", name: "presaleStart", type: "uint64" },
          { internalType: "uint64", name: "presaleEnd", type: "uint64" },
          {
            internalType: "bytes32",
            name: "presaleMerkleRoot",
            type: "bytes32",
          },
          {
            internalType: "uint256",
            name: "maxSalePurchasePerAddress",
            type: "uint256",
          },
          { internalType: "uint256", name: "totalMinted", type: "uint256" },
          { internalType: "uint256", name: "maxSupply", type: "uint256" },
        ],
        internalType: "struct IERC721Drop.SaleDetails",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];

export async function fetchPrice() {
  const saleDetails = await readContract({
    address,
    abi,
    functionName: "saleDetails",
    chainId: optimism.id,
  });

  let response;
  try {
    response = await fetch(`/api/v1/price`);
    const data = await response.json();
    const current = BigInt(data.data.price);
    const prices = {
      min: saleDetails.publicSalePrice + 1n,
      minPlusFee: saleDetails.publicSalePrice + 777000000000000n,
      current,
    };
    if (prices.current <= prices.min) {
      prices.authoritative = prices.min;
      prices.difference = 0n;
      prices.referralPrice = prices.min;
    } else {
      prices.authoritative = prices.current;
      prices.difference = prices.current - prices.min;
      prices.referralPrice = prices.authoritative - prices.difference / 2n;
    }
    return prices;
  } catch (err) {
    console.error(err);
    return null;
  }
}

export async function fetchLeaderboard() {
  let response;
  try {
    response = await fetch(`/api/v1/leaderboard`);
    const data = await response.json();
    return data.data;
  } catch (err) {
    console.error(err);
    return null;
  }
}

export async function requestFaucet(address) {
  try {
    const response = await fetch('/api/v1/faucet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ address }),
    });
    
    return await response.json();
  } catch (error) {
    console.error('Error requesting from faucet:', error);
    return { status: 'error', message: error.message };
  }
}

export async function fetchStory(id, commentCount) {
  let response;

  let url = `/api/v1/stories?index=${id}`;
  // NOTE: As the comment count will increase and since the server-rendered
  // page can sometimes be ahead of the API's cache, the comment count may bust
  // the cache in some cases and force a reload.
  if (commentCount) {
    url += `&commentCount=${commentCount}`;
  }
  try {
    response = await fetch(url);
    const data = await response.json();
    return data.data;
  } catch (err) {
    console.error(err);
    return null;
  }
}

export async function fetchKarma(identity) {
  let response;
  try {
    response = await fetch(`/api/v1/karma/${identity}`);
    const data = await response.json();
    return data.data;
  } catch (err) {
    console.error(err);
    return null;
  }
}

export async function fetchDelegations(cached = false) {
  const url = new URL(getApiUrl("/api/v1/delegations", API_PORT));
  if (cached) url.searchParams.set("cached", "true");

  let response;
  try {
    response = await fetch(url);
    const data = await response.json();
    return data.data;
  } catch (err) {
    console.error(err);
    return null;
  }
}

export async function fetchAllowList(cached = false) {
  const url = new URL(getApiUrl("/api/v1/allowlist", API_PORT));
  if (cached) url.searchParams.set("cached", "true");

  let response;
  try {
    response = await fetch(url);
    const data = await response.json();
    return data.data;
  } catch (err) {
    console.error(err);
    return null;
  }
}

function checkMintStatus() {
  // Get the current URL
  const url = new URL(window.location.href);

  // Check if we're on the '/indexing' page
  if (url.pathname === "/indexing") {
    // Get the 'address' parameter from the URL
    const address = url.searchParams.get("address");

    // Start the interval to check the allow list and delegations
    const intervalId = setInterval(async () => {
      const allowList = await fetchAllowlist();
      const delegations = await fetchDelegations();

      if (
        allowList.includes(address) ||
        Object.values(delegations).includes(address)
      ) {
        console.log("Mint has been picked up by the node.");
        clearInterval(intervalId);
        // Redirect to the '/demonstration' page
        window.location.href = "/demonstration";
      } else {
        console.log("Waiting for mint to be picked up...");
      }
    }, 5000); // Check every 5 seconds
  }
}

const ETH_USD_PRICE_FEED_ADDRESS = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419";

const PRICE_FEED_ABI = [
  {
    name: "latestRoundData",
    outputs: [
      { type: "uint80", name: "roundId" },
      { type: "int256", name: "answer" },
      { type: "uint256", name: "startedAt" },
      { type: "uint256", name: "updatedAt" },
      { type: "uint80", name: "answeredInRound" },
    ],
    inputs: [],
    stateMutability: "view",
    type: "function",
  },
];

export async function fetchEthUsdPrice() {
  try {
    const priceData = await readContract({
      address: ETH_USD_PRICE_FEED_ADDRESS,
      abi: PRICE_FEED_ABI,
      functionName: "latestRoundData",
      chainId: mainnet.id,
    });
    const [_, answer] = priceData;
    return answer;
  } catch (err) {
    console.error(err);
    return null;
  }
}
