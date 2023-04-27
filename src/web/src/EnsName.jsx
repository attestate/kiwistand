// @format
import { useEnsName, WagmiConfig } from "wagmi";
import { ConnectKitProvider } from "connectkit";

import client from "./client.mjs";

const shorten = (address) =>
  address.slice(0, 6) +
  "..." +
  address.slice(address.length - 4, address.length);

const Container = (props) => {
  return (
    <WagmiConfig client={client}>
      <ConnectKitProvider>
        <EnsName {...props} />
      </ConnectKitProvider>
    </WagmiConfig>
  );
};

const EtherscanLink = ({address, name}) => {
  const link = `https://etherscan.io/address/${address}`;
  return <a target="_blank" href={link}>{name}</a>;
};

const EnsName = (props) => {
  const { data, isError, isLoading } = useEnsName({
    address: props.address
  });
  if (isLoading || isError || !data) return <EtherscanLink address={props.address} name={shorten(props.address)} />;
  return <EtherscanLink address={props.address} name={data} />
};

export default Container;
