import {
  useSimulateContract,
  useWriteContract,
  useAccount,
  useChainId,
  useSwitchChain,
} from "wagmi";
import posthog from "posthog-js";
import { useMemo, useEffect, useState } from "react";
import { Wallet } from "@ethersproject/wallet";
import { optimism } from "wagmi/chains";
import { create, resolveIdentity } from "@attestate/delegator2";
import useLocalStorageState from "use-local-storage-state";
import { getAddress } from "@ethersproject/address";

import { useProvider } from "./client.mjs";
import { CheckmarkSVG } from "./icons.jsx";
import theme from "./theme.jsx";
import {
  ConnectedSimpleDisconnectButton,
  ConnectedConnectButton,
} from "./Navigation.jsx";
import { resolveAvatar } from "./Avatar.jsx";
import { fetchDelegations } from "./API.mjs";
import { getLocalAccount } from "./session.mjs";

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
          backgroundColor: progress >= 0 ? theme.color : "black",
        }}
      ></div>
      <div
        style={{
          flex: 1,
          backgroundColor: progress >= 1 ? theme.color : "black",
        }}
      ></div>
      <div
        style={{
          flex: 1,
          backgroundColor: progress >= 2 ? theme.color : "black",
        }}
      ></div>
      <div
        style={{
          flex: 1,
          backgroundColor: progress >= 3 ? theme.color : "black",
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
        margin: "0 3px",
      }}
    >
      <h3
        style={{
          marginTop: "0",
          fontSize: "1.2rem",
          color: "black",
          marginBottom: "10px",
          textAlign: "left",
        }}
      >
        {pathname === "/start" ? (
          <span>Welcome to Kiwi News! </span>
        ) : (
          <span>Welcome back!</span>
        )}
      </h3>
      {pathname === "/settings" ? (
        <p
          style={{
            fontWeight: "bold",
            color: "black",
            marginBottom: "10px",
            textAlign: "left",
          }}
        >
          Allow your browser to seamlessly interact on your behalf on the
          Optimism network:
        </p>
      ) : props.account && props.account.isConnected ? (
        <p
          style={{
            color: "black",
            marginBottom: "10px",
            textAlign: "left",
          }}
        >
          Please add an application key:
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
      <ul
        style={{
          textAlign: "left",
          listStyle: "none",
          paddingLeft: "0",
          color: "black",
          marginBottom: "35px",
          paddingLeft: "5px",
          fontSize: "0.9rem",
        }}
      >
        <li
          style={{ marginLeft: "14px", textIndent: "-14px", marginTop: "8px" }}
        >
          <span style={{ color: theme.color }}>•</span> Sign messages without
          additional prompts.
        </li>
        <li
          style={{ marginLeft: "14px", textIndent: "-14px", marginTop: "5px" }}
        >
          <span style={{ color: theme.color }}>•</span> <b>Cost:</b> less than
          $0.01 on Optimism
        </li>
        <li
          style={{ marginLeft: "14px", textIndent: "-14px", marginTop: "5px" }}
        >
          <span style={{ color: theme.color }}>•</span> Learn more about this by{" "}
          <a
            style={{ textDecoration: "underline" }}
            href="https://kiwistand.github.io/kiwi-docs/docs/kiwi-how-works/delegation"
            target="_blank"
          >
            reading our docs
          </a>
        </li>
      </ul>
    </div>
  );
};

const address = "0x418910fef46896eb0bfe38f656e2f7df3eca7198"; // Delegator3

