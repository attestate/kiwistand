import {
  usePrepareContractWrite,
  useContractWrite,
  WagmiConfig,
  useAccount,
  useProvider,
  useNetwork,
  useSwitchNetwork,
} from "wagmi";
import { useMemo, useEffect, useState } from "react";
import { Wallet } from "@ethersproject/wallet";
import { optimism } from "wagmi/chains";
import { create } from "@attestate/delegator2";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import useLocalStorageState from "use-local-storage-state";

import { client, chains } from "./client.mjs";

const abi = [
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
  {
    inputs: [{ internalType: "bytes32[3]", name: "data", type: "bytes32[3]" }],
    name: "etch",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

const address = "0x08b7ECFac2c5754ABafb789c84F8fa37c9f088B0";
const newKey = Wallet.createRandom();
const DelegateButton = () => {
  const { chain } = useNetwork();
  const from = useAccount();
  const { switchNetwork } = useSwitchNetwork();
  const [keyName, setKeyName] = useState(null);

  useEffect(() => {
    if (from.address) {
      setKeyName(`-kiwi-news-${from.address}-key`);
    }
  }, [from.address]);

  const [key, setKey, { removeItem, isPersistent }] = useLocalStorageState(
    keyName,
    {
      serializer: {
        stringify: (val) => val,
        parse: (val) => val,
      },
    }
  );

  const [confirmation, setConfirmation] = useState(null);
  const provider = useProvider();

  const [config, setConfig] = useState({});
  const [isError, setIsError] = useState(false);
  const [payload, setPayload] = useState(null);

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
    if (from.address) generate();
  }, [from.address]);

  const prepArgs = useMemo(
    () => ({
      address,
      abi,
      functionName: "etch",
      args: [payload],
      chainId: optimism.id,
    }),
    [payload]
  );

  const {
    config: configData,
    error,
    isError: isPrepError,
  } = usePrepareContractWrite(prepArgs);

  useEffect(() => {
    if (configData) {
      setConfig(configData);
      setIsError(isPrepError);
      if (error) console.log("error in contract write prepare", error);
    }
  }, [configData, error, isPrepError]);

  const writeArgs = useMemo(() => config || {}, [config]);

  const { data, write, isLoading, isSuccess } = useContractWrite(config);
  if (isSuccess) setKey(newKey.privateKey);

  const handleClick = () => {
    removeItem();
    return;
  };

  let wallet;
  if (key) {
    wallet = new Wallet(key, provider);
  }

  if (!from.address) return <b>Please connect your wallet</b>;

  if (key && wallet) {
    return (
      <div>
        <button
          className="buy-button"
          onClick={handleClick} // Assuming handleClick is the function that deletes the key
        >
          Turn off
        </button>
        <br/>
        <br/>
       <p style={{ margin: '0', padding: '0' }}>
        You can now upvote and submit stories without signing each action! Please remember that if you clean your browser’s cookies, you might have to turn it on again.
      </p>
      </div>
    );
  
  }
  if (!write && !isError) {
    return <p>Loading from local storage...</p>;
  }
  let content;
  let activity;
  let handler;
  if (chain.id === 10) {
    content = (
      <span>
        {!isLoading && !isSuccess && <div>Turn On</div>}
        {isLoading && <div>Please sign transaction</div>}
        {isSuccess && <div>Delegation successful, please reload</div>}
      </span>
    );
    activity = !write || isLoading || isSuccess;
    handler = () => write?.();
  } else {
    content = <span>Switch to Optimism</span>;
    activity = false;
    handler = () => switchNetwork?.(10);
  }
  return (
    <div>
      {isPersistent ? (
        <button className="buy-button" disabled={activity} onClick={handler}>
          {content}
        </button>
      ) : (
        <p>Your browser isn't supporting key storage.</p>
      )}
    </div>
  );
};

const Form = () => {
  const { isConnected } = useAccount();
  return (
    <WagmiConfig client={client}>
      <RainbowKitProvider chains={chains}>
        <DelegateButton />
      </RainbowKitProvider>
    </WagmiConfig>
  );
};

export default Form;
