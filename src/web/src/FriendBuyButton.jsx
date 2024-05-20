import {
  useContractWrite,
  WagmiConfig,
  useAccount,
  useNetwork,
  useSwitchNetwork,
} from "wagmi";
import { Contract } from "@ethersproject/contracts";
import { Provider } from "@ethersproject/providers";
import { parseEther, formatEther } from "viem";
import { mainnet, optimism } from "wagmi/chains";
import { Wallet } from "@ethersproject/wallet";
import { getAddress } from "@ethersproject/address";
import { eligible, create } from "@attestate/delegator2";
import { useState, useEffect } from "react";
import useLocalStorageState from "use-local-storage-state";
import { RainbowKitProvider, ConnectButton } from "@rainbow-me/rainbowkit";
import {
  prepareWriteContract,
  getAccount,
  fetchBalance,
  readContract,
} from "@wagmi/core";

import { getLocalAccount } from "./session.mjs";
import { fetchPrice } from "./API.mjs";
import { getProvider, useProvider, client, chains } from "./client.mjs";
import NFTPrice from "./NFTPrice.jsx";
import { ConnectedSimpleDisconnectButton } from "./Navigation.jsx";

export async function prepare(recipient) {
  try {
    recipient = getAddress(recipient);
  } catch (err) {
    if (!recipient || (recipient && !recipient.includes(".eth"))) {
      throw new Error("invalid recipient");
    }

    const provider = getProvider({ chainId: 1 });
    const ensResolver = await provider.getResolver(recipient);
    recipient = await ensResolver.getAddress();
  }

  const { address } = getAccount();
  if (!address) {
    throw new Error("Account not available");
  }
  const referrer = address;

  const balance = {
    optimism: (await fetchBalance({ address, chainId: optimism.id })).value,
  };

  let price = await fetchPrice();
  if (!price || !price.min) {
    throw new Error("Error getting the minimum price from Zora");
  }

  const quantity = 1;
  const comment = "";
  const config = await prepareWriteContract({
    address: addressCollection,
    abi: abiCollection,
    functionName: "mintWithRewards",
    args: [recipient, quantity, comment, referrer],
    value: price.min,
    chainId: optimism.id,
  });
  return config;
}

