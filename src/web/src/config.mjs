// @format
import { mainnet, createConfig, configureChains } from "wagmi";
import { alchemyProvider } from "wagmi/providers/alchemy";
import { getDefaultConfig } from "connectkit";
import { createPublicClient, http } from "viem";

const config = createConfig(
  getDefaultConfig({
    appName: "Kiwi News",
    alchemyId: "3ZBBnBhNn0nMmNcdgXFpqWqC981hd1Z2",
    walletConnectProjectId: "cd46d2fcf6d171fb7c017129868fa211",
  })
);
export default config;
