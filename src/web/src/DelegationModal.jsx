import { useEffect, useImperativeHandle, forwardRef } from "react";
import { useAccount } from "wagmi";
import { resolveIdentity } from "@attestate/delegator2";

import { getLocalAccount } from "./session.mjs";

// NOTE: A connected wallet without a key in this browser is asked to enable
// one-tap actions (the delegation). This used to be its own dialog ("Setup
// delegation", with DelegateButton.jsx); it's now the onboarding's "Enable
// one-tap actions" step (onboarding/Delegate.jsx), opened on its own, so
// there is one look and one code path for it. It opens once per wallet on
// connect ("Not now" or closing it is remembered) and again whenever an
// action needs the key (openModalForAction, delegationModalManager.js).
const DelegationPrompt = forwardRef((props, ref) => {
  const account = useAccount();
  const { delegations } = props;

  const dismissedKey = `delegation-modal-dismissed-${account.address}`;

  async function open(forceOpen = false) {
    // The onboarding already shows this step itself.
    if (window.kiwiOnboardingOpen) return;
    if (!account.isConnected || !account.address) return;

    // Prompt on its own only on the main pages and story pages.
    if (!forceOpen) {
      const allowedPaths = ["/", "/new", "/submit", "/best"];
      const { pathname } = window.location;
      if (!allowedPaths.includes(pathname) && !pathname.startsWith("/stories"))
        return;
    }

    const isEligible = resolveIdentity(delegations, account.address);
    if (!isEligible || getLocalAccount(account.address)) return;
    let wasDismissed = false;
    try {
      wasDismissed = localStorage.getItem(dismissedKey) === "true";
    } catch (err) {}
    if (!forceOpen && wasDismissed) return;

    const { openOnboarding } = await import("./LoginModal.jsx");
    const address = account.address;
    openOnboarding({
      start: "delegate",
      onClose: () => {
        try {
          localStorage.setItem(`delegation-modal-dismissed-${address}`, "true");
        } catch (err) {}
      },
    });
  }

  useEffect(() => {
    open();
  }, [account.address, account.isConnected]);

  useImperativeHandle(ref, () => ({
    openModalForAction: () => open(true),
  }));

  return null;
});

DelegationPrompt.displayName = "DelegationPrompt";

export default DelegationPrompt;
