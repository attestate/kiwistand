import React from "react";
import { WagmiContext, WagmiProvider } from "wagmi";

import { client } from "./client.mjs";

// NOTE: Each island on the page is its own React root with its own wagmi
// provider (Providers, Vote, CommentInput, ...). wagmi's WagmiProvider with reconnectOnMount={false} clears
// the config's connections every time one mounts (wagmi's hydrate.js: it
// drops connections restored from storage, because we reconnect ourselves
// in main.jsx). That's right once, at page load, but a root that mounts
// later (the onboarding, which has its own root since the redesign, a
// lazily mounted island, ...) wiped the live wallet connection: useAccount
// still said "connected" but without an address, and the delegation's
// writeContract failed with "Connector not connected", unnoticed. So only
// the first Providers on the page hydrates; later ones just hand the same
// config to wagmi's hooks.
let hydrated = false;

export function KiwiWagmiProvider({ children }) {
  const [first] = React.useState(() => !hydrated);
  hydrated = true;
  if (!first) {
    return (
      <WagmiContext.Provider value={client}>{children}</WagmiContext.Provider>
    );
  }
  return (
    <WagmiProvider config={client} reconnectOnMount={false}>
      {children}
    </WagmiProvider>
  );
}
