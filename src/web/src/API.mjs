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

export function messageFab(title, href) {
  return {
    title,
    href,
    type: "amplify",
    timestamp: Math.floor(Date.now() / 1000),
  };
}

function getApiUrl(endpoint, port = window.location.port) {
  const hostname = window.location.hostname;
  return `${window.location.protocol}//${hostname}${
    port ? ":" + port : ""
  }${endpoint}`;
}

export async function send(message, signature) {
  const body = JSON.stringify({
    ...message,
    signature,
  });

  const url = getApiUrl("/api/v1/messages", 8000);

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
  const url = getApiUrl(`/activity?address=${address}`);

  const response = await fetch(url, {
    method: "GET",
    credentials: "omit",
  });

  const nextLastUpdate = response.headers.get("X-LAST-UPDATE");
  const lastUpdate = getCookie("lastUpdate");

  return lastUpdate !== nextLastUpdate;
}

export async function fetchDelegations() {
  const url = getApiUrl("/api/v1/delegations", 8000);

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
  const url = getApiUrl("/api/v1/allowlist", 8000);

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
