import React, { Suspense, lazy, useState } from "react";

// NOTE: A "Log in" button that opens LoginModal (the login/onboarding), which
// is big (passkeys, wallets), so it loads on the first click. Used on the
// logged-out notifications page (<kiwi-login-button>, main.jsx) and in
// Settings.
const LoginModal = lazy(() => import("./LoginModal.jsx"));

export default function LoginButton({
  className,
  children,
  delegations,
  toast,
  onOpen,
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          if (onOpen) onOpen();
          setOpen(true);
        }}
      >
        {children || "Log in"}
      </button>
      {open && (
        <Suspense fallback={null}>
          <LoginModal
            defaultOpen={true}
            delegations={delegations}
            toast={toast}
            onClose={() => setOpen(false)}
          />
        </Suspense>
      )}
    </>
  );
}
