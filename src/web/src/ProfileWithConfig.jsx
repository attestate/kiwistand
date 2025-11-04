import React from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { client, chains } from "./client.mjs";
import ProfileDisplay from "./ProfileDisplay.jsx";

const queryClient = new QueryClient();

const ProfileWithConfig = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={client}>
        <RainbowKitProvider chains={chains}>
          <ProfileDisplay />
        </RainbowKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
};

export default ProfileWithConfig;