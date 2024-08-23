import { encodeFunctionCall } from "eth-fun";
import { utils } from "ethers";
import htm from "htm";
import vhtml from "vhtml";

import { getLeaders } from "./cache.mjs";
import * as price from "./price.mjs";
import * as registry from "./chainstate/registry.mjs";

const html = htm.bind(vhtml);

const contract = "0xE63496a8a9e6bD3aD9270236a890d78239441cF6";
const selector = {
  inputs: [
    { internalType: "bytes32[3]", name: "data", type: "bytes32[3]" },
    { internalType: "address[]", name: "beneficiaries", type: "address[]" },
    { internalType: "uint256[]", name: "amounts", type: "uint256[]" },
  ],
  name: "setup",
  outputs: [],
  stateMutability: "payable",
  type: "function",
};

const emptyDelegation = [
  "0x0000000000000000000000000000000000000000000000000000000000000000",
  "0x0000000000000000000000000000000000000000000000000000000000000000",
  "0x0000000000000000000000000000000000000000000000000000000000000000",
];

function computeDistribution(referral, difference) {
  const leaders = getLeaders();

  let allKarma = leaders.reduce((sum, { totalKarma }) => sum + totalKarma, 0);
  if (referral) {
    const last = leaders.pop();
    allKarma -= last.totalKarma;

    // NOTE: We have to give the referrer all the karma earned from everyone
    // else as this gives them half of the protocol reward.
    // Previuously, we gave the referrer half of all karma, but this lead to
    // the referrer only getting a quarter.
    leaders.push({ identity: referral, totalKarma: allKarma });
    allKarma *= 2;
  }

  const recipients = [];
  const values = [];
  if (difference !== 0n) {
    const allKarmaBigInt = BigInt(allKarma);
    let remainder = difference;

    for (const { identity, totalKarma } of leaders) {
      const share = (difference * BigInt(totalKarma)) / allKarmaBigInt;
      recipients.push(identity);
      values.push(share);
      remainder -= share;
    }

    for (let i = 0; i < remainder; i++) {
      values[i] += 1n;
    }
  }

  return {
    beneficiaries: recipients,
    amounts: values,
  };
}

export async function buy(referral) {
  const mints = await registry.mints();
  let current = await price.getPrice(mints);
  current = current.price.toBigInt();
  let min = await price.getOnchainPrice();
  min = min.toBigInt();

  let authoritative, difference;
  if (current <= min) {
    authoritative = min;
    difference = 0n;
  } else {
    authoritative = current;
    difference = current - min;
  }

  const { beneficiaries, amounts } = computeDistribution(referral, difference);
  const data = encodeFunctionCall(selector, [
    emptyDelegation,
    beneficiaries,
    amounts,
  ]);
  return {
    chainId: "eip155:10",
    method: "eth_sendTransaction",
    params: {
      abi: [selector],
      to: contract,
      data: data,
      value: authoritative.toString(),
    },
  };
}

export function callback(hash) {
  const ogImage = "https://news.kiwistand.com/start_preview.jpeg";
  return html`
    <html>
      <head>
        <meta property="fc:frame" content="vNext" />
        <meta name="fc:frame:image:aspect_ratio" content="1.91:1" />
        <meta property="og:title" content="Kiwi Pass Mint Frame" />
        <meta property="og:image" content="${ogImage}" />
        <meta name="fc:frame:image" content="${ogImage}" />
        <meta property="fc:frame:button:1" content="Continue" />
        <meta property="fc:frame:button:1:action" content="link" />
        <meta
          property="fc:frame:button:1:target"
          content="https://news.kiwistand.com/start"
        />
      </head>
      <body></body>
    </html>
  `;
}

export function header(referral, link, image) {
  return html`
    <meta property="fc:frame" content="vNext" />
    <meta
      property="fc:frame:post_url"
      content="https://news.kiwistand.com/api/v1/mint/success"
    />
    <meta
      name="fc:frame:image"
      content="${link && image
        ? image
        : "https://news.kiwistand.com/kiwipass_page.png"}"
    />
    <meta name="fc:frame:image:aspect_ratio" content="1.91:1" />
    ${link
      ? html`
          <meta property="fc:frame:button:1" content="Open" />
          <meta property="fc:frame:button:1:action" content="link" />
          <meta property="fc:frame:button:1:target" content="${link}" />
          <meta property="fc:frame:button:2" content="Sign up" />
          <meta property="fc:frame:button:2:action" content="tx" />
          <meta
            property="fc:frame:button:2:target"
            content="https://news.kiwistand.com/api/v1/mint/${referral
              ? referral
              : ""}"
          />
        `
      : html`
          <meta property="fc:frame:button:1" content="Buy on OP Mainnet" />
          <meta property="fc:frame:button:1:action" content="tx" />
          <meta
            property="fc:frame:button:1:target"
            content="https://news.kiwistand.com/api/v1/mint/${referral
              ? referral
              : ""}"
          />
        `}
  `;
}
