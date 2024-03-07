import { encodeFunctionCall } from "eth-fun";
import { utils } from "ethers";
import htm from "htm";
import vhtml from "vhtml";

const html = htm.bind(vhtml);

const disperseContract = "0xd152f549545093347a162dce210e7293f1452150";
const disperseSelector = {
  constant: false,
  inputs: [
    { name: "recipients", type: "address[]" },
    { name: "values", type: "uint256[]" },
  ],
  name: "disperseEther",
  outputs: [],
  payable: true,
  stateMutability: "payable",
  type: "function",
};

const kiwiMultisig = "0x1337E2624ffEC537087c6774e9A18031CFEAf0a9";

export function tip(address) {
  const data = encodeFunctionCall(disperseSelector, [
    [address, kiwiMultisig],
    [utils.parseEther("0.0013"), utils.parseEther("0.0002")],
  ]);
  return {
    chainId: "eip155:8453",
    method: "eth_sendTransaction",
    params: {
      abi: [disperseSelector],
      to: disperseContract,
      data: data,
      value: utils.parseEther("0.0015").toString(),
    },
  };
}

export function callback(hash) {
  const ogImage = "https://news.kiwistand.com/txsuccess.jpeg";
  return html`
    <html>
      <head>
        <meta property="fc:frame" content="vNext" />
        <meta property="og:title" content="Writer's frame" />
        <meta property="og:image" content="${ogImage}" />
        <meta name="fc:frame:image" content="${ogImage}" />
        <meta property="fc:frame:button:1" content="See transaction" />
        <meta property="fc:frame:button:1:action" content="link" />
        <meta
          property="fc:frame:button:1:target"
          content="https://basescan.org/tx/${hash}"
        />
      </head>
      <body></body>
    </html>
  `;
}

export function profileHeader(name, address) {
  return html`
    <meta property="fc:frame" content="vNext" />
    <meta
      property="fc:frame:post_url"
      content="https://news.kiwistand.com/api/v1/writers/success"
    />
    <meta
      name="fc:frame:image"
      content="https://news.kiwistand.com/previews/${name}.jpg"
    />
    <meta property="fc:frame:button:1" content="Send 0.0015 ETH ($5) on Base" />
    <meta property="fc:frame:button:1:action" content="tx" />
    <meta
      property="fc:frame:button:1:target"
      content="https://news.kiwistand.com/api/v1/writers/${address}"
    />
  `;
}