// NOTE: This is a performance optimization as `createRandom` causes a notable
// occupation of the main thread of JavaScript to generate the randomness.
// Hence we now call this just-in-time, when the user accesses the value for
// the first time.
let newKey = null;
function getNewKey() {
  if (!newKey) {
    newKey = Wallet.createRandom();
  }
  return newKey;
}
const DelegateButton = (props) => {
  const chainId = useChainId();
  const from = useAccount();
  const { switchChain } = useSwitchChain();
  const [keyName, setKeyName] = useState(null);

  // Extract the style that was coming from the Form wrapper
  const wrapperStyle = {
    border: "1px solid rgba(0,0,0,0.1)",
    backgroundColor: "#E6E6DF",
    maxWidth: "315px",
    display: "inline-block",
    padding: "20px 15px",
    borderRadius: "2px",
    boxShadow: "0 6px 20 rgba(0,0,0,0.1)",
    ...props.style,
  };

  useEffect(() => {
    if (from.address) {
      setKeyName(`-kiwi-news-${getAddress(from.address)}-key`);
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
        getNewKey(),
        from.address,
        getNewKey().address,
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

  const { data: config, error, isError } = useSimulateContract(prepArgs);

  const {
    data,
    writeContract,
    isPending: isLoading,
    isSuccess: isWriteSuccess,
  } = useWriteContract();
  const isSuccess = isWriteSuccess && data && data.hash !== "null";
  if (isSuccess) {
    setKey(getNewKey().privateKey);
  }

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
          const delegations = await fetchDelegations(true);
          if (Object.keys(delegations).includes(wallet.address)) {
            setIndexedDelegation(true);
            clearInterval(intervalId);
            if (props.callback && typeof props.callback === "function") {
              posthog.capture("delegation_performed");
              props.callback();
              // NOTE: We have to reload the page here because the Vote
              // component isn't reloading based on the updates in the
              // localStorage, for example, when we store a new application key
              // there. So we reload the page to fix this.
              window.location.pathname = "/";
            }
          }
        };

        await checkDelegations();
        intervalId = setInterval(checkDelegations, 5000);
      }
      return () => clearInterval(intervalId);
    })();
  }, [key, wallet, from.address, props]);

  const localAccount = getLocalAccount(from.address);

  if (!from.address) {
    return (
      <div style={wrapperStyle}>
        <ProgressBar progress={0} />
        <ConnectionDialogue account={from} />
        <ConnectedConnectButton
          required
          delegations={props.delegations}
        />
      </div>
    );
  }

  if (key && wallet) {
    if (window.location.pathname === "/start") {
      const delegate = key && wallet ? wallet.address : getNewKey().address;
      window.location.href = `/indexing?address=${from.address}&delegate=${delegate}`;
    } else {
      const progress = indexedDelegation ? 3 : 1;
      return (
        <div style={wrapperStyle}>
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
              Thanks! Your key is being added to Optimism (1-2 min).
              <br />
              <br />
              This is so that you can like without having to confirm each time
              in your wallet
              <br />
              <br />
              Redirecting when complete...
            </p>
          ) : (
            <p>
              You can now like, submit and comment without needing to confirm
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
  if (chainId === 10) {
    content = isLoading ? (
      "Please sign in wallet"
    ) : (
      <span>Enable on Optimism</span>
    );
    activity = !writeContract || (!writeContract && !isError) || isLoading || isSuccess;
    handler = () => config && writeContract(config.request);
  } else {
    content = <span>Switch to Optimism</span>;
    activity = false;
    handler = () => switchChain?.({ chainId: 10 });
  }
  return (
    <div style={wrapperStyle}>
      <ConnectionDialogue account={from} />
      {isPersistent ? (
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-evenly",
            gap: "20px",
            alignItems: "center",
          }}
        >
          <button
            style={{
              width: "auto",
              backgroundColor: isLoading ? "grey" : "black",
              border: isLoading ? "1px solid grey" : "1px solid black",
            }}
            className="buy-button"
            id="button-onboarding"
            disabled={activity}
            onClick={handler}
          >
            {content}
          </button>
          <ConnectedSimpleDisconnectButton />
        </div>
      ) : (
        <p>Your browser isn't supporting key storage.</p>
      )}
    </div>
  );
};

export default DelegateButton;
