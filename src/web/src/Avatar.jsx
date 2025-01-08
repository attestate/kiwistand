import React, { useState, useEffect } from "react";
import { WagmiConfig, useAccount } from "wagmi";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { eligible } from "@attestate/delegator2";

import { getLocalAccount } from "./session.mjs";
import { client, chains, getProvider } from "./client.mjs";
import { fetchKarma } from "./API.mjs";

export const resolveAvatar = async (address) => {
  if (!address) return;

  const provider = getProvider({ chainId: 1 });
  const name = await provider.lookupAddress(address);
  if (!name) return;

  const ensResolver = await provider.getResolver(name);
  if (!ensResolver) return;

  return (await ensResolver.getAvatar())?.url;
};

const Avatar = (props) => {
  let address;
  const account = useAccount();
  const localAccount = getLocalAccount(account.address, props.allowlist);
  if (account.isConnected) {
    address = account.address;
  }
  if (localAccount) {
    address = localAccount.identity;
  }

  const [avatar, setAvatar] = useState("");
  const [points, setPoints] = useState(0);

  useEffect(() => {
    const getAvatar = async () => {
      const avatarUrl = await resolveAvatar(address);
      setAvatar(avatarUrl);
    };
    const getPoints = async () => {
      if (!address) return;

      const data = await fetchKarma(address);
      if (data && data.karma) {
        setPoints(data.karma);
      }
    };

    getPoints();
    getAvatar();
  }, [address, account.isConnected]);

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
              position: "relative",
            }}
          >
            <img
              src={avatar}
              style={{
                borderRadius: "2px",
                height: "18px",
                width: "18px",
                border: "1px solid #828282",
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
          padding: "0 13px 0 7px",
          background: "rgba(0, 0, 0, 0.05)",
          borderRadius: "2px",
        }}
      >
        <div
          style={{
            display: "flex",
            cursor: "pointer",
            alignItems: "center",
            justifyContent: "left",
            padding: "7px 0 7px 7px",
            position: "relative",
            userSelect: "none",
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            style={{ userSelect: "none", paddingTop: "2px" }}
            viewBox="0 0 100 80"
            width="20"
            height="20"
          >
            <rect width="100" height="10"></rect>
            <rect y="30" width="100" height="10"></rect>
            <rect y="60" width="100" height="10"></rect>
          </svg>
          <span
            style={{ userSelect: "none", color: "black", marginLeft: "10px" }}
          >
            Menu
          </span>
        </div>
      </div>
    );
  }
};

const Form = (props) => {
  return (
    <WagmiConfig config={client}>
      <RainbowKitProvider chains={chains}>
        <Avatar {...props} />
      </RainbowKitProvider>
    </WagmiConfig>
  );
};

export default Form;
