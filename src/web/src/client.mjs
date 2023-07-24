// @format
import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import { createClient, configureChains, WagmiConfig } from "wagmi";
import { alchemyProvider } from "wagmi/providers/alchemy";
import { optimism, mainnet } from "wagmi/chains";
import {
  injectedWallet,
  walletConnectWallet,
  coinbaseWallet,
  braveWallet,
  metaMaskWallet,
  safeWallet,
} from "@rainbow-me/rainbowkit/wallets";

const config = configureChains(
  [optimism, mainnet],
  [alchemyProvider({ apiKey: "3ZBBnBhNn0nMmNcdgXFpqWqC981hd1Z2" })]
);

export const chains = config.chains;

const appName = "Kiwi News";
const projectId = "cd46d2fcf6d171fb7c017129868fa211";
const connectors = connectorsForWallets([
  {
    groupName: "Recommended",
    wallets: [
      injectedWallet({ chains }),
      metaMaskWallet({ chains, projectId }),
      walletConnectWallet({
        chains,
        projectId,
      }),
      coinbaseWallet({ appName, chains }),
      braveWallet({ chains }),
    ],
  },
]);

export const client = createClient({
  autoConnect: true,
  connectors,
  provider: config.provider,
});
