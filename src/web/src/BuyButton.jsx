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
import { base } from "wagmi/chains";

import { getLocalAccount } from "./session.mjs";
import theme from "./theme.jsx";
import posthog from "posthog-js";
import { fetchPrice } from "./API.mjs";
import { getProvider, useProvider, client, chains, isInIOSApp } from "./client.mjs";
import InsufficientFundsSwap from "./InsufficientFundsSwap.jsx";
import sdk from "@farcaster/frame-sdk";

export async function prepare(key) {
  const { address } = getAccount();
  if (!address) {
    throw new Error("Account not available");
  }

  const provider = getProvider();
  const code = await provider.getCode(address);
  if (code !== "0x") throw new Error("Smart accounts aren't supported");

  const balance = {
    optimism: (await fetchBalance({ address, chainId: optimism.id })).value,
  };

  let price = await fetchPrice();
  if (!price || !price.authoritative || price.difference === null) {
    throw new Error("Error getting the price");
  }
  const { difference } = price;

  const discount = new URLSearchParams(window.location.search).get("discount");
  const validDiscount = discount === theme.discount.code;

  if (validDiscount) {
    console.log("Found valid discount");
    price = price.min;
  } else {
    price = price.authoritative;
  }

  let preferredChainId = null;
  if (balance.optimism > price) {
    preferredChainId = optimism.id;
  }
  if (!preferredChainId) {
    let error = `Need at least ${formatEther(price)} ETH on Optimism`;
    throw new Error(error);
  }

  const authorize = true;
  const payload = await create(key, address, key.address, authorize);

  const recipients = [];
  const values = [];
  if (!validDiscount) {
    const zeroAddress = "0x0000000000000000000000000000000000000000";
    let referral = zeroAddress;
    const queryReferral = localStorage.getItem("--kiwi-news-original-referral");
    try {
      referral = getAddress(queryReferral);
    } catch (err) {
      console.log("Couldn't find referral address in URL bar");
      //noop
    }
    const treasury = "0x1337E2624ffEC537087c6774e9A18031CFEAf0a9";
    if (referral !== zeroAddress) {
      price -= difference;
      recipients.push(referral);
      values.push(difference);
    } else {
      recipients.push(treasury);
      values.push(difference);
    }
  }

  let config;
  if (preferredChainId === optimism.id) {
    config = await prepareWriteContract({
      address: addressDelegator,
      abi: abiDelegator,
      functionName: "setup",
      args: [payload, recipients, values],
      value: price,
      chainId: optimism.id,
    });
  } else {
    throw new Error("Selected unsupported chainId");
  }
  return config;
}

