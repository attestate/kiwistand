import { useState, useEffect } from "react";
import { useAccount, WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { Wallet } from "@ethersproject/wallet";

import { useProvider, client, chains } from "./client.mjs";
import { getLocalAccount, isIOS, isRunningPWA } from "./session.mjs";
import * as API from "./API.mjs";

const TelegramLink = (props) => {
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

const queryClient = new QueryClient();

const Container = (props) => {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={client}>
        <RainbowKitProvider chains={chains}>
          <TelegramLink {...props} />
        </RainbowKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
};
export default Container;
