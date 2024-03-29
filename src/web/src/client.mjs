// @format
import * as React from "react";
import {
  Web3Provider,
  FallbackProvider,
  JsonRpcProvider,
} from "@ethersproject/providers";
import { getDefaultWallets } from "@rainbow-me/rainbowkit";
import { getPublicClient } from "@wagmi/core";
import {
  createConfig,
  configureChains,
  usePublicClient,
  useWalletClient,
} from "wagmi";
import { mainnet, optimism } from "wagmi/chains";
//import { alchemyProvider } from "wagmi/providers/alchemy";
import { infuraProvider } from "wagmi/providers/infura";

const config = configureChains(
  [optimism, mainnet],
  //[alchemyProvider({ apiKey: "TfAhzs116ThO7Fwod1gzpTJmH0Cudxp7" })],
  [infuraProvider({ apiKey: "ddb924190df54c22a268ae7671ed0f55" })],
);

export const chains = config.chains;

const { connectors } = getDefaultWallets({
  appName: "Kiwi News",
  projectId: "cd46d2fcf6d171fb7c017129868fa211",
  chains,
});

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
