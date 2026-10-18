import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { KiwiWagmiProvider } from "./KiwiWagmiProvider.jsx";

// Create a single QueryClient instance
const queryClient = new QueryClient();

export function Providers({ children }) {
  // reconnectOnMount={false} defers wagmi's connector setup (which
  // triggers WalletConnect's 495KB dynamic import) from the initial
  // mount phase. Reconnection is triggered manually in main.jsx start()
  // after the page has rendered, reducing TBT.
  return (
    <QueryClientProvider client={queryClient}>
      <KiwiWagmiProvider>
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </KiwiWagmiProvider>
    </QueryClientProvider>
  );
}