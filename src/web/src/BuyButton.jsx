import {
  usePrepareContractWrite,
  useContractWrite,
  WagmiConfig,
  useAccount,
  useProvider,
  useContractRead,
  useNetwork,
  useSwitchNetwork,
} from "wagmi";
import { Contract } from "@ethersproject/contracts";
import { Provider } from "@ethersproject/providers";
import { parseEther } from "@ethersproject/units";
import { mainnet, optimism } from "wagmi/chains";
import { Wallet } from "@ethersproject/wallet";
import { getAddress } from "@ethersproject/address";
import { eligible, create } from "@attestate/delegator2";
import { useState, useEffect } from "react";
import useLocalStorageState from "use-local-storage-state";
import { RainbowKitProvider, ConnectButton } from "@rainbow-me/rainbowkit";
import {
  getProvider,
  prepareWriteContract,
  writeContract,
  getAccount,
  fetchBalance,
  readContract,
} from "@wagmi/core";

import { getLocalAccount } from "./session.mjs";

import { client, chains } from "./client.mjs";

export async function prepare(key) {
  const { address } = getAccount();
  if (!address) {
    throw new Error("Account not available");
  }

  const provider = getProvider();

  const balance = {
    mainnet: (await fetchBalance({ address, chainId: mainnet.id })).value,
    optimism: (await fetchBalance({ address, chainId: optimism.id })).value,
  };
  const saleDetails = await readContract({
    address: collectionProxy,
    abi: abiVendor,
    functionName: "saleDetails",
    chainId: optimism.id,
  });
  if (!saleDetails || !saleDetails.publicSalePrice) {
    throw new Error("Couldn't get price");
  }
  const price = saleDetails.publicSalePrice.add(ZORA_MINT_FEE);

  let preferredChainId = null;
  if (balance.optimism.gt(price)) {
    preferredChainId = optimism.id;
  } else if (balance.mainnet.gt(price)) {
    preferredChainId = mainnet.id;
  }
  if (!preferredChainId) {
    throw new Error("Insufficient ETH");
  }

  const quantity = 1;
  const authorize = true;
  const payload = await create(key, address, key.address, authorize);
  const comment = "";
  const zeroAddress = "0x0000000000000000000000000000000000000000";
  let referral = zeroAddress;
  const queryReferral = new URLSearchParams(window.location.search).get(
    "referral",
  );
  try {
    referral = getAddress(queryReferral);
  } catch (err) {
    //noop
  }

  let config;
  if (preferredChainId === mainnet.id) {
    const isCreation = false;
    const gasLimit = 170000;
    const opProvider = getProvider({ chainId: optimism.id });
    const contract = new Contract(addressDelegator, abiDelegator, opProvider);
    const data = contract.interface.encodeFunctionData("setup", [
      quantity,
      payload,
      comment,
      referral,
    ]);

    config = await prepareWriteContract({
      address: optimismPortal,
      abi: abiOptimismPortal,
      functionName: "depositTransaction",
      args: [addressDelegator, price, gasLimit, isCreation, data],
      overrides: {
        value: price,
      },
      chainId: mainnet.id,
    });
  } else if (preferredChainId === optimism.id) {
    config = await prepareWriteContract({
      address: addressDelegator,
      abi: abiDelegator,
      functionName: "setup",
      args: [quantity, payload, comment, referral],
      overrides: {
        value: price,
      },
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
const ZORA_MINT_FEE = parseEther("0.000777");
const abiDelegator = [
  {
    inputs: [
      {
        internalType: "uint256",
        name: "quantity",
        type: "uint256",
      },
      {
        internalType: "bytes32[3]",
        name: "data",
        type: "bytes32[3]",
      },
      {
        internalType: "string",
        name: "comment",
        type: "string",
      },
      { internalType: "address", name: "referral", type: "address" },
    ],
    name: "setup",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
];
const abiVendor = [
  {
    inputs: [{ internalType: "uint256", name: "quantity", type: "uint256" }],
    name: "purchase",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [],
    name: "saleDetails",
    outputs: [
      {
        components: [
          { internalType: "bool", name: "publicSaleActive", type: "bool" },
          { internalType: "bool", name: "presaleActive", type: "bool" },
          { internalType: "uint256", name: "publicSalePrice", type: "uint256" },
          { internalType: "uint64", name: "publicSaleStart", type: "uint64" },
          { internalType: "uint64", name: "publicSaleEnd", type: "uint64" },
          { internalType: "uint64", name: "presaleStart", type: "uint64" },
          { internalType: "uint64", name: "presaleEnd", type: "uint64" },
          {
            internalType: "bytes32",
            name: "presaleMerkleRoot",
            type: "bytes32",
          },
          {
            internalType: "uint256",
            name: "maxSalePurchasePerAddress",
            type: "uint256",
          },
          { internalType: "uint256", name: "totalMinted", type: "uint256" },
          { internalType: "uint256", name: "maxSupply", type: "uint256" },
        ],
        internalType: "struct IERC721Drop.SaleDetails",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];

const collectionProxy = "0x66747bdc903d17c586fa09ee5d6b54cc85bbea45";
const addressDelegator = "0xea3b341b1f189f8e56b00c8e387b770acae121cf";

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
  const localAccount = getLocalAccount(from.address);
  if (from.isConnected) {
    address = from.address;
  }
  if (localAccount) {
    address = localAccount.identity;
  }
  const isEligible = eligible(allowlist, delegations, address);

  const [config, setConfig] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    const generate = async () => {
      if (!key || !isEligible) {
        return;
      }

      let config;
      try {
        config = await prepare(key);
      } catch (err) {
        setError(err);
      }
      if (!config) return;

      setConfig(config);
    };
    generate();
  }, [key]);

  if (error) {
    return (
      <div>
        <button className="buy-button" disabled>
          Error...
        </button>
      </div>
    );
  }
  if (!config) {
    return (
      <div>
        <button className="buy-button" disabled>
          Loading...
        </button>
      </div>
    );
  }
  const { data, write, isLoading, isSuccess } = useContractWrite(config);

  useEffect(() => {
    if (from.address) {
      setKeyName(`-kiwi-news-${from.address}-key`);
    }
  }, [from.address]);

  useEffect(() => {
    if (!localStorageKey && from.address) {
      setKey(newKey);
    } else if (localStorageKey) {
      const existingKey = new Wallet(localStorageKey, provider);
      setDelegated(true);
    }
  }, [from.address, localStorageKey, provider]);

  useEffect(() => {
    if (isSuccess) {
      setLocalStorageKey(key.privateKey);
      window.location.href = `/indexing?address=${from.address}&transactionHash=${data.hash}`;
    }
  }, [isSuccess]);

  if (config && config.chainId === optimism.id && chain.id !== optimism.id) {
    return (
      <div>
        <button
          className="buy-button"
          onClick={() => switchNetwork?.(optimism.id)}
        >
          Switch to Optimism
        </button>
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
      <div>
        <button className="buy-button" disabled>
          Insufficient funds on Optimism...
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

  if (isSuccess) {
    return (
      <div>
        <a
          target="_blank"
          href={`https://optimistic.etherscan.io/tx/${data.hash}`}
        >
          <button className="buy-button">
            Thanks for minting! (view on Etherscan)
          </button>
        </a>
      </div>
    );
  }
  if (isEligible) {
    return (
      <div>
        <button className="buy-button" disabled>
          Thanks for minting!
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
        {!isLoading && <div>(OP) Buy Kiwi Pass</div>}
        {isLoading && <div>Please sign transaction</div>}
      </button>
    </div>
  );
};

const Form = (props) => {
  return (
    <WagmiConfig client={client}>
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
                Connect Wallet to Mint
              </button>
            );
          }}
        </ConnectButton.Custom>
      </RainbowKitProvider>
    </WagmiConfig>
  );
};

export default Form;
