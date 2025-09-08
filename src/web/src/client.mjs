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
import { mainnet, optimism, base, arbitrum } from "wagmi/chains";
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

if (isInFarcasterFrame()) {
  // Farcaster frame configuration
  client = createConfig({
    chains,
    connectors: [farcasterMiniApp()],
    transports,
  });
} else if (isInIOSApp) {
  // iOS app configuration - exclude Coinbase Wallet and browser wallet
  const wallets = [
    // injectedWallet excluded on iOS app (browser wallet)
    walletConnectWallet,
    // coinbaseWallet excluded on iOS app (popup issues)
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
  );

  client = createConfig({
    chains,
    connectors,
    transports,
  });
} else {
  // Standard configuration using RainbowKit's getDefaultConfig
  // This will be used for all browsers including iOS Safari (not the app)
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