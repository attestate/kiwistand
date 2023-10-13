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
import { parseEther } from "@ethersproject/units";
import { optimism } from "wagmi/chains";
import { Wallet } from "@ethersproject/wallet";
import { getAddress } from "@ethersproject/address";
import { eligible, create } from "@attestate/delegator2";
import { useState, useEffect } from "react";
import useLocalStorageState from "use-local-storage-state";
import { RainbowKitProvider, ConnectButton } from "@rainbow-me/rainbowkit";
import { getLocalAccount } from "./session.mjs";

import { client, chains } from "./client.mjs";

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
    const generate = async () => {
      if (key) {
        const authorize = true;
        const payload = await create(key, from.address, key.address, authorize);
        setPayload(payload);
      }
    };
    generate();
  }, [from.address, key]);

  const saleDetails = useContractRead({
    address: collectionProxy,
    abi: abiVendor,
    functionName: "saleDetails",
    chainId: optimism.id,
  });

  const quantity = 1;
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

  let referralComponent;
  if (referral !== zeroAddress) {
    referralComponent = (
      <span
        style={{ display: "block", fontSize: "0.75rem", marginTop: "10px" }}
      >
        *You have been referred by the Ethereum address{" "}
        <a
          style={{ textDecoration: "underline" }}
          href={"https://etherscan.io/address/" + referral}
          target="_blank"
        >
          {referral}
        </a>
        . If you proceed with minting, they will receive a referral reward of
        0.000222 ETH.
      </span>
    );
  }

  const { config, error } = usePrepareContractWrite({
    address: addressDelegator,
    abi: abiDelegator,
    functionName: "setup",
    args: [quantity, payload, comment, referral],
    overrides: {
      value: saleDetails.data.publicSalePrice.add(ZORA_MINT_FEE),
    },
    chainId: optimism.id,
  });

  if (error) {
    console.error(error);
  }

  const { data, write, isLoading, isSuccess } = useContractWrite(config);

  useEffect(() => {
    if (isSuccess) {
      setLocalStorageKey(key.privateKey);
      window.location.href = `/indexing?address=${from.address}&transactionHash=${data.hash}`;
    }
  }, [isSuccess]);

  if (chain.id !== optimism.id) {
    return (
      <div>
        {referralComponent}
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
        {referralComponent}
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
        {referralComponent}
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
        {referralComponent}
        <button className="buy-button" disabled>
          Thanks for minting!
        </button>
      </div>
    );
  }

  return (
    <div>
      {referralComponent}
      <button
        className="buy-button"
        disabled={!write || isLoading}
        onClick={() => write?.()}
      >
        {!isLoading && <div>Buy Kiwi News Pass</div>}
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
