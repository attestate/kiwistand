// @format
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
export async function send(message, signature, wait = false) {
  const body = JSON.stringify({
    ...message,
    signature,
  });

  const url = getApiUrl(`/api/v1/messages?wait=${wait}`, API_PORT);

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
