import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { KiwiWagmiProvider } from "./KiwiWagmiProvider.jsx";

// Create a single QueryClient instance
const queryClient = new QueryClient();

export function Providers({ children }) {
  // In anon mode, skip RainbowKit to avoid Coinbase analytics tracking
  const isAnonMode = typeof localStorage !== 'undefined' && localStorage.getItem('anon-mode') === 'true';

  // reconnectOnMount={false} defers wagmi's connector setup (which
  // triggers WalletConnect's 495KB dynamic import) from the initial
  // mount phase. Reconnection is triggered manually in main.jsx start()
  // after the page has rendered, reducing TBT.
  if (isAnonMode) {
    return (
      <QueryClientProvider client={queryClient}>
        <KiwiWagmiProvider>
          {children}
        </KiwiWagmiProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <KiwiWagmiProvider>
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </KiwiWagmiProvider>
    </QueryClientProvider>
  );
}