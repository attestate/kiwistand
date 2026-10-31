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
    chainId,
    key,
    wallet,
    isPersistent,
    isLoading,
    isError,
    isSuccess,
    payload,
    delegate,
    delegateError,
  } = useDelegation(options);

  // NOTE: One button for both cases: delegate() switches the wallet to
  // Optimism first if it's on another chain, then sends the transaction.
  let action;
  if (!isPersistent) {
    action = (
      <ErrorText>Your browser isn’t supporting key storage.</ErrorText>
    );
  } else if (key && wallet) {
    action = (
      <Status
        title="Adding your key on Optimism…"
        hint="This takes 1 to 2 minutes. Keep this open; we continue on our own."
        chain={desk ? "Optimism" : ""}
      />
    );
  } else if (isLoading || isSuccess) {
    action = desk ? (
      <Status
        title="Waiting for wallet confirmation…"
        hint="Open your wallet app to approve, then return here."
        chain="Optimism"
      />
    ) : (
      <Status
        title="Confirm in your wallet"
        hint="Approve the transaction in your wallet app, then come back."
      />
    );
  } else {
    action = (
      <>
        <div className="kob-actions">
          <button
            type="button"
            className="kob-btn"
            disabled={!payload}
            onClick={delegate}
          >
            Approve in wallet
          </button>
        </div>
        {chainId !== 10 && !delegateError && (
          <p className="kob-helper">Your wallet switches to Optimism first.</p>
        )}
        {delegateError ? (
          <ErrorText>{delegateError}</ErrorText>
        ) : (
          isError &&
          chainId === 10 && (
            <ErrorText>
              Couldn’t prepare the transaction. You need a little ETH on
              Optimism for the network fee.
            </ErrorText>
          )
        )}
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
            Approve once on Optimism. Only network fees apply; no funds are
            moved.
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
            Your wallet approves it once with a free-of-value transaction on
            Optimism (only network fees apply).
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
