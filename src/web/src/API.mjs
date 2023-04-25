// @format
export {
  EIP712_MESSAGE,
  EIP721_DELEGATION,
  EIP712_DOMAIN,
} from "../../constants.mjs";

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
    await fetch("/messages", {
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
