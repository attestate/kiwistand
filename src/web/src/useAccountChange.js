import { useEffect, useState } from "react";

import { ACCOUNT_CHANGE_EVENT } from "./session.mjs";

// NOTE: Re-renders the component after a login without a page load
// (announceAccountChange in session.mjs), for components that read the
// account from localStorage while they render (Vote.jsx, Bell.jsx).
export default function useAccountChange() {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    window.addEventListener(ACCOUNT_CHANGE_EVENT, bump);
    return () => window.removeEventListener(ACCOUNT_CHANGE_EVENT, bump);
  }, []);
  return version;
}
