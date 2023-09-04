import {
  usePrepareContractWrite,
  useContractWrite,
  WagmiConfig,
  useAccount,
  useNetwork,
  useSwitchNetwork,
  useProvider,
  useContractRead,
} from "wagmi";
import { parseEther } from "@ethersproject/units";
import { mainnet } from "wagmi/chains";
import { Wallet } from "@ethersproject/wallet";
import { eligible, create } from "@attestate/delegator2";
import { useState, useEffect } from "react";
import useLocalStorageState from "use-local-storage-state";
import { RainbowKitProvider, ConnectButton } from "@rainbow-me/rainbowkit";

import { client, chains } from "./client.mjs";

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

const newKey = Wallet.createRandom();
const BuyButton = (props) => {
  const { allowlist, delegations, toast } = props;
  const from = useAccount();
  const { chain } = useNetwork();
  const { switchNetwork } = useSwitchNetwork();
  const provider = useProvider();
  const [payload, setPayload] = useState(null);
  const isEligible = eligible(allowlist, delegations, from.address);

  const salesDetails = useContractRead({
    address: addressVendor,
    abi: abiVendor,
    functionName: "saleDetails",
    chainId: 1,
  });

  const ZORA_MINT_FEE = parseEther("0.000777");
  const quantity = 1;
  const { config, error } = usePrepareContractWrite({
    address: addressVendor,
    abi: abiVendor,
    functionName: "purchase",
    args: [quantity],
    overrides: {
      value: salesDetails.data.publicSalePrice.add(ZORA_MINT_FEE),
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
        {
          duration: 10000,
        },
      );
    }
  }, [isSuccess]);

  if (chain.id !== 1) {
    return (
      <button className="buy-button" onClick={() => switchNetwork?.(1)}>
        Switch to Ethereum Mainnet
      </button>
    );
  }

  if (error && error.toString().includes("insufficient funds")) {
    return (
      <button className="buy-button" disabled>
        Insufficient funds...
      </button>
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
      <a target="_blank" href={`https://etherscan.io/tx/${data.hash}`}>
        <button className="buy-button">
          Thanks for minting! (view on Etherscan)
        </button>
      </a>
    );
  }
  if (isEligible) {
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
