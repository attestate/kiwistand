import { useState, useEffect } from "react";

import { useAccount } from "wagmi";
import { eligible } from "@attestate/delegator2";

import { Connector } from "./Navigation.jsx";
import { getLocalAccount } from "./session.mjs";

const Link = (props) => {
  const { allowlist, delegations } = props;
  const from = useAccount();
  let address;
  const localAccount = getLocalAccount(from.address);
  if (from.isConnected) {
    address = from.address;
  }
  if (localAccount) {
    address = localAccount.identity;
  }
  const isEligible =
    address && eligible(props.allowlist, props.delegations, address);
  if (isEligible) {
    return (
      <a
        href={props.href}
        target={props.target}
        style={{
          lineHeight: "13pt",
          fontSize: "13pt",
        }}
        className={props.className}
      >
        {props.children || props.title}
      </a>
    );
  } else {
    return (
      <a
        style={{
          lineHeight: "13pt",
          fontSize: "13pt",
        }}
        className={props.className}
        href="/kiwipass-mint"
      >
        {props.children || props.title}
      </a>
    );
  }
};

const Container = (props) => {
  return (
    <Connector {...props}>
      <Link {...props}>{props.children}</Link>
    </Connector>
  );
};

export default Container;
