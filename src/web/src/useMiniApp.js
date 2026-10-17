import { useSyncExternalStore } from "react";

import { getMiniApp, subscribeMiniApp } from "./miniapp.mjs";

// The Farcaster mini app state (miniapp.mjs) for React: { isMiniApp, wallet }.
export function useMiniApp() {
  return useSyncExternalStore(subscribeMiniApp, getMiniApp, getMiniApp);
}
