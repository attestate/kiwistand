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
  [optimism.id]: http('https://optimism-mainnet.infura.io/v3/ddb924190df54c22a268ae7671ed0f55'),
  [mainnet.id]: http('https://mainnet.infura.io/v3/ddb924190df54c22a268ae7671ed0f55'),
  [base.id]: http('https://base-mainnet.infura.io/v3/ddb924190df54c22a268ae7671ed0f55'),
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
  focus: "var(--accent-primary)",
  link: "var(--accent-primary)",
  primaryBackground: "var(--accent-primary)",
  primaryContent: "var(--text-primary)",
  primaryBorder: "var(--accent-primary)",
  primaryHoveredBackground: "var(--accent-primary-hover)",
  primaryHoveredBorder: "var(--accent-primary-hover)",

  // Base/background colors (Kiwi beige/off-white)
  baseBackground: "var(--bg-white)",
  baseAltBackground: "var(--sidebar-beige)",
  basePlaneBackground: "var(--bg-off-white)",
  baseBorder: "rgba(0, 0, 0, 0.1)",
  baseContent: "var(--text-primary)",
  baseContentSecondary: "var(--text-tertiary)",
  baseContentTertiary: "var(--text-secondary)",
  baseContentPositive: "var(--color-success)",
  baseContentNegative: "var(--color-alert)",
  baseContentWarning: "var(--color-warning-text)",
  baseHoveredBackground: "var(--bg-hover-subtle)",

  // Frame/modal colors
  frameBackground: "var(--bg-white)",
  frameBorder: "rgba(0, 0, 0, 0.1)",
  frameContent: "var(--text-primary)",
  frameRadius: 2,

  // Secondary button colors (black)
  secondaryBackground: "var(--text-primary)",
  secondaryContent: "var(--bg-white)",
  secondaryBorder: "var(--text-primary)",
  secondaryHoveredBackground: "var(--text-tertiary)",
  secondaryHoveredBorder: "var(--text-tertiary)",

  // Field/input colors
  fieldBackground: "var(--bg-white)",
  fieldContent: "var(--text-primary)",
  fieldContentSecondary: "var(--text-tertiary)",
  fieldContentTertiary: "var(--text-secondary)",
  fieldBorder: "rgba(0, 0, 0, 0.1)",
  fieldFocusedBackground: "var(--bg-white)",
  fieldFocusedContent: "var(--text-primary)",
  fieldErrorBorder: "var(--color-alert)",
  fieldNegativeBorder: "var(--color-alert)",
  fieldNegativeBackground: "var(--color-warning-bg)",
  fieldPositiveBorder: "var(--color-success)",
  fieldPositiveBackground: "var(--accent-primary-light)",

  // Badge colors
  badgeBackground: "var(--bg-off-white)",
  badgeContent: "var(--text-primary)",
  badgeStrongBackground: "var(--text-primary)",
  badgeStrongContent: "var(--bg-white)",
  badgeInfoBackground: "var(--color-porto-bg)",
  badgeInfoContent: "var(--color-link-blue)",
  badgeNegativeBackground: "var(--color-warning-bg)",
  badgeNegativeContent: "var(--color-alert)",
  badgePositiveBackground: "var(--accent-primary-light)",
  badgePositiveContent: "var(--color-success)",
  badgeWarningBackground: "var(--color-warning-bg)",
  badgeWarningContent: "var(--color-warning-text)",

  // Radius
  radiusSmall: 2,
  radiusMedium: 2,
  radiusLarge: 2,

  // Separator
  separator: "rgba(0, 0, 0, 0.1)",

  // Distinct (alternative button style)
  distinctBackground: "var(--bg-off-white)",
  distinctContent: "var(--text-primary)",
  distinctBorder: "rgba(0, 0, 0, 0.1)",

  // Disabled state
  disabledBackground: "var(--button-bg)",
  disabledBorder: "var(--text-disabled)",
  disabledContent: "var(--text-disabled)",

  // Negative (error) button
  negativeBackground: "var(--color-alert)",
  negativeContent: "var(--bg-white)",
  negativeBorder: "var(--color-alert)",
  negativeSecondaryBackground: "var(--color-warning-bg)",
  negativeSecondaryContent: "var(--color-alert)",
  negativeSecondaryBorder: "var(--color-warning-border)",

  // Positive (success) button
  positiveBackground: "var(--color-success)",
  positiveContent: "var(--bg-white)",
  positiveBorder: "var(--color-success)",

  // Strong (emphasis) button
  strongBackground: "var(--text-primary)",
  strongContent: "var(--bg-white)",
  strongBorder: "var(--text-primary)",

  // Warning button
  warningBackground: "var(--color-warning-text)",
  warningContent: "var(--bg-white)",
  warningBorder: "var(--color-warning-text)",
  warningStrongBackground: "var(--color-warning-border)",
  warningStrongContent: "var(--bg-white)",
  warningStrongBorder: "var(--color-warning-border)",
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
