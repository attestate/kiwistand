import React, {
  Suspense,
  forwardRef,
  lazy,
  useEffect,
  useImperativeHandle,
} from "react";
import { createRoot } from "react-dom/client";

import { Providers } from "./providers.jsx";

// NOTE: "Log In" anywhere on the site opens the onboarding: Welcome → Join
// (create a passkey account, sign in with a passkey or connect a wallet) →
// … (see onboarding/Onboarding.jsx). It's loaded only when it opens, so
// pages that render this (Vote, Bell, CommentInput) stay small.
// The stylesheet is its own import so it gets a stable name in the build
// manifest (scripts/pagespeed/bundle-budgets.json).
const Onboarding = lazy(() =>
  Promise.allSettled([
    import("./onboarding/Onboarding.jsx"),
    import("./onboarding/onboarding.css"),
  ]).then(([module]) => {
    if (module.status === "rejected") throw module.reason;
    return module.value;
  }),
);

// NOTE: The onboarding gets its own React root, like the site's other
// islands (main.jsx), instead of living inside the component that opened
// it: Bell.jsx swaps its "Log In" button for something else as soon as a
// wallet connects, which would otherwise close the onboarding right before
// "Enable one-tap actions".
let open = null;

function show(onClose) {
  if (open) return;
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const close = () => {
    if (open !== close) return;
    open = null;
    root.unmount();
    host.remove();
    if (onClose) onClose();
  };
  open = close;
  root.render(
    <Providers>
      <Suspense fallback={null}>
        <Onboarding onClose={close} />
      </Suspense>
    </Providers>,
  );
}

function hide() {
  if (open) open();
}

const LoginModal = forwardRef((props, ref) => {
  useEffect(() => {
    if (props.defaultOpen) show(props.onClose);
  }, []);

  useImperativeHandle(ref, () => ({
    openModal: () => show(props.onClose),
    closeModal: hide,
  }));

  return null;
});

LoginModal.displayName = "LoginModal";

export default LoginModal;
