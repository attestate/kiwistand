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
import { mainnet, optimism, base, arbitrum } from "wagmi/chains";
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
import theme from "./theme.jsx";
import { fetchPrice, fetchLeaderboard } from "./API.mjs";
import { getProvider, useProvider, client, chains } from "./client.mjs";
import { ZupassButton } from "./ZupassButton.jsx";

export async function prepare(key) {
  const { address } = getAccount();
  if (!address) {
    throw new Error("Account not available");
  }

  const provider = getProvider();
  const code = await provider.getCode(address);
  if (code !== "0x") throw new Error("Smart accounts aren't supported");

  const balance = {
    mainnet: (await fetchBalance({ address, chainId: mainnet.id })).value,
    optimism: (await fetchBalance({ address, chainId: optimism.id })).value,
    base: (await fetchBalance({ address, chainId: base.id })).value,
    arbitrum: (await fetchBalance({ address, chainId: arbitrum.id })).value,
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
  } else if (balance.mainnet > price) {
    // NOTE: We used to refer people to mint on Ethereum L1, but nowadays
    // most people have Ether on an L2 which makes bridging and minting far
    // cheaper.
    // preferredChainId = mainnet.id;
  }
  if (!preferredChainId) {
    let error = `Need at least ${formatEther(price)} ETH on Optimism`;

    if (balance.base > price) {
      error = `Bridge:${base.id}:${price}`;
    }
    if (balance.arbitrum > price) {
      error = `Bridge:${arbitrum.id}:${price}`;
    }
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
  if (preferredChainId === mainnet.id) {
    const isCreation = false;
    const gasLimit = 280_000;
    const opProvider = getProvider({ chainId: optimism.id });
    const contract = new Contract(addressDelegator, abiDelegator, opProvider);
    const data = contract.interface.encodeFunctionData("setup", [
      payload,
      recipients,
      values,
    ]);

    config = await prepareWriteContract({
      address: optimismPortal,
      abi: abiOptimismPortal,
      functionName: "depositTransaction",
      args: [addressDelegator, price, gasLimit, isCreation, data],
      value: price,
      chainId: mainnet.id,
    });
  } else if (preferredChainId === optimism.id) {
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

  const [config, setConfig] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    const generate = async () => {
      if (!key || isEligible) {
        return;
      }

      let config;
      try {
        setConfig(null);
        config = await prepare(key);
      } catch (err) {
        console.log("setting error", err.message, err.stack);
        setError(err);
        setConfig(null);
      }
      if (!config) return;

      setConfig(config);
      setError(null);
    };
    generate();
  }, [key, chain.id, discountEligible]);

  if (isEligible) {
    return (
      <div>
        <button
          onClick={() => {
            window.location.pathname = "/";
          }}
          className="buy-button"
        >
          Thanks for joining!
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
    (error && error.toString().includes("Need at least")) ||
    (error && error.toString().includes("Bridge:"))
  ) {
    let button = (
      <button className="buy-button" disabled>
        {error.message}
      </button>
    );
    const ETHSymbol = "0x0000000000000000000000000000000000000000";
    let link = `https://jumper.exchange/?toChain=10&toToken=${ETHSymbol}`;

    const match = error.toString().match(/Bridge:(\w+):(\d+)/);
    if (match) {
      let [, fromChain, price] = match;
      fromChain = parseInt(fromChain, 10);

      let chainName = "";
      if (fromChain === base.id) {
        chainName += "from Base";
      } else if (fromChain === arbitrum.id) {
        chainName += "from Arbitrum";
      }

      const gasReserve = 1000000000000000n;
      const fromAmount = BigInt(price) + gasReserve;
      link += `&fromAmount=${formatEther(
        fromAmount,
      )}&fromChain=${fromChain}&fromToken=${ETHSymbol}`;
      button = (
        <>
          <a href={link} target="_blank">
            <button className="buy-button">
              Bridge ETH {chainName} to Optimism (Jumper)
            </button>
          </a>
          <p>
            Once you're done bridging, <b>come back and reload this page</b>
          </p>
        </>
      );
    }

    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
        }}
      >
        {button}
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
      window.location.href = `/indexing?address=${from.address}&transactionHash=${data.hash}`;
    }
  }, [isSuccess]);

  if (isSuccess && data.hash !== "null") {
    const etherscan =
      chainId === mainnet.id ? "etherscan.io" : "optimistic.etherscan.io";
    return (
      <div>
        <a target="_blank" href={`https://${etherscan}/tx/${data.hash}`}>
          <button className="buy-button">
            Thanks for joining! (view on Etherscan)
          </button>
        </a>
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
        {!isLoading && <div>Buy Kiwi Pass on {name}</div>}
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
            padding: "1rem 3rem",
            margin: "0 0 2rem 0",
            backgroundImage: "url(devconbackground.avif)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            borderRadius: "8px",
            color: "white",
            textShadow:
              "2px 2px 4px rgba(0,0,0,0.9), 0px 0px 8px rgba(0,0,0,0.8)",
            fontWeight: "bold",
            fontSize: "1.5rem",
            textAlign: "center",
          }}
        >
          <p>
            Attending Devcon? <br /> Get 24% off with Zupass!
          </p>
          <ZupassButton setHasTicket={setDiscountEligible} />
        </div>
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
