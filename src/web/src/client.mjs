// @format
import * as React from "react";
import {
  Web3Provider,
  FallbackProvider,
  JsonRpcProvider,
} from "@ethersproject/providers";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { getPublicClient } from "@wagmi/core";
import {
  createConfig,
  http,
  useClient,
  useConnectorClient,
  createConnector,
} from "wagmi";
import { mainnet, optimism, base, arbitrum } from "wagmi/chains";
import { createWalletClient, custom, getAddress } from "viem";
import { IOSWalletProvider } from "./iosWalletProvider";
import {
  injectedWallet,
  walletConnectWallet,
  safeWallet,
  coinbaseWallet,
  metaMaskWallet,
  trustWallet,
  braveWallet,
  rainbowWallet,
} from "@rainbow-me/rainbowkit/wallets";

// Check if we're in the iOS app by looking for the CSS class
export const isInIOSApp =
  typeof document !== "undefined" &&
  document.documentElement.classList.contains("kiwi-ios-app");

// Check if we're in a Farcaster Frame context
export const isInFarcasterFrame = () => {
  if (typeof window === "undefined") return false;
  
  // Check for Farcaster-specific properties
  try {
    const isFarcasterConnected = window?.ethereum?.isFarcaster === true;
    // Also check if we have farcaster SDK available
    return isFarcasterConnected || (typeof window?.Farcaster !== 'undefined');
  } catch {
    return false;
  }
};

const isDesktop = () => {
  return (
    !("ontouchstart" in window || navigator.maxTouchPoints) &&
    window.innerWidth > 800
  );
};

// Custom iOS Wallet Connector for wagmi v2
function iosWalletConnector() {
  return createConnector((config) => ({
    id: "iosCoinbaseWallet",
    name: "Coinbase Wallet",
    type: "iosCoinbaseWallet",
    
    async setup() {
      // Initialization logic if needed
    },

    async connect({ chainId } = {}) {
      const provider = new IOSWalletProvider();
      try {
        const accounts = await provider.request({
          method: "eth_requestAccounts",
        });
        const account = getAddress(accounts[0]);

        // The iOS wallet provider is assumed to connect to Optimism by default.
        const connectedChainId = 10; // Optimism ID
        
        return {
          accounts: [account],
          chainId: connectedChainId,
        };
      } catch (error) {
        throw error;
      }
    },

    async disconnect() {
      // Nothing to do since iOS app handles connection
      return;
    },

    async getAccounts() {
      const provider = new IOSWalletProvider();
      const accounts = await provider.request({ method: "eth_accounts" });
      return accounts.map(a => getAddress(a));
    },

    async getChainId() {
      return 10; // Default to Optimism (10)
    },

    async getProvider() {
      return new IOSWalletProvider();
    },

    async isAuthorized() {
      try {
        const provider = new IOSWalletProvider();
        const accounts = await provider.request({ method: "eth_accounts" });
        return accounts.length > 0;
      } catch {
        return false;
      }
    },

    async switchChain({ chainId }) {
      // If the requested chain is Optimism (10), "switch" to it.
      if (chainId === 10) {
        return optimism;
      }
      // For other chains, throw an error indicating this iOS wallet only supports Optimism
      throw new Error("This wallet connection only supports Optimism");
    },

    onAccountsChanged(accounts) {
      // Handle account changes
      config.emitter.emit('change', { accounts: accounts.map(a => getAddress(a)) });
    },

    onChainChanged(chainId) {
      const id = Number(chainId);
      config.emitter.emit('change', { chainId: id });
    },

    onDisconnect() {
      config.emitter.emit('disconnect');
    },
  }));
}

// Setup chains
export const chains = [optimism, mainnet, arbitrum, base];
const projectId = "cd46d2fcf6d171fb7c017129868fa211";
const appName = "Kiwi News";

// Configure transports for each chain
const transports = {
  [optimism.id]: http('https://opt-mainnet.g.alchemy.com/v2/TfAhzs116ThO7Fwod1gzpTJmH0Cudxp7'),
  [mainnet.id]: http('https://eth-mainnet.g.alchemy.com/v2/TfAhzs116ThO7Fwod1gzpTJmH0Cudxp7'),
  [arbitrum.id]: http('https://arb-mainnet.g.alchemy.com/v2/TfAhzs116ThO7Fwod1gzpTJmH0Cudxp7'),
  [base.id]: http('https://base-mainnet.g.alchemy.com/v2/TfAhzs116ThO7Fwod1gzpTJmH0Cudxp7'),
};

// Create wagmi config based on environment
let client;

if (isInIOSApp) {
  // iOS app configuration with custom connector
  const connectors = [iosWalletConnector()];
  
  // Add Farcaster connector if in frame
  if (isInFarcasterFrame()) {
    connectors.unshift(farcasterMiniApp());
  }
  
  client = createConfig({
    chains,
    connectors,
    transports,
  });
} else if (isInFarcasterFrame()) {
  // Farcaster frame configuration
  client = createConfig({
    chains,
    connectors: [farcasterMiniApp()],
    transports,
  });
} else {
  // Standard configuration using RainbowKit's getDefaultConfig
  client = getDefaultConfig({
    appName,
    projectId,
    chains,
    transports,
  });
}

export { client };

// Helper functions for ethers compatibility
export function publicClientToProvider(publicClient) {
  if (!publicClient) return undefined;
  const { chain, transport } = publicClient;
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };
  if (transport.type === "fallback")
    return new FallbackProvider(
      transport.transports.map(
        ({ value }) => new JsonRpcProvider(value?.url, network),
      ),
    );
  return new JsonRpcProvider(transport.url, network);
}

export function getProvider({ chainId } = {}) {
  const publicClient = getPublicClient(client, { chainId });
  return publicClientToProvider(publicClient);
}

export function useProvider({ chainId } = {}) {
  const publicClient = useClient({ chainId });
  return React.useMemo(
    () => publicClientToProvider(publicClient),
    [publicClient],
  );
}

export function walletClientToSigner(walletClient) {
  if (!walletClient) return undefined;
  const { account, chain, transport } = walletClient;
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };
  const provider = new Web3Provider(transport, network);
  const signer = provider.getSigner(account.address);
  return signer;
}

export function useSigner({ chainId } = {}) {
  const { data: walletClient } = useConnectorClient({ chainId });
  return React.useMemo(
    () => (walletClient ? walletClientToSigner(walletClient) : undefined),
    [walletClient],
  );
}