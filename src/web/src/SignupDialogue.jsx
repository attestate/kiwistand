import React from "react";

import { getAddress } from "@ethersproject/address";
import { useAccount } from "wagmi";
import { eligible } from "@attestate/delegator2";

import {
  ConnectedSimpleDisconnectButton,
  Connector,
  CustomConnectButton,
} from "./Navigation.jsx";
import {
  getLocalAccount,
  isSafariOnIOS,
  isChromeOnAndroid,
  isRunningPWA,
} from "./session.mjs";

const SignupDialogue = (props) => {
  const from = useAccount();
  let address;
  const localAccount = getLocalAccount(from.address, props.allowlist);
  if (from.isConnected) {
    address = from.address;
  }
  if (localAccount) {
    address = localAccount.identity;
  }
  const isEligible =
    address && eligible(props.allowlist, props.delegations, address);

  const isntReallySafari =
    !!navigator.brave ||
    navigator.userAgent.indexOf("CriOS") >= 0 ||
    navigator.userAgent.match(/CriOS/i) ||
    navigator.userAgent.match(/EdgiOS/i);

  const zeroAddress = "0x0000000000000000000000000000000000000000";
  let referral = zeroAddress;
  const queryReferral = new URLSearchParams(window.location.search).get(
    "referral",
  );

  let link;
  try {
    referral = getAddress(queryReferral);
    link = `/kiwipass-mint?referral=${referral}`;
  } catch (err) {
    link = "/kiwipass-mint";
    console.log("Couldn't find referral address in URL bar");
  }

  if (
    !isEligible &&
    (window.location.pathname === "/submit" ||
      window.location.pathname === "/stories" ||
      window.location.pathname === "/comments" ||
      window.location.pathname === "/community")
  ) {
    return (
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          height: "20vh",
          padding: "0.75rem 0",
          width: "100%",
          backgroundColor: "rgba(230,230,223, 0.95)",
          borderTop: "1px solid #828282",
          zIndex: 6,
          borderTop: "1px solid #828282",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
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
          {!from.isConnected ? (
            <CustomConnectButton
              allowlist={props.allowlist}
              className="button-secondary"
              style={{ width: "auto" }}
            />
          ) : (
            ""
          )}
          <a
            href={link}
            id="button-onboarding"
            style={{ width: "auto", fontWeight: 700 }}
          >
            Sign up
          </a>
        </div>
        <div
          style={{
            color: "black",
            marginTop: "1rem",
            textDecoration: "underline",
          }}
        >
          <ConnectedSimpleDisconnectButton />
        </div>
        <p style={{ color: "black" }}>Sign up to explore our content</p>
      </div>
    );
  }
};

const Form = (props) => {
  return (
    <Connector {...props}>
      <SignupDialogue {...props} />
    </Connector>
  );
};

export default Form;
