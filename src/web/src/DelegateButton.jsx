import {
  usePrepareContractWrite,
  useContractWrite,
  WagmiConfig,
  useAccount,
  useContractRead,
  useProvider,
} from "wagmi";
import { useEffect, useState } from "react";
import { ConnectKitProvider, ConnectKitButton } from "connectkit";
import { utils, Wallet } from "ethers";
import { optimism } from "wagmi/chains";
import { create } from "@attestate/delegator2";

import client from "./client.mjs";
import { showMessage } from "./message.mjs";

const abi = [
  {
    inputs: [
      {
        internalType: "bytes32[3]",
        name: "data",
        type: "bytes32[3]",
      },
    ],
    name: "etch",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "bytes32[3]",
        name: "data",
        type: "bytes32[3]",
      },
    ],
    name: "Delegate",
    type: "event",
  },
];

const address = "0x08b7ECFac2c5754ABafb789c84F8fa37c9f088B0";
const newKey = Wallet.createRandom();
const DelegateButton = () => {
  const [payload, setPayload] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const from = useAccount();
  const keyName = `-kiwi-news-${from.address}-key`;
  const [key, setKey] = useState(localStorage.getItem(keyName));
  const provider = useProvider();

  const { config, error } = usePrepareContractWrite({
    address,
    abi,
    functionName: "etch",
    args: [payload],
    chainId: optimism.id,
  });

  const { data, write, isLoading, isSuccess } = useContractWrite(config);
  if (isSuccess) {
    console.log("Saving your new key with address", newKey.address);
    localStorage.setItem(keyName, newKey.privateKey);
  }

  const handleClick = () => {
    localStorage.removeItem(keyName);
    setKey(null);
    return;
  };

  let wallet;
  if (key) {
    wallet = new Wallet(key, provider);
  }

  useEffect(() => {
    const generate = async () => {
      const authorize = true;
      const payload = await create(
        newKey,
        from.address,
        newKey.address,
        authorize
      );
      setPayload(payload);
    };
    generate();
  }, []);

  if (key && wallet) {
    const disabled = confirmation !== "delete key";
    return (
      <div>
        <p>
          <b>Key storage</b>
        </p>
        <p style={{ wordBreak: "break-all" }}>
          Your delegate address: {wallet.address}
        </p>
        <p>
          <b>Delete key</b>
          <p>
            You can delete your key from the browser, however, please consider
            that you'll not be able to recover it. Please type <b>delete key</b>{" "}
            to confirm.
          </p>
          <input
            type="text"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
          <button
            className="buy-button"
            disabled={disabled}
            onClick={handleClick}
          >
            Delete key
          </button>
        </p>
      </div>
    );
  }
  return (
    <div>
      <button
        className="buy-button"
        disabled={!write || isLoading || isSuccess}
        onClick={() => write?.()}
      >
        {!isLoading && !isSuccess && <div>Delegate on Optimism</div>}
        {isLoading && <div>Please sign transaction</div>}
        {isSuccess && <div>Delegation successful, please reload</div>}
      </button>
    </div>
  );
};

const CenteredConnectKitButton = () => {
  return (
    <div className="connect-kit-wrapper">
      <h3>You're almost there!</h3>
      <p>
        To submit links to the p2p network you'll need to:
        <br />
        <br />
        🥝 connect your wallet
        <br />
        🥝 mint our News Access NFT.
      </p>
      <ConnectKitButton />
    </div>
  );
};

const Form = () => {
  const { isConnected } = useAccount();
  return (
    <WagmiConfig client={client}>
      <ConnectKitProvider>
        {isConnected ? <DelegateButton /> : <CenteredConnectKitButton />}
      </ConnectKitProvider>
    </WagmiConfig>
  );
};

export default Form;
