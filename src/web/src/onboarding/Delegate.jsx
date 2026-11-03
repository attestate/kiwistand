import React, { useMemo } from "react";

import { useDelegation } from "../DelegateButton.jsx";
import { Icon, Tile, Heading, Skip, Status, ErrorText } from "./ui.jsx";

// Loaded only on the "I have a wallet" path, so the passkey path doesn't
// download the delegation code.

// "Enable one-tap actions": the delegation (useDelegation in
// DelegateButton.jsx) with the onboarding's look. onIndexed runs once the
// new key is indexed.
export default function DelegateStep({ desk, onIndexed, onSkip }) {
  const options = useMemo(() => ({ onIndexed }), [onIndexed]);
  const {
    key,
    wallet,
    isPersistent,
    isLoading,
    isSuccess,
    ready,
    delegate,
    delegateError,
  } = useDelegation(options);

  // NOTE: One button: delegate() asks the wallet for one signature, on any
  // chain, and sends it to the node.
  let action;
  if (!isPersistent) {
    action = (
      <ErrorText>Your browser isn’t supporting key storage.</ErrorText>
    );
  } else if (key && wallet) {
    action = (
      <Status
        title="Adding your key…"
        hint="This takes a few seconds. Keep this open; we continue on our own."
      />
    );
  } else if (isLoading || isSuccess) {
    action = desk ? (
      <Status
        title="Waiting for wallet confirmation…"
        hint="Open your wallet app to sign, then return here."
      />
    ) : (
      <Status
        title="Confirm in your wallet"
        hint="Sign the message in your wallet app, then come back."
      />
    );
  } else {
    action = (
      <>
        <div className="kob-actions">
          <button
            type="button"
            className="kob-btn"
            disabled={!ready}
            onClick={delegate}
          >
            Approve in wallet
          </button>
        </div>
        <ErrorText>{delegateError}</ErrorText>
      </>
    );
  }

  return (
    <>
      <Tile icon="hand-pointing" desk={desk} />
      {desk ? (
        <Heading title="Enable one-tap actions">
          <p>
            Like and comment without confirming every action in your wallet.
            Approve once with a signature. It’s free: no transaction, no
            funds are moved.
          </p>
        </Heading>
      ) : (
        <Heading
          title={
            <>
              Enable
              <br />
              one-tap actions
            </>
          }
        >
          <p>
            So you don’t have to confirm every like and comment in your
            wallet, Kiwi News creates a key in this browser.
          </p>
          <p>
            Your wallet approves it once with a signature. It’s free: no
            transaction, no network fees.
          </p>
          <p>No funds are moved.</p>
        </Heading>
      )}
      {desk && (
        <a
          className="kob-howto"
          href="/docs/delegation"
          target="_blank"
          rel="noopener noreferrer"
        >
          How it works
          <Icon name="arrow-up-right" size={13} />
        </a>
      )}
      {action}
      <Skip
        desk={desk}
        label="Not now"
        deskLabel="Skip for now"
        onClick={onSkip}
      />
    </>
  );
}