const optimismPortal = "0xbEb5Fc579115071764c7423A4f12eDde41f106Ed";
const abiOptimismPortal = [
  {
    inputs: [
      { internalType: "address", name: "_to", type: "address" },
      { internalType: "uint256", name: "_value", type: "uint256" },
      { internalType: "uint64", name: "_gasLimit", type: "uint64" },
      { internalType: "bool", name: "_isCreation", type: "bool" },
      { internalType: "bytes", name: "_data", type: "bytes" },
    ],
    name: "depositTransaction",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
];
const abiDelegator = [
  {
    inputs: [
      { internalType: "bytes32[3]", name: "data", type: "bytes32[3]" },
      { internalType: "address[]", name: "beneficiaries", type: "address[]" },
      { internalType: "uint256[]", name: "amounts", type: "uint256[]" },
    ],
    name: "setup",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
];

const collectionProxy = "0x66747bdc903d17c586fa09ee5d6b54cc85bbea45";
const addressDelegator = "0xe63496a8a9e6bd3ad9270236a890d78239441cf6";

const newKey = Wallet.createRandom();
const BuyButton = (props) => {
  const { chain } = useNetwork();
  const { switchNetwork } = useSwitchNetwork();
  const { discountEligible, allowlist, delegations, toast } = props;
  const from = useAccount();
  useEffect(() => {
    if (from && from.address) {
      posthog.identify(from.address);
    }
  }, [from]);
  const provider = useProvider();
  const [key, setKey] = useState(null);
  const [payload, setPayload] = useState(null);
  const [keyName, setKeyName] = useState(null);
  const [delegated, setDelegated] = useState(false);
  const [localStorageKey, setLocalStorageKey, { removeItem, isPersistent }] =
    useLocalStorageState(keyName, {
      serializer: {
        stringify: (val) => val,
        parse: (val) => val,
      },
    });
  const [isInMiniApp, setIsInMiniApp] = useState(false);

  let address;
  const localAccount = getLocalAccount(from.address, allowlist);
  if (from.isConnected) {
    address = from.address;
  }
  if (localAccount) {
    address = localAccount.identity;
  }
  const isEligible = eligible(allowlist, delegations, address);

  useEffect(() => {
    if (from.address) {
      setKeyName(`-kiwi-news-${from.address}-key`);
    }

    if (!localStorageKey && from.address) {
      setKey(newKey);
    } else if (localStorageKey) {
      setDelegated(true);
    }
  }, [from.address, localStorageKey, provider]);

  // Check if we're in a Farcaster Mini App
  useEffect(() => {
    const checkMiniApp = async () => {
      try {
        const inMiniApp = await sdk.isInMiniApp();
        setIsInMiniApp(inMiniApp);
      } catch (error) {
        setIsInMiniApp(false);
      }
    };
    checkMiniApp();
  }, []);

  const [config, setConfig] = useState(null);
  const [error, setError] = useState(null);


  useEffect(() => {
    const generate = async () => {
      if (!key || isEligible) return;

      setConfig(null);

      try {
        if (!chain) {
          setError(new Error("Waiting for network connection..."));
          return;
        }

        const config = await prepare(key);
        setConfig(config);
        setError(null);
        return;
      } catch (err) {
        console.log("setting error", err.message);
        setError(err);

      }
    };

    generate();
  }, [
    key,
    chain?.id,
    discountEligible,
    from.address,
  ]);

  if (isEligible) {
    return (
      <div>
        <button className="buy-button" disabled>
          You already have a Kiwi Pass
        </button>
      </div>
    );
  }
  if (!config && !error) {
    return (
      <div>
        <button className="buy-button" disabled>
          Loading...
        </button>
      </div>
    );
  }
  let name;
  if (config && config.request && config.request.chainId === mainnet.id) {
    name = "Ethereum";
  }
  if (config && config.request && config.request.chainId === optimism.id) {
    name = "Optimism";
  }

  if (
    (config && config.request && config.request.chainId !== chain.id) ||
    (error && error.message.includes("Chain mismatch"))
  ) {
    let chainId = config && config.request ? config.request.chainId : null;
    if (
      config &&
      config.request &&
      config.request.chainId !== chain.id &&
      config.request.chainId === mainnet.id
    ) {
      name = "Ethereum";
      chainId = mainnet.id;
    }
    if (
      config &&
      config.request &&
      config.request.chainId !== chain.id &&
      config.request.chainId === optimism.id
    ) {
      name = "Optimism";
      chainId = optimism.id;
    }
    if (error && error.message.includes(`Expected "Ethereum"`)) {
      name = "Ethereum";
      chainId = mainnet.id;
    }
    if (error && error.message.includes(`Expected "OP Mainnet"`)) {
      name = "Optimism";
      chainId = optimism.id;
    }
    return (
      <div>
        <button className="buy-button" onClick={() => switchNetwork?.(chainId)}>
          Switch to {name}
        </button>
      </div>
    );
  }

  if (
    (error &&
      (error.toString().includes("insufficient funds") ||
        error.code === -32603 ||
        error.code === "INSUFFICIENT_FUNDS")) ||
    (error && error.toString().includes("Need at least"))
  ) {
    // Extract the amount needed from the error message
    let amount = "0.000003";
    const match = error.toString().match(/Need at least ([0-9.]+) ETH/);
    if (match) {
      amount = match[1];
    }
    
    // Check if we're in a Farcaster Frame (Mini App) and show swap options
    // Only show swap for Farcaster Mini Apps, not for iOS Coinbase Wallet app
    if (isInMiniApp && !isInIOSApp) {
      return (
        <InsufficientFundsSwap 
          requiredAmount={amount}
          onSwapInitiated={() => {
            // Re-generate config after swap is initiated
            setError(null);
          }}
        />
      );
    }
    
    // Default message for non-Frame users (including iOS Coinbase Wallet)
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
        }}
      >
        <button className="buy-button" disabled>
          Insufficient funds
        </button>
        <p style={{ marginTop: "10px", fontSize: "14px", textAlign: "center" }}>
          Please add at least {amount} ETH to your wallet on Optimism
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <button className="buy-button" disabled>
          {error.message.length < 100 ? error.message : "Unexpected Error"}
        </button>
      </div>
    );
  }

  if (error && typeof error === "object") {
    return (
      <button className="buy-button" disabled>
        Error with provider...
      </button>
    );
  }

  return (
    <Button
      setLocalStorageKey={setLocalStorageKey}
      config={config}
      signer={key}
      from={from}
      chainId={config.chainId}
      name={name}
    />
  );
};

const Button = (props) => {
  const { name, config, signer, from, setLocalStorageKey, chainId } = props;
  const { data, write, isLoading, isSuccess } = useContractWrite(config);

  useEffect(() => {
    // NOTE: wagmi returns data.hash === "null" (a string) when the transaction
    // is canceled by the user.
    if (isSuccess && data.hash !== "null") {
      setLocalStorageKey(signer.privateKey);
      posthog.capture("user_signed_up", {
        address: from.address,
        transactionHash: data.hash,
      });
      // Removed Google Analytics conversion tracking for onboarding
      window.location.href = `/indexing?address=${from.address}&transactionHash=${data.hash}`;
    }
  }, [isSuccess]);

  if (isSuccess && data.hash !== "null") {
    return (
      <div>
        <button className="buy-button" disabled>
          Success! Redirecting...
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        className="buy-button"
        disabled={!write || isLoading}
        onClick={() => write?.()}
      >
        {!isLoading && <div>Mint Kiwi Pass on {name}</div>}
        {isLoading && <div>Please sign transaction</div>}
      </button>
    </div>
  );
};

const Form = (props) => {
  const [discountEligible, setDiscountEligible] = useState(false);

  return (
    <WagmiConfig config={client}>
      <RainbowKitProvider chains={chains}>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <ConnectButton.Custom>
            {({ account, chain, mounted, openConnectModal }) => {
              const connected = account && chain && mounted;
              if (connected)
                return (
                  <BuyButton {...props} discountEligible={discountEligible} />
                );
              return (
                <button
                  onClick={async (e) => {
                    if (!connected) {
                      openConnectModal();
                      return;
                    }
                  }}
                  className="buy-button"
                >
                  Connect Wallet
                </button>
              );
            }}
          </ConnectButton.Custom>
        </div>
      </RainbowKitProvider>
    </WagmiConfig>
  );
};

export default Form;
