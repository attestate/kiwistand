import React from "react";

import { WagmiConfig, useAccount } from "wagmi";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";

import { getLocalAccount } from "./session.mjs";
import { CustomConnectButton } from "./Navigation.jsx";
import { client, chains } from "./client.mjs";

const SignupDialogue = () => {
  const from = useAccount();
  let address;
  const localAccount = getLocalAccount(from.address);
  if (from.isConnected) {
    address = from.address;
  }
  if (localAccount) {
    address = localAccount.identity;
  }

  if (
    !address &&
    (window.location.pathname !== "/" ||
      window.location.pathname !== "/new" ||
      window.location.pathname !== "/top" ||
      window.location.pathname !== "/stories" ||
      window.location.pathname !== "/comments")
  ) {
    return (
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          height: "90px",
          padding: "0.75rem 0",
          width: "100%",
          backgroundColor: "#e6e6df",
          borderTop: "1px solid #828282",
          zIndex: 99,
          borderTop: "1px solid #828282",
        }}
      >
        <h3
          style={{
            color: "black",
            margin: 0,
          }}
        >
          Welcome to Kiwi News!
        </h3>
        <hr
          style={{
            margin: "0.4rem 0 1rem 0",
            width: "20rem",
            borderTop: "2px solid rgba(0,0,0,0.75)",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "2rem",
            justifyContent: "center",
          }}
        >
          <CustomConnectButton
            className="button-secondary"
            style={{ width: "auto" }}
          />
          <a
            href="/kiwipass-mint"
            id="button-onboarding"
            style={{ width: "auto", fontWeight: 700 }}
          >
            Sign up
          </a>
        </div>
      </div>
    );
  }
};

const Form = (props) => {
  return (
    <WagmiConfig config={client}>
      <RainbowKitProvider chains={chains}>
        <SignupDialogue />
      </RainbowKitProvider>
    </WagmiConfig>
  );
};

export default Form;
