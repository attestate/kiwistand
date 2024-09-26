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
import theme from "./theme.jsx";
import { fetchPrice, fetchLeaderboard } from "./API.mjs";
import { getProvider, useProvider, client, chains } from "./client.mjs";

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
  };

  let price = await fetchPrice();
  if (!price || !price.authoritative || price.difference === null) {
    throw new Error("Error getting the price");
  }
  const { difference } = price;

  const discount = new URLSearchParams(window.location.search).get("discount");
  const validDiscount = discount === theme.discount.code;

  if (validDiscount) {
    price = price.min;
  } else {
    price = price.authoritative;
  }

  let preferredChainId = null;
  if (balance.optimism > price) {
    preferredChainId = optimism.id;
  } else if (balance.mainnet > price) {
    preferredChainId = mainnet.id;
  }
  if (!preferredChainId) {
    throw new Error(
      `Need at least ${formatEther(price)} ETH on Mainnet or Optimism`,
    );
  }

  const authorize = true;
  const payload = await create(key, address, key.address, authorize);

  const leaderboard = await fetchLeaderboard();
  if (!leaderboard || !leaderboard.leaders) {
    throw new Error("Error getting the leaderboard");
  }

  let allKarma = leaderboard.leaders.reduce(
    (sum, { totalKarma }) => sum + totalKarma,
    0,
  );

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
    if (referral !== zeroAddress) {
      const reward = difference / 2n;
      price -= reward;
      recipients.push(referral);
      values.push(reward);
    } else if (difference !== 0n) {
      const allKarmaBigInt = BigInt(allKarma);
      let remainder = difference;

      for (const { identity, totalKarma } of leaderboard.leaders) {
        const share = (difference * BigInt(totalKarma)) / allKarmaBigInt;
        recipients.push(identity);
        values.push(share);
        remainder -= share;
      }

      for (let i = 0; i < remainder; i++) {
        values[i] += 1n;
      }
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
  const { allowlist, delegations, toast } = props;
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
        config = await prepare(key);
      } catch (err) {
        console.log("setting error", err.message);
        setError(err);
        setConfig(null);
      }
      if (!config) return;

      setConfig(config);
      setError(null);
    };
    generate();
  }, [key, chain.id]);

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
    error.toString().includes("Need at least")
  ) {
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
          {error.message}
        </button>
        <a
          href="https://jumper.exchange/?toChain=10&toToken=0x0000000000000000000000000000000000000000"
          target="_blank"
          style={{
            marginTop: "1rem",
            textDecoration: "underline",
            fontWeight: "bold",
            fontSize: "1.1rem",
          }}
        >
          Bridge to OP mainnet on jumper.exchange
        </a>
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
  return (
    <WagmiConfig config={client}>
      <RainbowKitProvider chains={chains}>
        <ConnectButton.Custom>
          {({ account, chain, mounted, openConnectModal }) => {
            const connected = account && chain && mounted;
            if (connected) return <BuyButton {...props} />;
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
      </RainbowKitProvider>
    </WagmiConfig>
  );
};

export default Form;
