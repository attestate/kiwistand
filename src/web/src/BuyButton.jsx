import {
  useWriteContract,
  WagmiProvider,
  useAccount,
  useChainId,
  useSwitchChain,
} from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
  simulateContract,
  getAccount,
  getBalance,
  readContract,
} from "@wagmi/core";
import { base } from "wagmi/chains";

import { getLocalAccount } from "./session.mjs";
import theme from "./theme.jsx";
import posthog from "posthog-js";
import { fetchPrice } from "./API.mjs";
import {
  getProvider,
  useProvider,
  client,
  chains,
  isInIOSApp,
} from "./client.mjs";
import InsufficientFundsSwap from "./InsufficientFundsSwap.jsx";
import sdk from "@farcaster/frame-sdk";

export async function prepare(key) {
  const { address } = getAccount(client);
  if (!address) {
    throw new Error("Account not available");
  }

  const balance = {
    optimism: (await getBalance(client, { address, chainId: optimism.id }))
      .value,
  };

  const price = 1400000000000000n;

  if (balance.optimism < price) {
    let error = `Need at least ${formatEther(price)} ETH on Optimism`;
    throw new Error(error);
  }

  const authorize = true;
  const payload = await create(key, address, key.address, authorize);

  const { request } = await simulateContract(client, {
    address: addressDelegator,
    abi: abiDelegator,
    functionName: "setup",
    args: [payload],
    value: price,
    chainId: optimism.id,
  });
  const config = { request };

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
    inputs: [{ internalType: "bytes32[3]", name: "data", type: "bytes32[3]" }],
    name: "setup",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
];

const collectionProxy = "0x66747bdc903d17c586fa09ee5d6b54cc85bbea45";
const addressDelegator = "0x418910fef46896eb0bfe38f656e2f7df3eca7198"; // Delegator3

const newKey = Wallet.createRandom();
const BuyButton = (props) => {
  // Temporarily deactivated
  return (
    <div>
      <button className="buy-button" disabled>
        Minting currently deactivated
      </button>
    </div>
  );

  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
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
        if (!chainId) {
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
  }, [key, chainId, discountEligible, from.address]);

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
    (config && config.request && config.request.chainId !== chainId) ||
    (error && error.message.includes("Chain mismatch"))
  ) {
    let chainId = config && config.request ? config.request.chainId : null;
    if (
      config &&
      config.request &&
      config.request.chainId !== chainId &&
      config.request.chainId === mainnet.id
    ) {
      name = "Ethereum";
      chainId = mainnet.id;
    }
    if (
      config &&
      config.request &&
      config.request.chainId !== chainId &&
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
        <button
          className="buy-button"
          onClick={() => switchChain?.({ chainId: optimism.id })}
        >
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
  const {
    data: hash,
    writeContract,
    isPending,
    isSuccess,
  } = useWriteContract();

  useEffect(() => {
    // NOTE: wagmi returns hash === "null" (a string) when the transaction
    // is canceled by the user.
    if (isSuccess && hash && hash !== "null") {
      setLocalStorageKey(signer.privateKey);
      posthog.capture("user_signed_up", {
        address: from.address,
        transactionHash: hash,
      });
      // Removed Google Analytics conversion tracking for onboarding
      window.location.href = `/indexing?address=${from.address}&transactionHash=${hash}`;
    }
  }, [isSuccess, hash]);

  if (isSuccess && hash && hash !== "null") {
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
        disabled={!config || isPending}
        onClick={() => config && writeContract(config.request)}
      >
        {!isPending && <div>Mint Kiwi Pass on {name}</div>}
        {isPending && <div>Please sign transaction</div>}
      </button>
    </div>
  );
};

const queryClient = new QueryClient();

const Form = (props) => {
  const [discountEligible, setDiscountEligible] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={client}>
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
      </WagmiProvider>
    </QueryClientProvider>
  );
};

export default Form;
