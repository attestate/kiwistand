// @format
import { WagmiConfig, createClient } from "wagmi";
import { ConnectKitProvider, ConnectKitButton, getDefaultClient } from "connectkit";


const client = createClient(
  getDefaultClient({
    appName: "Kiwi News",
    alchemyId: "3ZBBnBhNn0nMmNcdgXFpqWqC981hd1Z2"
  }),
);

const shorten = address => address.slice(0,6)+"..."+address.slice(address.length-4, address.length);

export const ConnectButton = () => {
  return (
    <ConnectKitButton.Custom>
      {({ isConnected, isConnecting, show, hide, address, ensName, chain }) => {
        const divider = <span>|</span>;
        const submit = <a style={{ color: "black", cursor: "pointer" }} href="/submit">Submit</a>;

        return (
          <div>
            {isConnected ? <span>{submit}{divider}</span> : ""}
            <a style={{color: "black", cursor: "pointer"}} onClick={show}>
              {isConnected ? shorten(address) : "Login"}
            </a>
          </div>
        );
      }}
    </ConnectKitButton.Custom>
  );
};

const Connector = () => {
  return (
    <WagmiConfig client={client}>
    <ConnectKitProvider>
        <ConnectButton />
      </ConnectKitProvider>
    </WagmiConfig>
  );
};

export default Connector;
