import React, { useState, useEffect } from "react";
import {
  WagmiConfig,
  useContractWrite,
  usePrepareContractWrite,
  useWaitForTransaction,
  useAccount,
} from "wagmi";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import Drawer from "react-bottom-drawer";
import { optimism } from "wagmi/chains";

import { client, chains } from "./client.mjs";

const Tablet = (props) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Drawer
        className="drawer"
        isVisible={open}
        onClose={() => setOpen(false)}
      >
        <div style={{ padding: "10px 0" }}>
          <h1 style={{ color: "black", marginTop: 0, marginBottom: "0.75rem" }}>
            10 Reasons why ETH is going to the moon
          </h1>
          <div style={{ gap: "5px", display: "flex", alignItems: "center" }}>
            by
            <img
              src="vit.png"
              style={{
                borderRadius: "2px",
                border: "1px solid #ccc",
                width: "1rem",
              }}
            />
            vitalik.eth (vitalik.eth.limo)
          </div>
          <p>
            Can you believe this? Ethereum is going to the moon. Lorem Ipsum is
            simply dummy text of the printing and typesetting industry.
          </p>
          <p
            style={{
              maskImage:
                "linear-gradient(to bottom, black 50%, transparent 100%)",
            }}
          >
            Lorem Ipsum has been the industry's standard dummy text ever since
            the 1500s, when an unknown printer took a galley of type and
            scrambled it to make a type specimen book. It has survived not only
            five centuries,{" "}
          </p>
          <p style={{ backgroundColor: "rgba(0,0,0,0.1)", padding: "5px" }}>
            Preview, mint for 0.1 ETH to read the full article
          </p>
          <TxButton {...props} />
        </div>
      </Drawer>
      <button
        style={{
          height: "100%",
          border: "none",
          backgroundColor: "transparent",
          cursor: "pointer",
        }}
        onClick={() => setOpen(true)}
      >
        Preview
      </button>
    </>
  );
};

const lock = (
  <svg
    style={{ width: "1rem" }}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
  >
    <rect width="256" height="256" fill="none" />
    <rect
      x="40"
      y="88"
      width="176"
      height="128"
      rx="8"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
    />
    <circle cx="128" cy="152" r="12" />
    <path
      d="M88,88V56a40,40,0,0,1,80,0V88"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
    />
  </svg>
);

const address = "0x5eaB3204421a959EbA9aecCE69F51A1F5d6c2B8c";
const functionName = "mint";
const abi = [
  {
    type: "function",
    inputs: [
      { name: "aggregator", internalType: "address payable", type: "address" },
      { name: "account", internalType: "address", type: "address" },
      { name: "index", internalType: "uint256", type: "uint256" },
    ],
    name: "mint",
    outputs: [],
    stateMutability: "payable",
  },
];
const articlePrice = "1";
const articleId = "3";
const kiwiAddress = "0xee324c588ceF1BF1c1360883E4318834af66366d";

const TxButton = ({ href }) => {
  const minterAddress = useAccount();
  const [hash, setHash] = useState(null);

  const { write, isLoading, error, data } = useContractWrite({
    address,
    abi,
    functionName,
    args: [kiwiAddress, minterAddress.address, articleId],
    chainId: optimism.id,
    value: articlePrice,
  });
  if (data && data.hash && !error) {
    window.toast.success("Success! Redirecting to the article");
    window.location.href = `${href}?txId=${data.hash}`;
  }
  if (error) {
    console.log(error);
  }

  return (
    <button
      style={{
        backgroundColor: "black",
        padding: "10px 5px",
        color: "white",
        cursor: "pointer",
        width: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "5px",
      }}
      disabled={!write}
      onClick={() => write?.()}
    >
      {isLoading && "Confirm in your wallet"}
      {!hash && !isLoading && <>{lock} Mint to unlock</>}
    </button>
  );
};

const Wrapper = (props) => (
  <WagmiConfig config={client}>
    <RainbowKitProvider chains={chains}>
      <Tablet {...props} />
    </RainbowKitProvider>
  </WagmiConfig>
);

export default Wrapper;
