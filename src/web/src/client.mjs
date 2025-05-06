// @format
import * as React from "react";
import {
  Web3Provider,
  FallbackProvider,
  JsonRpcProvider,
} from "@ethersproject/providers";
import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import { getPublicClient } from "@wagmi/core";
import {
  createConfig,
  configureChains,
  usePublicClient,
  useWalletClient,
} from "wagmi";
import { mainnet, optimism, base, arbitrum } from "wagmi/chains";
import { alchemyProvider } from "wagmi/providers/alchemy";
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
import { Connector } from "wagmi";
import { createWalletClient, custom } from "viem";
import { IOSWalletProvider } from "./iosWalletProvider";

// Proper wagmi connector implementation for iOS wallet
class IOSWalletConnector extends Connector {
  id = "iosCoinbaseWallet";
  name = "Coinbase Wallet";
  ready = true;

  constructor({ chains, options }) {
    super({ chains, options });
    this.provider = new IOSWalletProvider();
  }

  async connect({ chainId } = {}) {
    try {
      const accounts = await this.provider.request({
        method: "eth_requestAccounts",
      });
      const account = accounts[0];

      // The iOS wallet provider is assumed to connect to Optimism by default.
      const connectedChainId = 10; // Optimism ID
      const chain = this.chains.find((c) => c.id === connectedChainId);

      if (!chain) {
        console.warn(
          `IOSWalletConnector: Optimism chain (ID ${connectedChainId}) not found in configured chains. Using minimal chain object for connect.`,
        );
        return {
          account,
          chain: { id: connectedChainId, unsupported: false },
          provider: this.provider,
        };
      }

      return {
        account,
        chain, // Return the full chain object
        provider: this.provider,
      };
    } catch (error) {
      throw error;
    }
  }

  async disconnect() {
    // Nothing to do since iOS app handles connection
    return;
  }

  async getAccount() {
    const accounts = await this.provider.request({ method: "eth_accounts" });
    return accounts[0];
  }

  async getChainId() {
    return 10; // Default to Optimism (10)
  }

  async getProvider({ chainId } = {}) {
    return this.provider;
  }

  async getWalletClient({ chainId } = {}) {
    const [account, provider] = await Promise.all([
      this.getAccount(),
      this.getProvider({ chainId }),
    ]);
    const targetChainId = chainId || 10; // Default to Optimism
    const chain = this.chains.find((c) => c.id === targetChainId);

    if (!chain) {
      console.warn(
        `IOSWalletConnector: Chain with ID ${targetChainId} not found in connector's configured chains. Using minimal chain object for getWalletClient.`,
      );
      return createWalletClient({
        account,
        chain: { id: targetChainId, unsupported: false }, // Minimal chain object as fallback
        transport: custom(provider),
      });
    }

    return createWalletClient({
      account,
      chain, // Use the full chain object
      transport: custom(provider),
    });
  }

  async isAuthorized() {
    try {
      const accounts = await this.provider.request({ method: "eth_accounts" });
      return accounts.length > 0;
    } catch {
      return false;
    }
  }

  // This is called when switching chains
  async switchChain(chainId) {
    // If the requested chain is Optimism (10), "switch" to it.
    if (chainId === 10) {
      const targetChain = this.chains.find((x) => x.id === chainId);
      if (!targetChain) {
        console.error(
          `IOSWalletConnector: Optimism chain (ID 10) not found in connector's configured chains during switchChain.`,
        );
        throw new Error(
          `Configuration error: Optimism chain (ID 10) not found.`,
        );
      }
      // Notify wagmi of the "change". Wagmi expects the connector to handle this.
      this.emit("change", {
        chain: { id: targetChain.id, unsupported: false },
      });
      return targetChain; // Return the full chain object
    }

    // For other chains, throw an error indicating this iOS wallet only supports Optimism
    throw new Error("This wallet connection only supports Optimism");
  }

