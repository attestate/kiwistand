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
import { ConnectedConnectButton } from "./Navigation.jsx";

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
const DelegateButton = (props) => {
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
    },
  );

  const [confirmation, setConfirmation] = useState("");
  const provider = useProvider();

  const [payload, setPayload] = useState(null);

  useEffect(() => {
    const generate = async () => {
      const authorize = true;
      const payload = await create(
        newKey,
        from.address,
        newKey.address,
        authorize,
      );
      setPayload(payload);
    };
    if (from.address) generate();
  }, [from.address]);

  const prepArgs = {
    address,
    abi,
    functionName: "etch",
    args: [payload],
    chainId: optimism.id,
  };

  const { config, error, isError } = usePrepareContractWrite(prepArgs);

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

  if (!from.address) {
    return (
      <div>
        <ConnectedConnectButton
          required
          allowlist={props.allowlist}
          delegations={props.delegations}
        />
      </div>
    );
  }
  if (key && wallet) {
    const disabled = confirmation !== "delete key";
    return (
      <div>
        <p style={{ wordBreak: "break-all" }}>
          <b>Enabled</b> with: {wallet.address}
        </p>
      </div>
    );
  }
  let content;
  let activity;
  let handler;
  let message;
  if (isLoading) {
    message = "Please sign transaction";
  }
  if (isSuccess) {
    message =
      "Success! We're updating our database... (this can take 5 minutes)";
  }
  if (chain.id === 10) {
    content = <span>Enable on Optimism</span>;
    activity = !write || (!write && !isError) || isLoading || isSuccess;
    handler = () => write?.();
  } else {
    content = <span>Switch to Optimism</span>;
    activity = false;
    handler = () => switchNetwork?.(10);
  }
  return (
    <div>
      {isPersistent ? (
        <div>
          <button
            style={{ width: "auto" }}
            className="buy-button"
            id="button-onboarding"
            disabled={activity}
            onClick={handler}
          >
            {content}
          </button>
          <br />
          <span>{message}</span>
        </div>
      ) : (
        <p>Your browser isn't supporting key storage.</p>
      )}
    </div>
  );
};

const Form = (props) => {
  const { isConnected } = useAccount();
  return (
    <WagmiConfig client={client}>
      <RainbowKitProvider chains={chains}>
        <DelegateButton {...props} />
      </RainbowKitProvider>
    </WagmiConfig>
  );
};

export default Form;
