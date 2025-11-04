import {
  useSimulateContract,
  useWriteContract,
  useAccount,
  useChainId,
  useSwitchChain,
} from "wagmi";
import posthog from "posthog-js";
import React, { useMemo, useEffect, useState } from "react";
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
          backgroundColor: progress >= 0 ? theme.color : "var(--text-secondary)",
        }}
      ></div>
      <div
        style={{
          flex: 1,
          backgroundColor: progress >= 1 ? theme.color : "var(--text-secondary)",
        }}
      ></div>
      <div
        style={{
          flex: 1,
          backgroundColor: progress >= 2 ? theme.color : "var(--text-secondary)",
        }}
      ></div>
      <div
        style={{
          flex: 1,
          backgroundColor: progress >= 3 ? theme.color : "var(--text-secondary)",
        }}
      ></div>
    </div>
  );
};

const SparkleIcon = () => (
  <svg viewBox="0 0 256 256" width="1.2em" height="1.2em" style={{ width: "18px", height: "18px" }}>
    <path fill="currentColor" d="m230.86 109.25l-61.68-22.43l-22.43-61.68a19.95 19.95 0 0 0-37.5 0L86.82 86.82l-61.68 22.43a19.95 19.95 0 0 0 0 37.5l61.68 22.43l22.43 61.68a19.95 19.95 0 0 0 37.5 0l22.43-61.68l61.68-22.43a19.95 19.95 0 0 0 0-37.5m-75.14 39.29a12 12 0 0 0-7.18 7.18L128 212.21l-20.54-56.49a12 12 0 0 0-7.18-7.18L43.79 128l56.49-20.54a12 12 0 0 0 7.18-7.18L128 43.79l20.54 56.49a12 12 0 0 0 7.18 7.18L212.21 128Z"></path>
  </svg>
);