const abiCollection = [
  {
    inputs: [
      { internalType: "address", name: "recipient", type: "address" },
      { internalType: "uint256", name: "quantity", type: "uint256" },
      { internalType: "string", name: "comment", type: "string" },
      { internalType: "address", name: "mintReferral", type: "address" },
    ],
    name: "mintWithRewards",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
];

const addressCollection = "0x66747bdc903d17c586fa09ee5d6b54cc85bbea45";

const EnsInput = (props) => {
  return (
    <input
      disabled={props.disabled}
      placeholder="Your friend's address or ENS"
      onChange={(e) => props.setRecipient(e.target.value)}
      type="text"
      className="buy-input"
    />
  );
};

const FriendBuyButton = (props) => {
  const { chain } = useNetwork();
  const { switchNetwork } = useSwitchNetwork();
  const from = useAccount();
  const provider = useProvider();
  const [recipient, setRecipient] = useState(null);
  const [sent, setSent] = useState(null);

  let address;
  const localAccount = getLocalAccount(from.address);
  if (from.isConnected) {
    address = from.address;
  }
  if (localAccount) {
    address = localAccount.identity;
  }

  const [config, setConfig] = useState(null);
  const [error, setError] = useState(null);
  const [preparing, setPreparing] = useState(false);
  useEffect(() => {
    const generate = async () => {
      setPreparing(true);
      let config;
      try {
        config = await prepare(recipient);
      } catch (err) {
        setPreparing(false);
        if (err.toString().includes("invalid recipient")) {
          setError(null);
          setConfig(null);
          return;
        }
        console.log("setting error", err);
        setError(err);
        setConfig(null);
      }
      setPreparing(false);
      if (!config) return;

      setConfig(config);
      setError(null);
    };
    generate();
  }, [chain, recipient]);

  if (!props.connected) {
    return (
      <div id="friend-buy-button-container">
        <EnsInput disabled setRecipient={setRecipient} />
        <button
          onClick={async (e) => {
            if (!props.connected) {
              props.openConnectModal();
              return;
            }
          }}
          className="friend-buy-button"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  if (sent) {
    return (
      <div style={{ fontSize: "1rem" }}>
        <b>Kiwi Pass sent</b>
        <br />
        <br />
        <span>
          Please tell your friend to go to{" "}
          <a href="https://news.kiwistand.com/start">
            news.kiwistand.com/start
          </a>{" "}
          to get onboarded!
        </span>
        <br />
        <br />
      </div>
    );
  }

  if ((!config && !error) || preparing) {
    return (
      <div id="friend-buy-button-container">
        <EnsInput setRecipient={setRecipient} />
        <button className="friend-buy-button" disabled>
          {preparing ? "Looking onchain..." : "Buy Kiwi Pass on Optimism"}
        </button>
        <br />
        <NFTPrice selector="min" />
        <br />
        <br />
        <ConnectedSimpleDisconnectButton />
      </div>
    );
  }

  const name = "Optimism";
  const chainId = optimism.id;
  if (
    (config && config.request && config.request.chainId !== chain.id) ||
    (error && error.message.includes("Chain mismatch"))
  ) {
    return (
      <div id="friend-buy-button-container">
        <EnsInput setRecipient={setRecipient} />
        <button
          className="friend-buy-button"
          onClick={() => switchNetwork?.(chainId)}
        >
          Switch to {name}
        </button>
        <br />
        <NFTPrice selector="min" />
        <br />
        <br />
        <ConnectedSimpleDisconnectButton />
      </div>
    );
  }

  if (
    error &&
    (error.toString().includes("insufficient funds") ||
      error.code === -32603 ||
      error.code === "INSUFFICIENT_FUNDS")
  ) {
    return (
      <div id="friend-buy-button-container">
        <EnsInput setRecipient={setRecipient} />
        <button className="friend-buy-button" disabled>
          Insufficient funds on {name}...
        </button>
        <br />
        <NFTPrice selector="min" />
        <br />
        <br />
        <ConnectedSimpleDisconnectButton />
      </div>
    );
  }
  if (error) {
    return (
      <div id="friend-buy-button-container">
        <EnsInput setRecipient={setRecipient} />
        <button className="friend-buy-button" disabled>
          {error.message}
        </button>
        <br />
        <NFTPrice selector="min" />
        <br />
        <br />
        <ConnectedSimpleDisconnectButton />
      </div>
    );
  }

  if (error && typeof error === "object") {
    return (
      <div id="friend-buy-button-container">
        <EnsInput setRecipient={setRecipient} />
        <button className="friend-buy-button" disabled>
          Error with provider...
        </button>
        <br />
        <NFTPrice selector="min" />
        <br />
        <br />
        <ConnectedSimpleDisconnectButton />
      </div>
    );
  }

  return (
    <div id="friend-buy-button-container">
      <EnsInput setRecipient={setRecipient} />
      <Button
        config={config}
        from={from}
        chainId={config.chainId}
        name={name}
        setSent={setSent}
      />
      <br />
      <NFTPrice selector="min" />
      <br />
      <br />
      <ConnectedSimpleDisconnectButton />
    </div>
  );
};

const Button = (props) => {
  const { name, config, setSent, from, chainId } = props;
  const { data, write, isLoading, isSuccess } = useContractWrite(config);

  useEffect(() => {
    // NOTE: wagmi returns data.hash === "null" (a string) when the transaction
    // is canceled by the user.
    if (isSuccess && data.hash !== "null") {
      setSent(data.hash);
    }
  }, [isSuccess]);

  return (
    <button
      className="friend-buy-button"
      disabled={!write || isLoading}
      onClick={() => write?.()}
    >
      {!isLoading && <div>Buy Kiwi Pass on {name}</div>}
      {isLoading && <div>Please sign transaction</div>}
    </button>
  );
};

const Form = (props) => {
  return (
    <WagmiConfig config={client}>
      <RainbowKitProvider chains={chains}>
        <ConnectButton.Custom>
          {({ account, chain, mounted, openConnectModal }) => {
            const connected = account && chain && mounted;
            return (
              <FriendBuyButton
                {...props}
                connected={connected}
                openConnectModal={openConnectModal}
              />
            );
          }}
        </ConnectButton.Custom>
      </RainbowKitProvider>
    </WagmiConfig>
  );
};

export default Form;