  onAccountsChanged(accounts) {
    if (accounts.length === 0) {
      this.emit("disconnect");
    } else {
      this.emit("change", { account: accounts[0] });
    }
  }

  onChainChanged(chainId) {
    const id = Number(chainId);
    const unsupported = this.isChainUnsupported(id);
    this.emit("change", { chain: { id, unsupported } });
  }

  onDisconnect(error) {
    this.emit("disconnect");
  }
}
//import { infuraProvider } from "wagmi/providers/infura";

const config = configureChains(
  [optimism, mainnet, arbitrum, base],
  [alchemyProvider({ apiKey: "TfAhzs116ThO7Fwod1gzpTJmH0Cudxp7" })],
  //[infuraProvider({ apiKey: "ddb924190df54c22a268ae7671ed0f55" })],
);

export const chains = config.chains;
const projectId = "cd46d2fcf6d171fb7c017129868fa211";
const appName = "Kiwi News";

// Check if we're in the iOS app by looking for the CSS class
export const isInIOSApp =
  typeof document !== "undefined" &&
  document.documentElement.classList.contains("kiwi-ios-app");

const isDesktop = () => {
  return (
    !("ontouchstart" in window || navigator.maxTouchPoints) &&
    window.innerWidth > 800
  );
};

// Create connectors based on environment
const connectors = isInIOSApp
  ? createIOSOnlyConnectors()
  : createStandardConnectors();

function createIOSOnlyConnectors() {
  // When not in iOS app, use all the regular wallet options
  const wallets = [
    rainbowWallet({ chains, projectId }),
    createMWPConnector(),
    metaMaskWallet({ chains, projectId }),
    trustWallet({ chains, projectId }),
  ];

  return connectorsForWallets([
    {
      groupName: "Popular",
      wallets,
    },
  ]);
}
function createMWPConnector() {
  // When in iOS app, only use the iOS wallet connector
  const iosConnector = new IOSWalletConnector({
    chains,
    options: { name: "Coinbase Wallet" },
  });

  return {
    id: "ios-coinbase-wallet",
    name: "Coinbase",
    iconUrl: "coinbase_wallet_appicon.png",
    iconBackground: "#2c5ff6",
    createConnector: () => {
      return {
        connector: iosConnector,
      };
    },
  };
}

function createStandardConnectors() {
  // When not in iOS app, use all the regular wallet options
  const wallets = [
    injectedWallet({ chains }),
    walletConnectWallet({ projectId, chains }),
    safeWallet({ chains }),
    coinbaseWallet({ appName, chains }),
    metaMaskWallet({ chains, projectId }),
    braveWallet({ chains }),
  ];

  // NOTE: We've had issues with iOS Rainbow wallet users clicking on the Rainbow
  // link but then not being taken to Rainbow wallet on their mobile devices.
  // So instead, we're now asking mobile users to connect via the WalletConnect
  // dialogue, while we allow Desktop users to connect to their Rainbow wallet
  // extension directly.
  if (isDesktop()) {
    wallets.push(rainbowWallet({ chains, projectId }));
  } else if (window?.ethereum?.isRainbow) {
    wallets.push(rainbowWallet({ chains, projectId }));
  }

  return connectorsForWallets([
    {
      groupName: "Popular",
      wallets,
    },
  ]);
}

export const client = createConfig({
  autoConnect: true,
  connectors,
  publicClient: config.publicClient,
});

export function publicClientToProvider(publicClient) {
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
  const publicClient = getPublicClient({ chainId });
  return publicClientToProvider(publicClient);
}

export function useProvider({ chainId } = {}) {
  const publicClient = usePublicClient({ chainId });
  return React.useMemo(
    () => publicClientToProvider(publicClient),
    [publicClient],
  );
}

export function walletClientToSigner(walletClient) {
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
  const { data: walletClient } = useWalletClient({ chainId });
  return React.useMemo(
    () => (walletClient ? walletClientToSigner(walletClient) : undefined),
    [walletClient],
  );
}
