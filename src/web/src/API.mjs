// @format
import { readContract } from "@wagmi/core";
import { mainnet, optimism } from "wagmi/chains";
import { client } from "./client.mjs";
import { keccak256 } from "ethereum-cryptography/keccak.js";
import { toHex } from "ethereum-cryptography/utils.js";
import { encode } from "cbor-x";
import canonicalize from "canonicalize";

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

export function toDigest(value) {
  const copy = canonicalize({ ...value });
  const canonical = encode(copy);
  const digest = toHex(keccak256(canonical));
  const index = `${value.timestamp.toString(16)}${digest}`;
  return {
    digest,
    canonical,
    index,
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
      // NOTE: In case the user navigates away before their message was
      // received at the server, the keepalive parameter makes sure that the
      // message is delivered.
      keepalive: true,
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

export async function fetchStoryAnalytics(href, signer) {
  // Create analytics message using same format as other messages
  const message = messageFab("analytics", href, "analytics");

  // Sign the message - handle both ethers Wallet and wagmi wallet client
  let signature;
  if (signer._signTypedData) {
    // Ethers Wallet (local account)
    signature = await signer._signTypedData(
      EIP712_DOMAIN,
      EIP712_TYPES,
      message
    );
  } else if (signer.signTypedData) {
    // Wagmi wallet client
    signature = await signer.signTypedData({
      domain: EIP712_DOMAIN,
      types: EIP712_TYPES,
      primaryType: "Message",
      message,
    });
  } else {
    console.error("Signer doesn't support typed data signing");
    return null;
  }

  const body = JSON.stringify({
    ...message,
    signature,
  });
  
  const url = getApiUrl("/api/v1/story-analytics");
  
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
    console.error("Failed to fetch analytics:", err);
    return null;
  }
  
  let result;
  try {
    result = await response.json();
  } catch (err) {
    console.error("Failed to parse analytics response:", err);
    return null;
  }
  
  if (result.status === "success" && result.data) {
    return result.data;
  }
  
  return null;
}

export async function fetchNotifications(address) {
  const lastUpdate = parseInt(getCookie("lastUpdate"), 10) || 0;
  const url = getApiUrl(`/api/v1/activity?address=${address}`);

  const response = await fetch(url, {
    method: "GET",
    keepalive: true,
  });

  let data;
  try {
    data = await response.json();
  } catch (err) {
    console.log(err);
    return [];
  }

  // Always set lastUpdate cookie on /activity page
  if (
    window.location.pathname === "/activity" &&
    data?.data?.notifications?.length > 0
  ) {
    const latestNotification = data.data.notifications[0];
    const timestamp = latestNotification.timestamp;
    console.log("Setting lastUpdate on activity page to:", timestamp);
    setCookie("lastUpdate", timestamp);
    
    // Use sendBeacon to ensure the notification fetch completes even if user navigates away
    try {
      navigator.sendBeacon && navigator.sendBeacon('/api/v1/activity?address=' + encodeURIComponent(address) + '&lastUpdate=' + timestamp);
    } catch (err) {
      console.log("Failed to send activity beacon:", err);
    }
  } else if (
    (data?.data?.lastServerValue &&
      lastUpdate <= parseInt(data.data.lastServerValue, 10)) ||
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
  let response;
  const publicSalePrice = BigInt("3000000000000");
  try {
    const current = BigInt("3000000000000");
    const prices = {
      min: publicSalePrice + 1n,
      minPlusFee: publicSalePrice + 777000000000000n,
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


export async function requestFaucet(address) {
  try {
    const response = await fetch("/api/v1/faucet", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ address }),
    });

    return await response.json();
  } catch (error) {
    console.error("Error requesting from faucet:", error);
    return { status: "error", message: error.message };
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
    // Return delegations object or empty object if null/undefined
    return data?.data || {};
  } catch (err) {
    console.error(err);
    return {};
  }
}

export async function fetchAllowList(cached = false) {
  const url = new URL(getApiUrl("/api/v1/allowlist", API_PORT));
  if (cached) url.searchParams.set("cached", "true");

  let response;
  try {
    response = await fetch(url);
    const data = await response.json();
    // Ensure data.data is an array before creating a Set
    if (Array.isArray(data?.data)) {
      return new Set(data.data);
    }
    return new Set();
  } catch (err) {
    console.error(err);
    return new Set();
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
      const allowList = await fetchAllowList();
      const delegations = await fetchDelegations();

      if (
        allowList.has(address) ||
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
    const priceData = await readContract(client, {
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

export async function sendMiniAppUpvote(value, fid, walletAddress, authToken) {
  // authToken is now REQUIRED
  if (!authToken) {
    throw new Error("Authentication token required");
  }

  const body = {
    ...value,
    walletAddress: walletAddress
  };

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${authToken}`
  };

  const response = await fetch("/api/v1/miniapp-upvote", {
    method: "POST",
    headers: headers,
    body: JSON.stringify(body),
  });

  return await response.json();
}
