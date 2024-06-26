import React, { useEffect, useState } from "react";

import { WagmiConfig, useAccount } from "wagmi";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";

import { getLocalAccount } from "./session.mjs";
import { client, chains } from "./client.mjs";
import { isIOS, isRunningPWA } from "./session.mjs";

const applicationServerKey =
  "BPvx125qWbQM3is_MalYYbhGzzbC4NAJx7Ei1lfNZiz4gr50iYxs0Q5Ns5gNmo9H-CMDi_oLLSyHRKX_AhSlPsU";
const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

const SubscriptionButton = (props) => {
  const from = useAccount();
  let address;
  const localAccount = getLocalAccount(from.address, props.allowlist);
  if (from.isConnected) {
    address = from.address;
  }
  if (localAccount) {
    address = localAccount.identity;
  }

  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  useEffect(() => {
    async function getSubscription() {
      if ("serviceWorker" in navigator && "PushManager" in window) {
        const registration = await navigator.serviceWorker.ready;
        if (!registration) setIsSubscribed(false);
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      } else {
        setIsSubscribed(false);
      }
    }
    getSubscription();
  });

  const handlePushSubscription = async () => {
    const registration = await navigator.serviceWorker.register(
      "/serviceWorker.js",
    );
    setIsRegistered(true);
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(applicationServerKey),
    });

    await fetch(`/api/v1/subscriptions/${address}`, {
      method: "POST",
      body: JSON.stringify(subscription),
      headers: {
        "Content-Type": "application/json",
      },
    });
  };

  if (
    (isIOS() && !isRunningPWA()) ||
    isRegistered ||
    isSubscribed ||
    !address ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  )
    return;
  return (
    <div>
      {props.wrapper ? (
        <div
          className="notification-bar"
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            height: "40px",
            padding: "0.75rem 0",
            width: "100%",
            backgroundColor: "#e6e6df",
            borderTop: "1px solid #828282",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 99,
          }}
        >
          <button
            style={{ width: "auto" }}
            id="button-onboarding"
            onClick={handlePushSubscription}
          >
            Enable Push Notifications
          </button>
        </div>
      ) : (
        <button
          style={{ width: "auto" }}
          id="button-onboarding"
          onClick={handlePushSubscription}
        >
          Enable Push Notifications
        </button>
      )}
    </div>
  );
};

const Form = (props) => {
  return (
    <WagmiConfig config={client}>
      <RainbowKitProvider chains={chains}>
        <SubscriptionButton {...props} />
      </RainbowKitProvider>
    </WagmiConfig>
  );
};

export default Form;
