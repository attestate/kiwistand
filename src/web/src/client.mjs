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
  portoWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { sdk } from "@farcaster/miniapp-sdk";
import { Mode } from "porto";
import { from as dialogFrom, handleResponse } from "porto/Dialog";

const isDesktop = () => {
  return (
    !("ontouchstart" in window || navigator.maxTouchPoints) &&
    window.innerWidth > 800
  );
};

// Setup chains and transports
export const chains = [optimism, mainnet];
const transports = {
  [optimism.id]: http('https://opt-mainnet.g.alchemy.com/v2/TfAhzs116ThO7Fwod1gzpTJmH0Cudxp7'),
  [mainnet.id]: http('https://eth-mainnet.g.alchemy.com/v2/TfAhzs116ThO7Fwod1gzpTJmH0Cudxp7'),
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

function iosNativeRenderer() {
  let processing = false;

  return dialogFrom({
    name: "ios-native",
    setup(parameters) {
      const { host, internal } = parameters;
      const { store } = internal;

      async function handle(request) {
        const { request: rpcRequest } = request;
        const redirectUri = "kiwi-news://porto-callback";

        const url = new URL(host);
        url.pathname = `${url.pathname.replace(/\/$/, "")}/${rpcRequest.method}`;

        const params = rpcRequest.params ?? [];
        const searchParams = new URLSearchParams({
          id: String(rpcRequest.id),
          jsonrpc: "2.0",
          method: rpcRequest.method,
          redirectUri,
        });
        if (params.length > 0) {
          searchParams.set("params", JSON.stringify(params));
        }
        url.search = searchParams.toString();

        return new Promise((resolve) => {
          window.__portoNativeCallback = ({ status, payload, message }) => {
            if (status === "success") {
              handleResponse(store, {
                id: rpcRequest.id,
                jsonrpc: "2.0",
                result: payload ? JSON.parse(payload) : undefined,
              });
            } else {
              handleResponse(store, {
                id: rpcRequest.id,
                jsonrpc: "2.0",
                error: {
                  code: 4001,
                  message: message || "User rejected request",
                },
              });
            }
            window.__portoNativeCallback = null;
            resolve();
          };

          window.webkit.messageHandlers.portoRequest.postMessage({
            url: url.toString(),
          });
        });
      }

      return {
        async syncRequests(requests) {
          if (processing) return;
          const [request] = requests;
          if (!request) return;
          processing = true;
          try {
            await handle(request);
          } finally {
            processing = false;
          }
        },
        close() {},
        destroy() {
          window.__portoNativeCallback = null;
        },
        open() {},
        async secure() {
          return { frame: false, host: true, protocol: true };
        },
      };
    },
    supportsHeadless: false,
  });
}

const projectId = "cd46d2fcf6d171fb7c017129868fa211";
const appName = "Kiwi News";

// Kiwi theme for Porto — must use actual color values, not CSS variables,
// because the Porto dialog runs in an iframe on id.porto.sh
const kiwiTheme = {
  colorScheme: "light",
  focus: "#AFC046",
  link: "#AFC046",
  primaryBackground: "#AFC046",
  primaryContent: "#000000",
  primaryBorder: "#AFC046",
  primaryHoveredBackground: "#9BAD3D",
  primaryHoveredBorder: "#9BAD3D",

  baseBackground: "#ffffff",
  baseAltBackground: "#e6e6df",
  basePlaneBackground: "#f6f6ef",
  baseBorder: "#e5e5e5",
  baseContent: "#000000",
  baseContentSecondary: "#666666",
  baseContentTertiary: "#828282",
  baseContentPositive: "#228B22",
  baseContentNegative: "#ff6600",
  baseContentWarning: "#b7791f",
  baseHoveredBackground: "#f5f5f5",

  frameBackground: "#ffffff",
  frameBorder: "#e5e5e5",
  frameContent: "#000000",
  frameRadius: 2,

  secondaryBackground: "#000000",
  secondaryContent: "#ffffff",
  secondaryBorder: "#000000",
  secondaryHoveredBackground: "#666666",
  secondaryHoveredBorder: "#666666",

  fieldBackground: "#ffffff",
  fieldContent: "#000000",
  fieldContentSecondary: "#666666",
  fieldContentTertiary: "#828282",
  fieldBorder: "#e5e5e5",
  fieldFocusedBackground: "#ffffff",
  fieldFocusedContent: "#000000",
  fieldErrorBorder: "#ff6600",
  fieldNegativeBorder: "#ff6600",
  fieldNegativeBackground: "#fff3e0",
  fieldPositiveBorder: "#228B22",
  fieldPositiveBackground: "#f5f7e6",

  badgeBackground: "#f6f6ef",
  badgeContent: "#000000",
  badgeStrongBackground: "#000000",
  badgeStrongContent: "#ffffff",
  badgeInfoBackground: "#e8f0fe",
  badgeInfoContent: "#1a73e8",
  badgeNegativeBackground: "#fff3e0",
  badgeNegativeContent: "#ff6600",
  badgePositiveBackground: "#f5f7e6",
  badgePositiveContent: "#228B22",
  badgeWarningBackground: "#fff3e0",
  badgeWarningContent: "#b7791f",

  radiusSmall: 2,
  radiusMedium: 2,
  radiusLarge: 2,

  separator: "#e5e5e5",

  distinctBackground: "#f6f6ef",
  distinctContent: "#000000",
  distinctBorder: "#e5e5e5",

  disabledBackground: "#e6e6df",
  disabledBorder: "#999999",
  disabledContent: "#999999",

  negativeBackground: "#ff6600",
  negativeContent: "#ffffff",
  negativeBorder: "#ff6600",
  negativeSecondaryBackground: "#fff3e0",
  negativeSecondaryContent: "#ff6600",
  negativeSecondaryBorder: "#e6a817",

  positiveBackground: "#228B22",
  positiveContent: "#ffffff",
  positiveBorder: "#228B22",

  strongBackground: "#000000",
  strongContent: "#ffffff",
  strongBorder: "#000000",

  warningBackground: "#b7791f",
  warningContent: "#ffffff",
  warningBorder: "#b7791f",
  warningStrongBackground: "#e6a817",
  warningStrongContent: "#ffffff",
  warningStrongBorder: "#e6a817",
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
  // iOS app configuration - use Porto with native ASWebAuthenticationSession renderer
  const merchantUrl = typeof window !== "undefined"
    ? `${window.location.origin}/porto/merchant`
    : "/porto/merchant";

  const wallets = [
    () => portoWallet({
      merchantUrl,
      mode: Mode.dialog({
        theme: kiwiTheme,
        renderer: iosNativeRenderer(),
      }),
    }),
    walletConnectWallet,
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