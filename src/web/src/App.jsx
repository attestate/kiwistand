// @format
import { useAccount, WagmiConfig, createClient } from "wagmi";
import { ConnectKitProvider, ConnectKitButton, getDefaultClient } from "connectkit";
import "./App.css"


const client = createClient(
  getDefaultClient({
    appName: "Kiwi News",
    alchemyId: "3ZBBnBhNn0nMmNcdgXFpqWqC981hd1Z2"
  }),
);


export const ExampleButton = () => {
  return (
    <ConnectKitButton.Custom>
      {({ isConnected, isConnecting, show, hide, address, ensName, chain }) => {
        return (
          <a style={{color: "black", cursor: "pointer"}} onClick={show}>
            {isConnected ? address : "Connect"}
          </a>
        );
      }}
    </ConnectKitButton.Custom>
  );
};

const App = () => {
  return (
    <WagmiConfig client={client}>
    <ConnectKitProvider>
        <ExampleButton />
      </ConnectKitProvider>
    </WagmiConfig>
  );
};

export default App;
