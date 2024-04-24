import {
  usePrepareContractWrite,
  useContractWrite,
  WagmiConfig,
  useAccount,
  useNetwork,
  useSwitchNetwork,
} from "wagmi";
import { useMemo, useEffect, useState } from "react";
import { Wallet } from "@ethersproject/wallet";
import { optimism } from "wagmi/chains";
import { create } from "@attestate/delegator2";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import useLocalStorageState from "use-local-storage-state";

import Passkeys from "./Passkeys.jsx";
import { useProvider, chains, client } from "./client.mjs";
import { CheckmarkSVG } from "./icons.jsx";
import { ConnectedConnectButton } from "./Navigation.jsx";
import { resolveAvatar } from "./Avatar.jsx";
import { fetchDelegations } from "./API.mjs";
import { supportsPasskeys } from "./session.mjs";

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

export const ProgressBar = (props) => {
  const progress = props.progress || 0;
  return (
    <div style={{ display: "flex", height: "5px", marginBottom: "20px" }}>
      <div
        style={{
          flex: 1,
          backgroundColor: progress >= 0 ? "limegreen" : "black",
        }}
      ></div>
      <div
        style={{
          flex: 1,
          backgroundColor: progress >= 1 ? "limegreen" : "black",
        }}
      ></div>
      <div
        style={{
          flex: 1,
          backgroundColor: progress >= 2 ? "limegreen" : "black",
        }}
      ></div>
      <div
        style={{
          flex: 1,
          backgroundColor: progress >= 3 ? "limegreen" : "black",
        }}
      ></div>
    </div>
  );
};

const ConnectionDialogue = (props) => {
  const { pathname } = window.location;
  return (
    <div
      style={{
        wordBreak: "break-word",
      }}
    >
      <h3
        style={{
          marginTop: "0",
          fontSize: "1.2rem",
          color: "black",
          marginBottom: "20px",
        }}
      >
        {pathname === "/settings" ? (
          <span>
            Connect with{" "}
            <span style={{ whiteSpace: "nowrap" }}>news.kiwistand.com</span>
          </span>
        ) : (
          <span>Welcome to Kiwi News! </span>
        )}
      </h3>
      {pathname === "/settings" ? (
        <p
          style={{
            fontWeight: "bold",
            color: "black",
            marginBottom: "20px",
            textAlign: "left",
          }}
        >
          Enable Kiwi News to seamlessly interact on your behalf on the Optimism
          network:
        </p>
      ) : props.account && props.account.isConnected ? (
        <p
          style={{
            fontWeight: "bold",
            color: "black",
            marginBottom: "20px",
            textAlign: "left",
          }}
        >
          To make signing easier, we're adding an application key.
        </p>
      ) : (
        <p
          style={{
            fontWeight: "bold",
            color: "black",
            marginBottom: "20px",
            textAlign: "left",
          }}
        >
          Let us onboard you to the app.
          <br />
          <br />
          Please connect the wallet that received the Kiwi Pass NFT.
        </p>
      )}
      {pathname === "/settings" ? (
        <ul
          style={{
            textAlign: "left",
            listStyle: "none",
            paddingLeft: "0",
            color: "black",
            marginBottom: "30px",
          }}
        >
          <li>
            <span style={{ color: "limegreen" }}>•</span> Automatically upvote
            and submit stories.
          </li>
          <li style={{ marginTop: "5px" }}>
            <span style={{ color: "limegreen" }}>•</span> Sign messages without
            additional prompts.
          </li>
        </ul>
      ) : (
        ""
      )}
    </div>
  );
};

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
  const [indexedDelegation, setIndexedDelegation] = useState(false);

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

  const {
    data,
    write,
    isLoading,
    isSuccess: isWriteSuccess,
  } = useContractWrite(config);
  const isSuccess = isWriteSuccess && data && data.hash !== "null";
  if (isSuccess) setKey(newKey.privateKey);

  const handleClick = () => {
    removeItem();
    return;
  };

  let wallet;
  if (key) {
    wallet = new Wallet(key, provider);
  }

  useEffect(() => {
    (async () => {
      let intervalId;
      if (key && wallet && !indexedDelegation) {
        const checkDelegations = async () => {
          const delegations = await fetchDelegations();
          if (Object.keys(delegations).includes(wallet.address)) {
            setIndexedDelegation(true);
            clearInterval(intervalId);
          }
        };

        await checkDelegations();
        intervalId = setInterval(checkDelegations, 5000);
      }
      return () => clearInterval(intervalId);
    })();
  }, [key, wallet, from.address, props]);

  if (!from.address) {
    return (
      <div>
        <ProgressBar progress={0} />
        <ConnectionDialogue account={from} />
        <ConnectedConnectButton
          required
          allowlist={props.allowlist}
          delegations={props.delegations}
        />
      </div>
    );
  }

  if (key && wallet) {
    if (supportsPasskeys() && indexedDelegation) {
      return <Passkeys toast={props.toast} />;
    } else if (window.location.pathname === "/start") {
      const delegate = key && wallet ? wallet.address : newKey.address;
      window.location.href = `/indexing?address=${from.address}&delegate=${delegate}`;
    } else {
      const progress = !supportsPasskeys() && indexedDelegation ? 3 : 1;
      return (
        <div>
          <ProgressBar progress={progress} />
          <h3
            style={{
              marginTop: 0,
              marginBottom: 0,
              fontSize: "1.2rem",
              color: "black",
            }}
          >
            {indexedDelegation
              ? "Connection successful!"
              : "Indexing your connection onchain..."}
          </h3>
          {!indexedDelegation ? (
            <p>
              The Kiwi News node is searching for your transaction onchain. This
              can take a few minutes...
            </p>
          ) : (
            <p>
              You can now upvote, submit and comment without needing to confirm
              the signing manually in your wallet!
            </p>
          )}
        </div>
      );
    }
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
      <ConnectionDialogue account={from} />
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
  return (
    <WagmiConfig config={client}>
      <RainbowKitProvider chains={chains}>
        <div
          style={{
            border: "1px solid rgba(0,0,0,0.1)",
            backgroundColor: "#E6E6DF",
            maxWidth: "315px",
            display: "inline-block",
            padding: "30px",
            borderRadius: "2px",
            boxShadow: "0 6px 20 rgba(0,0,0,0.1)",
          }}
        >
          <DelegateButton {...props} />
        </div>
      </RainbowKitProvider>
    </WagmiConfig>
  );
};

export default Form;
