// @format
import { useEnsName, WagmiConfig } from "wagmi";
import { ConnectKitProvider } from "connectkit";

import config from "./config.mjs";

const shorten = (address) =>
  address.slice(0, 6) +
  "..." +
  address.slice(address.length - 4, address.length);

const Container = (props) => {
  return (
    <WagmiConfig config={config}>
      <ConnectKitProvider>
        <EnsName {...props} />
      </ConnectKitProvider>
    </WagmiConfig>
  );
};

const ProfileLink = ({address, name }) => {
  const link = `/upvotes?address=${address}`;
  return <a href={link}>{name}</a>;
};

const EnsName = (props) => {
  const { data, isError, isLoading } = useEnsName({
    address: props.address
  });
  if (isLoading || isError || !data) return <ProfileLink address={props.address} name={shorten(props.address)} />;
  return <ProfileLink address={props.address} name={data} />
};

export default Container;
