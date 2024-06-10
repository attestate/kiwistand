import { useState, useEffect } from "react";
import { useAccount, WagmiConfig } from "wagmi";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { Wallet } from "@ethersproject/wallet";

import { useProvider, client, chains } from "./client.mjs";
import { getLocalAccount, isIOS, isRunningPWA } from "./session.mjs";
import * as API from "./API.mjs";

export const Redirector = () => {
  const hasPushNotificationSupport =
    "serviceWorker" in navigator && "PushManager" in window;

  if (
    (hasPushNotificationSupport && !isIOS()) ||
    (hasPushNotificationSupport && isIOS() && isRunningPWA())
  ) {
    return (
      <a href="/notifications">
        <button style={{ width: "auto" }} id="button-onboarding">
          Continue
        </button>
      </a>
    );
  }
  return (
    <a href="/demonstration">
      <button style={{ width: "auto" }} id="button-onboarding">
        Continue
      </button>
    </a>
  );
};

const TelegramLink = () => {
  const [generatedLink, setGeneratedLink] = useState("...loading");
  const account = useAccount();
  const localAccount = getLocalAccount(account.address, props.allowlist);

  let address;
  if (localAccount) {
    address = localAccount.identity;
  }

  const provider = useProvider();
  async function generateLink() {
    const value = API.messageFab("TGAUTH", "TGAUTH", "TGAUTH");
    const signer = new Wallet(localAccount.privateKey, provider);
    const signature = await signer._signTypedData(
      API.EIP712_DOMAIN,
      API.EIP712_TYPES,
      value,
    );

    const wait = null;
    const endpoint = "/api/v1/telegram";
    const port = window.location.port;
    const response = await API.send(value, signature, wait, endpoint, port);

    if (response.status === "success") {
      setGeneratedLink(response.data.link);
    } else {
      setGeneratedLink(
        "We're trying to generate your link, this might take a few seconds.",
      );
      setTimeout(() => generateLink(), 5000);
    }
  }

  useEffect(() => {
    if (address) {
      generateLink();
    }
  }, [address]);

  const link = !address
    ? "Error: Can't generate Telegram invite link"
    : generatedLink;

  return (
    <span>
      {link.startsWith("https://") && (
        <a
          style={{
            fontWeight: "bold",
            textDecoration: "underline",
            color: "black",
          }}
          className="meta-link"
          href={link}
          target="_blank"
        >
          {link}
        </a>
      )}
      {!link.startsWith("https://") && link}
    </span>
  );
};

const Container = (props) => {
  return (
    <WagmiConfig config={client}>
      <RainbowKitProvider chains={chains}>
        <TelegramLink {...props} />
      </RainbowKitProvider>
    </WagmiConfig>
  );
};
export default Container;
