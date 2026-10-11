// @format
import * as React from "react";
import {
  Web3Provider,
  FallbackProvider,
  JsonRpcProvider,
} from "@ethersproject/providers";
import { getDefaultConfig, connectorsForWallets } from "@rainbow-me/rainbowkit";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { getPublicClient } from "@wagmi/core";
import {
  createConfig,
  http,
  useClient,
  useConnectorClient,
  createConnector,
} from "wagmi";
import { mainnet, optimism } from "wagmi/chains";
import { createWalletClient, custom, getAddress } from "viem";
import {
  injectedWallet,
  walletConnectWallet,
  coinbaseWallet,
  metaMaskWallet,
  rainbowWallet,
  trustWallet,
  safeWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { sdk } from "@farcaster/miniapp-sdk";

const isDesktop = () => {
  return (
    !("ontouchstart" in window || navigator.maxTouchPoints) &&
    window.innerWidth > 800
  );
};

// Setup chains and transports
// NOTE: The frontend uses public RPCs on purpose. Any API key shipped in the
// bundle is public and gets abused (e.g. eth_getLogs on mainnet). The browser
// only needs a handful of light calls (balance, ENS of the connected wallet,
// delegation tx receipts), which public endpoints rate-limit per visitor IP.
export const chains = [optimism, mainnet];
const transports = {
  [optimism.id]: http("https://mainnet.optimism.io"),
  [mainnet.id]: http("https://ethereum-rpc.publicnode.com"),
};

export const useIsMiniApp = () => {
  const [isMiniApp, setIsMiniApp] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const check = async () => {
      try {
        const res = await sdk.isInMiniApp();
        setIsMiniApp(res);
      } catch (e) {
        console.error(e);
        setIsMiniApp(false);
      } finally {
        setLoading(false);
      }
    };
    check();
  }, []);

  return { isMiniApp, loading };
};

// Check if we're in the iOS app by looking for the CSS class
export const isInIOSApp =
  typeof document !== "undefined" &&
  document.documentElement.classList.contains("kiwi-ios-app");

const projectId = "cd46d2fcf6d171fb7c017129868fa211";
const appName = "Kiwi News";


// NOTE: wagmi calls each connector's setup() as soon as the config is
// created, and the WalletConnect, MetaMask and Coinbase connectors fetch
// their SDKs there (~860KB, over a second of main-thread time on a phone)
// on every page, for every visitor. setup() only lets a wallet connect
// itself without user interaction; connect() and reconnect() load the SDK
// when it's actually needed. Injected (browser extension) connectors are
// cheap and keep it.
const deferSetup = (connectorFn) => (config) => {
  const connector = connectorFn(config);
  if (connector.type === "injected") return connector;
  return { ...connector, setup: undefined };
};

// Create wagmi config based on environment
let client;

// Check if we're in anon mode - if so, create minimal config without wallet connectors
const isAnonMode = typeof localStorage !== 'undefined' && localStorage.getItem('anon-mode') === 'true';

if (isAnonMode) {
  // Minimal config for anon mode - no wallet connectors, no RainbowKit analytics
  client = createConfig({
    chains,
    connectors: [], // No connectors needed in anon mode
    transports,
  });
} else if (isInIOSApp) {
  // iOS app configuration
  const wallets = [
    metaMaskWallet,
    rainbowWallet,
    trustWallet,
    safeWallet,
  ];

  const connectors = connectorsForWallets(
    [
      {
        groupName: 'Wallets',
        wallets,
      },
    ],
    {
      appName,
      projectId,
    }
  ).map(deferSetup);

  client = createConfig({
    chains,
    connectors,
    transports,
  });
} else {
  // Standard configuration with Farcaster mini app support
  // This will be used for all browsers including iOS Safari (not the app)
  const wallets = [
    injectedWallet,
    walletConnectWallet,
    coinbaseWallet,
    metaMaskWallet,
    rainbowWallet,
    trustWallet,
    safeWallet,
  ];

  const walletConnectors = connectorsForWallets(
    [
      {
        groupName: 'Wallets',
        wallets,
      },
    ],
    {
      appName,
      projectId,
    }
  ).map(deferSetup);

  // Add Farcaster mini app connector to the connectors array
  const connectors = [...walletConnectors, farcasterMiniApp()];

  client = createConfig({
    chains,
    connectors,
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