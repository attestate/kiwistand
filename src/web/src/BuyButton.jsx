import {
  usePrepareContractWrite,
  useContractWrite,
  WagmiConfig,
  useAccount,
  useProvider,
  useContractRead,
} from "wagmi";
import { utils } from "ethers";
import { mainnet } from "wagmi/chains";
import { Wallet } from "@ethersproject/wallet";
import { create } from "@attestate/delegator2";
import { useState, useEffect } from "react";
import useLocalStorageState from "use-local-storage-state";
import { RainbowKitProvider, ConnectButton } from "@rainbow-me/rainbowkit";

import { client, chains } from "./client.mjs";

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
    ],
    name: "purchase",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
];
const abiVendor = [
  {
    inputs: [
      {
        internalType: "uint256",
        name: "quantity",
        type: "uint256",
      },
    ],
    name: "purchase",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [],
    name: "saleDetails",
    outputs: [
      {
        components: [
          {
            internalType: "bool",
            name: "publicSaleActive",
            type: "bool",
          },
          {
            internalType: "bool",
            name: "presaleActive",
            type: "bool",
          },
          {
            internalType: "uint256",
            name: "publicSalePrice",
            type: "uint256",
          },
          {
            internalType: "uint64",
            name: "publicSaleStart",
            type: "uint64",
          },
          {
            internalType: "uint64",
            name: "publicSaleEnd",
            type: "uint64",
          },
          {
            internalType: "uint64",
            name: "presaleStart",
            type: "uint64",
          },
          {
            internalType: "uint64",
            name: "presaleEnd",
            type: "uint64",
          },
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
          {
            internalType: "uint256",
            name: "totalMinted",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "maxSupply",
            type: "uint256",
          },
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

const addressVendor = "0xebb15487787cbf8ae2ffe1a6cca5a50e63003786";
const addressDelegator = "0x2813c9f6cb3b4b21804a2c9a958ce1e0c653951c";

const ZORA_MINT_FEE = utils.parseEther("0.000777");

const newKey = Wallet.createRandom();
const BuyButton = (props) => {
  const { toast } = props;
  const from = useAccount();
  const provider = useProvider();
  const [key, setKey] = useState(null);
  const [payload, setPayload] = useState(null);
  const [keyName, setKeyName] = useState(null);
  const [minted, setMinted] = useState(false);
  const [localStorageKey, setLocalStorageKey, { removeItem, isPersistent }] =
    useLocalStorageState(keyName, {
      serializer: {
        stringify: (val) => val,
        parse: (val) => val,
      },
    });

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
      setMinted(true);
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

  const salesDetails = useContractRead({
    address: addressVendor,
    abi: abiVendor,
    functionName: "saleDetails",
    chainId: 1,
  });

  const quantity = 1;
  const value = ZORA_MINT_FEE.add(salesDetails.data.publicSalePrice);
  const { config, error } = usePrepareContractWrite({
    address: addressDelegator,
    abi: abiDelegator,
    functionName: "purchase",
    args: [quantity, payload],
    overrides: {
      value,
    },
    chainId: mainnet.id,
  });

  if (error) {
    console.error(error);
  }

  const { data, write, isLoading, isSuccess } = useContractWrite(config);

  useEffect(() => {
    if (isSuccess) {
      toast.success(
        "Successfully minted! We're indexing your transaction but might take up to 5 minutes before you can post!",
      );
      setLocalStorageKey(key.privateKey);
    }
  }, [isSuccess]);
  if (isSuccess) {
    return (
      <a target="_blank" href={`https://etherscan.io/tx/${data.hash}`}>
        <button className="buy-button">
          Thanks for minting! (view on Etherscan)
        </button>
      </a>
    );
  }
  if (minted) {
    return (
      <button className="buy-button" disabled>
        Thanks for minting!
      </button>
    );
  }

  return (
    <div>
      <button
        className="buy-button"
        disabled={minted || !write || isLoading}
        onClick={() => write?.()}
      >
        {!minted && !isLoading && !isSuccess && <div>Buy Kiwi News Pass</div>}
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
