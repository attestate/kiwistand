// @format
import { useSignTypedData, useAccount, WagmiConfig } from "wagmi";
import { ConnectKitProvider } from "connectkit";

import * as API from "./API.mjs";
import client from "./client.mjs";
import { showMessage } from "./message.mjs";

const Container = (props) => {
  return (
    <WagmiConfig client={client}>
      <ConnectKitProvider>
        <Vote {...props} />
      </ConnectKitProvider>
    </WagmiConfig>
  );
};


const Vote = (props) => {
  const value = API.messageFab(props.title, props.href);
  const { data, signTypedDataAsync } =
    useSignTypedData({
      domain: API.EIP712_DOMAIN,
      types: API.EIP712_TYPES,
      value,
    });

  const handleSubmit = async (e) => {
    e.preventDefault();
    showMessage("Please sign the message in your wallet");
    const signature = await signTypedDataAsync();
    await API.send(value, signature);
    window.location.replace('/feed?bpc=1');
  };

  const { isConnected } = useAccount()
  if (isConnected) {
    return <div onClick={handleSubmit} className="votearrow" title="upvote"></div>;
  } else {
    return null;
  }
};

export default Container;
