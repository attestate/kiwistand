// @format
import { Wallet, utils } from "./ethers-5.2.esm.min.js";
import { posts } from "./posts.mjs";

const button = document.getElementById("myButton");
button.addEventListener("click", send);

async function send() {
  const EIP712_DOMAIN = {
    name: "replica",
    version: "1",
    chainId: 6666,
  };

  const EIP712_TYPES = {
    Message: [
      { name: "title", type: "string" },
      { name: "href", type: "string" },
      { name: "type", type: "string" },
      { name: "timestamp", type: "uint256" },
    ],
  };

  const address = "0x0f6A79A579658E401E0B81c6dde1F2cd51d97176";
  const privateKey =
    "0xad54bdeade5537fb0a553190159783e45d02d316a992db05cbed606d3ca36b39";
  const signer = new Wallet(privateKey);

  const minimum = 0;
  const maximum = posts.length - 1;
  var randomnumber =
    Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
  const message = posts[randomnumber];
  message.timestamp = Math.floor(Date.now() / 1000);

  const signature = await signer._signTypedData(
    EIP712_DOMAIN,
    EIP712_TYPES,
    message
  );
  const body = JSON.stringify({
    ...message,
    signature,
  });

  await fetch("/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
  }).catch((error) => console.error(error));
  location.reload();
}
