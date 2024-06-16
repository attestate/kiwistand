// @format
import { readContract } from "@wagmi/core";
import { optimism } from "wagmi/chains";

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
  const url = getApiUrl(`/api/v1/activity?address=${address}`);

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

  const lastUpdate = getCookie("lastUpdate");
  if (
    data &&
    data.data &&
    data.data.lastServerValue &&
    lastUpdate < parseInt(data.data.lastServerValue, 10)
  ) {
    setCookie("lastUpdate", parseInt(data.data.lastServerValue, 10));
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
    const prices = {
      min: saleDetails.publicSalePrice + 777000000000000n,
      current: BigInt(data.data.price),
    };
    if (prices.current <= prices.min) {
      prices.authoritative = prices.min;
    } else {
      prices.authoritative = prices.current;
    }
    return prices;
  } catch (err) {
    console.error(err);
    return null;
  }
}

export async function fetchStory(id) {
  let response;
  try {
    response = await fetch(`/api/v1/stories?index=${id}`);
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

export async function fetchDelegations() {
  const url = getApiUrl("/api/v1/delegations", API_PORT);

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

export async function fetchAllowList() {
  const url = getApiUrl("/api/v1/allowlist", API_PORT);

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