const ConnectionDialogue = (props) => {
  const { pathname } = window.location;
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      {/* Porto-style title section */}
      <div style={{ display: "flex", flexDirection: "column", padding: "12px 12px 8px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", paddingBottom: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              backgroundColor: "var(--color-porto-bg)",
              color: "var(--color-porto-blue)",
            }}>
              <SparkleIcon />
            </div>
            <div style={{ fontSize: "18px", fontWeight: "500", color: "var(--text-primary)" }}>
              {pathname === "/start" ? "Welcome to Kiwi News!" : "Setup delegation"}
            </div>
          </div>
        </div>
      </div>

      {/* Porto-style content section */}
      <div style={{ flexGrow: 1, padding: "0 12px 12px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ fontSize: "15px", color: "var(--text-primary)", lineHeight: "22px" }}>
            {pathname === "/settings"
              ? "Allow your browser to seamlessly interact on your behalf on the Optimism network"
              : props.account && props.account.isConnected
              ? "Add an application key to interact without wallet prompts"
              : "Connect the wallet that received the Kiwi Pass NFT"
            }
          </div>
        </div>
      </div>
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

  // Porto-style wrapper
  const wrapperStyle = {
    backgroundColor: "transparent",
    maxWidth: "100%",
    width: "100%",
    display: "flex",
    flexDirection: "column",
    padding: "0",
    borderRadius: "0",
    boxShadow: "none",
    border: "none",
    fontSize: "15px",
    lineHeight: "1.325",
    fontFamily: "ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'",
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
  const [isButtonHovered, setIsButtonHovered] = useState(false);
  const [isButtonActive, setIsButtonActive] = useState(false);

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
    // Notify parent that we're not in indexing state
    if (props.onIndexingStateChange) {
      props.onIndexingStateChange(false);
    }

    return (
      <div style={wrapperStyle}>
        <ConnectionDialogue account={from} />
        <div style={{ padding: "0 12px 12px" }}>
          <ConnectedConnectButton
            required
            delegations={props.delegations}
          />
        </div>
      </div>
    );
  }

  if (key && wallet) {
    if (window.location.pathname === "/start") {
      const delegate = key && wallet ? wallet.address : getNewKey().address;
      window.location.href = `/indexing?address=${from.address}&delegate=${delegate}`;
    } else {
      // Notify parent that we're in indexing state
      if (props.onIndexingStateChange) {
        props.onIndexingStateChange(true);
      }

      return (
        <div style={wrapperStyle}>
          {/* Porto-style success/loading state */}
          <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
            <div style={{ display: "flex", flexDirection: "column", padding: "12px 12px 8px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", paddingBottom: "4px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    backgroundColor: "var(--color-porto-bg)",
                    color: "var(--color-porto-blue)",
                  }}>
                    <SparkleIcon />
                  </div>
                  <div style={{ fontSize: "18px", fontWeight: "500", color: "var(--text-primary)" }}>
                    {indexedDelegation
                      ? "Connection successful!"
                      : "Indexing your connection..."}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ flexGrow: 1, padding: "0 12px 12px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ fontSize: "15px", color: "var(--text-primary)", lineHeight: "22px" }}>
                  {!indexedDelegation ? (
                    <>
                      Thanks! Your key is being added to Optimism (1-2 min).
                      This allows you to interact without wallet prompts.
                      <br /><br />
                      Redirecting when complete...
                    </>
                  ) : (
                    <>
                      You can now like, submit and comment without needing to confirm
                      the signing manually in your wallet!
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
  }
  const FaceIdIcon = () => (
    <svg width="1.2em" height="1.2em" viewBox="0 0 21 22" fill="none" xmlns="http://www.w3.org/2000/svg" className="size-5.25">
      <path d="M6.125 3.125H4.375C3.4085 3.125 2.625 3.9085 2.625 4.875V6.625" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
      <path d="M14.875 3.125H16.625C17.5915 3.125 18.375 3.9085 18.375 4.875V6.625" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
      <path d="M14 7.5V9.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
      <path d="M7 7.5V9.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
      <path d="M7.875 14.5C7.875 14.5 8.75 15.375 10.5 15.375C12.25 15.375 13.125 14.5 13.125 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
      <path d="M10.5 7.5V11.875H9.625" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
      <path d="M6.125 18.875H4.375C3.4085 18.875 2.625 18.0915 2.625 17.125V15.375" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
      <path d="M14.875 18.875H16.625C17.5915 18.875 18.375 18.0915 18.375 17.125V15.375" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
    </svg>
  );

  let content;
  let activity;
  let handler;
  if (chainId === 10) {
    content = isLoading ? (
      "Please sign in wallet"
    ) : (
      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <FaceIdIcon />
        Enable
      </span>
    );
    activity = !writeContract || (!writeContract && !isError) || isLoading || isSuccess;
    handler = () => config && writeContract(config.request);
  } else {
    content = <span>Switch to Optimism</span>;
    activity = false;
    handler = () => switchChain?.({ chainId: 10 });
  }
  // Notify parent that we're not in indexing state (showing delegation button)
  if (props.onIndexingStateChange) {
    props.onIndexingStateChange(false);
  }

  return (
    <div style={wrapperStyle}>
      <ConnectionDialogue account={from} />
      {isPersistent ? (
        <>
          {/* Porto-style button footer */}
          <div style={{
            display: "flex",
            minHeight: "48px",
            width: "100%",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            paddingBottom: "12px",
          }}>
            <div style={{
              display: "flex",
              width: "100%",
              gap: "8px",
            }}>
              <button
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: 1,
                  height: "38px",
                  backgroundColor: isLoading
                    ? "var(--bg-hover)"
                    : isButtonHovered && !activity
                    ? "var(--accent-primary-hover)"
                    : "var(--accent-primary)",
                  border: isLoading
                    ? "1px solid var(--bg-hover)"
                    : isButtonHovered && !activity
                    ? "1px solid var(--accent-primary-hover)"
                    : "1px solid var(--accent-primary)",
                  color: "var(--text-primary)",
                  borderRadius: "8px",
                  fontSize: "15px",
                  fontWeight: "normal",
                  cursor: activity ? "default" : "pointer",
                  opacity: activity ? 0.6 : 1,
                  transform: isButtonActive && !activity ? "translateY(1px)" : "translateY(0)",
                  transition: "background-color 0.15s ease, border-color 0.15s ease, transform 0.05s ease",
                  margin: "0 16px",
                  whiteSpace: "nowrap",
                }}
                id="button-onboarding"
                disabled={activity}
                onClick={handler}
                onMouseEnter={() => setIsButtonHovered(true)}
                onMouseLeave={() => {
                  setIsButtonHovered(false);
                  setIsButtonActive(false);
                }}
                onMouseDown={() => setIsButtonActive(true)}
                onMouseUp={() => setIsButtonActive(false)}
              >
                <div style={{ display: "flex", alignItems: "center", height: "100%", gap: "8px" }}>
                  {content}
                </div>
              </button>
            </div>

            {/* Account section */}
            <div style={{
              display: "flex",
              height: "100%",
              width: "100%",
              boxSizing: "border-box",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: "var(--border-subtle)",
              padding: "12px 4px 0",
            }}>
              <div style={{ fontSize: "13px", color: "var(--text-tertiary)" }}>Account</div>
              <button
                disabled
                type="button"
                style={{
                  margin: "-4px -8px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  borderRadius: "8px",
                  padding: "4px 8px",
                  background: "transparent",
                  border: "none",
                  cursor: "default",
                }}
              >
                <div
                  style={{
                    fontWeight: "500",
                    fontSize: "14px",
                    color: "var(--text-primary)"
                  }}
                  title={from.address}
                >
                  {from.address ? `${from.address.slice(0, 6)}…${from.address.slice(-6)}` : ""}
                </div>
              </button>
            </div>
          </div>
        </>
      ) : (
        <div style={{ padding: "12px", fontSize: "15px", color: "var(--text-tertiary)" }}>
          Your browser isn't supporting key storage.
        </div>
      )}
    </div>
  );
};

export default DelegateButton;
