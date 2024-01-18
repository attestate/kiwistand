import React, { useState, useEffect } from "react";
import { WagmiConfig, useAccount, useProvider } from "wagmi";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { ethers } from "ethers";

import { getLocalAccount } from "./session.mjs";
import { client, chains } from "./client.mjs";
import { fetchKarma } from "./API.mjs";

const Avatar = () => {
  let address;
  const account = useAccount();
  const localAccount = getLocalAccount(account.address);
  if (account.isConnected) {
    address = account.address;
  }
  if (localAccount) {
    address = localAccount.identity;
  }

  const [avatar, setAvatar] = useState("");
  const [points, setPoints] = useState(0);
  const provider = useProvider({ chainId: 1 });

  useEffect(() => {
    const getAvatar = async () => {
      if (address) {
        const name = await provider.lookupAddress(address);
        const ensResolver = await provider.getResolver(name);
        if (ensResolver) {
          const avatarUrl = await ensResolver.getAvatar();
          setAvatar(avatarUrl.url);
        }
      }
    };
    const getPoints = async () => {
      if (address) {
        const data = await fetchKarma(address);
        if (data && data.karma) {
          setPoints(data.karma);
        }
      }
    };
    getPoints();
    getAvatar();
  }, [address, account.isConnected, provider]);

  if (avatar && points) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div
          className="sidebar-toggle"
          style={{
            width: "33%",
            cursor: "pointer",
            alignItems: "center",
            justifyContent: "left",
            padding: "12px 0 7px 7px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <img
              src={avatar}
              style={{
                borderRadius: "100%",
                height: "18px",
                width: "18px",
                border: "1px solid black",
              }}
            />
            <span
              style={{
                fontWeight: "bold",
                fontSize: "8px",
                marginTop: "-2px",
                color: "black",
              }}
            >
              {points.toString()}
            </span>
          </div>
        </div>
      </div>
    );
  } else {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            cursor: "pointer",
            alignItems: "center",
            justifyContent: "left",
            padding: "7px 0 7px 7px",
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            style={{ paddingTop: "2px" }}
            viewBox="0 0 100 80"
            width="20"
            height="20"
          >
            <rect width="100" height="10"></rect>
            <rect y="30" width="100" height="10"></rect>
            <rect y="60" width="100" height="10"></rect>
          </svg>
          <span style={{ color: "black", marginLeft: "10px" }}>Menu</span>
        </div>
      </div>
    );
  }
};

const Form = (props) => {
  return (
    <WagmiConfig client={client}>
      <RainbowKitProvider chains={chains}>
        <Avatar />
      </RainbowKitProvider>
    </WagmiConfig>
  );
};

export default Form;
