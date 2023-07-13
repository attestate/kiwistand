// @format
import { getDefaultWallets } from "@rainbow-me/rainbowkit";
import { createClient, configureChains, WagmiConfig } from "wagmi";
import { alchemyProvider } from "wagmi/providers/alchemy";
import { mainnet, optimism } from "wagmi/chains";

const config = configureChains(
  [mainnet, optimism],
  [alchemyProvider({ apiKey: "3ZBBnBhNn0nMmNcdgXFpqWqC981hd1Z2" })]
);

export const chains = config.chains;

const { connectors } = getDefaultWallets({
  appName: "Kiwi News",
  projectId: "cd46d2fcf6d171fb7c017129868fa211",
  chains,
});

export const client = createClient({
  autoConnect: true,
  connectors,
  provider: config.provider,
});
