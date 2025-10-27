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
  portoWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { sdk } from "@farcaster/miniapp-sdk";
import { Mode } from "porto";

const isDesktop = () => {
  return (
    !("ontouchstart" in window || navigator.maxTouchPoints) &&
    window.innerWidth > 800
  );
};

// Setup chains and transports
export const chains = [optimism, mainnet, arbitrum, base];
const transports = {
  [optimism.id]: http('https://opt-mainnet.g.alchemy.com/v2/TfAhzs116ThO7Fwod1gzpTJmH0Cudxp7'),
  [mainnet.id]: http('https://eth-mainnet.g.alchemy.com/v2/TfAhzs116ThO7Fwod1gzpTJmH0Cudxp7'),
  [arbitrum.id]: http('https://arb-mainnet.g.alchemy.com/v2/TfAhzs116ThO7Fwod1gzpTJmH0Cudxp7'),
  [base.id]: http('https://base-mainnet.g.alchemy.com/v2/TfAhzs116ThO7Fwod1gzpTJmH0Cudxp7'),
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

// Kiwi theme for Porto
const kiwiTheme = {
  colorScheme: "light",

  // Primary colors (Kiwi green)
  focus: "#AFC046",
  link: "#AFC046",
  primaryBackground: "#AFC046",
  primaryContent: "#000000",
  primaryBorder: "#AFC046",
  primaryHoveredBackground: "#9BAD3D",
  primaryHoveredBorder: "#9BAD3D",

  // Base/background colors (Kiwi beige/off-white)
  baseBackground: "#FFFFFF",
  baseAltBackground: "#E6E6DF",
  basePlaneBackground: "#F5F5F0",
  baseBorder: "#0000001A",
  baseContent: "#000000",
  baseContentSecondary: "#666666",
  baseContentTertiary: "#828282",
  baseContentPositive: "#4CAF50",
  baseContentNegative: "#F44336",
  baseContentWarning: "#FF9800",
  baseHoveredBackground: "#F0F0E8",

  // Frame/modal colors
  frameBackground: "#FFFFFF",
  frameBorder: "#0000001A",
  frameContent: "#000000",
  frameRadius: 2,

  // Secondary button colors (black)
  secondaryBackground: "#000000",
  secondaryContent: "#FFFFFF",
  secondaryBorder: "#000000",
  secondaryHoveredBackground: "#333333",
  secondaryHoveredBorder: "#333333",

  // Field/input colors
  fieldBackground: "#FFFFFF",
  fieldContent: "#000000",
  fieldContentSecondary: "#666666",
  fieldContentTertiary: "#828282",
  fieldBorder: "#0000001A",
  fieldFocusedBackground: "#FFFFFF",
  fieldFocusedContent: "#000000",
  fieldErrorBorder: "#F44336",
  fieldNegativeBorder: "#F44336",
  fieldNegativeBackground: "#FFEBEE",
  fieldPositiveBorder: "#4CAF50",
  fieldPositiveBackground: "#E8F5E9",

  // Badge colors
  badgeBackground: "#F5F5F0",
  badgeContent: "#000000",
  badgeStrongBackground: "#000000",
  badgeStrongContent: "#FFFFFF",
  badgeInfoBackground: "#E3F2FD",
  badgeInfoContent: "#1976D2",
  badgeNegativeBackground: "#FFEBEE",
  badgeNegativeContent: "#D32F2F",
  badgePositiveBackground: "#E8F5E9",
  badgePositiveContent: "#388E3C",
  badgeWarningBackground: "#FFF3E0",
  badgeWarningContent: "#F57C00",

  // Radius
  radiusSmall: 2,
  radiusMedium: 2,
  radiusLarge: 2,

  // Separator
  separator: "#0000001A",

  // Distinct (alternative button style)
  distinctBackground: "#F5F5F0",
  distinctContent: "#000000",
  distinctBorder: "#0000001A",

  // Disabled state
  disabledBackground: "#E0E0E0",
  disabledBorder: "#CCCCCC",
  disabledContent: "#9E9E9E",

  // Negative (error) button
  negativeBackground: "#F44336",
  negativeContent: "#FFFFFF",
  negativeBorder: "#F44336",
  negativeSecondaryBackground: "#FFEBEE",
  negativeSecondaryContent: "#D32F2F",
  negativeSecondaryBorder: "#FFCDD2",

  // Positive (success) button
  positiveBackground: "#4CAF50",
  positiveContent: "#FFFFFF",
  positiveBorder: "#4CAF50",

  // Strong (emphasis) button
  strongBackground: "#000000",
  strongContent: "#FFFFFF",
  strongBorder: "#000000",

  // Warning button
  warningBackground: "#FF9800",
  warningContent: "#FFFFFF",
  warningBorder: "#FF9800",
  warningStrongBackground: "#F57C00",
  warningStrongContent: "#FFFFFF",
  warningStrongBorder: "#F57C00",
};

// Create wagmi config based on environment
let client;

if (isInIOSApp) {
  // iOS app configuration - exclude Coinbase Wallet, browser wallet, and Porto
  const wallets = [
    // portoWallet excluded on iOS app
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
  // Standard configuration with Farcaster mini app support
  // This will be used for all browsers including iOS Safari (not the app)
  const merchantUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/porto/merchant`
    : '/porto/merchant';

  const wallets = [
    () => portoWallet({
      merchantUrl,
      mode: Mode.dialog({ theme: kiwiTheme })
    }),
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
  );

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