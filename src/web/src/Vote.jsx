// @format
import { useSignTypedData, useAccount, WagmiConfig } from "wagmi";
import { ConnectKitProvider, ConnectKitButton } from "connectkit";

import * as API from "./API.mjs";
import config from "./config.mjs";
import { showMessage } from "./message.mjs";

const Container = (props) => {
  return (
    <WagmiConfig config={config}>
      <ConnectKitProvider>
        <Vote {...props} />
      </ConnectKitProvider>
    </WagmiConfig>
  );
};


const Vote = (props) => {
  const message = API.messageFab(props.title, props.href);
  const { data, signTypedDataAsync } =
    useSignTypedData({
      domain: API.EIP712_DOMAIN,
      types: API.EIP712_TYPES,
      primaryType: "Message",
      message,
    });

  const handleSubmit = async (e) => {
    e.preventDefault();
    showMessage("Please sign the message in your wallet");
    const signature = await signTypedDataAsync();
    const response = await API.send(message, signature);

    console.log(response);
    let message;
    if (response.status === "success") {
      message = "Thanks for your upvote! Have a 🥝";
    } else if(response.status === "error") {
      message = `Sad Kiwi :( "${response.details}"`;
    }
    let url = new URL(window.location.href);
    url.searchParams.set('bpc', '1');
    url.searchParams.set('message', message);
    window.location.href = url.href;
  };

  return (
    <ConnectKitButton.Custom>
      {({ show, isConnected }) => {
        return (
          <div
            onClick={(e) => {
              if (!isConnected) {
                show()
              }
              handleSubmit(e)
            }}
            className="votearrow"
            title="upvote">
          </div>
        );
      }}
    </ConnectKitButton.Custom>
  );
};

export default Container;
