// @format

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

export async function send(message, signature) {
  const body = JSON.stringify({
    ...message,
    signature,
  });

  try {
    await fetch("/api/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
    });
  } catch (err) {
    console.error(error);
  }
}
