import { useContractRead, WagmiConfig } from "wagmi";
import SuperfluidWidget from "@superfluid-finance/widget";
import { RainbowKitProvider, ConnectButton } from "@rainbow-me/rainbowkit";

import { client, chains } from "./client.mjs";

export const DonationRow = (props) => {
  const productDetails = { name: "", description: "", imageURI: "" };
  const paymentDetails = {
    paymentOptions: [
      {
        receiverAddress: "0x1337E2624ffEC537087c6774e9A18031CFEAf0a9",
        chainId: 8453,
        superToken: {
          address: "0xD04383398dD2426297da660F9CCA3d439AF9ce1b",
        },
        flowRate: {
          amountEther: "30",
          period: "month",
        },
      },
    ],
  };
  return (
    <ConnectButton.Custom>
      {({ account, chain, mounted, openConnectModal, openAccountModal }) => {
        const connected = account && chain && mounted;
        if (!connected) {
          return (
            <button
              onClick={() => openConnectModal()}
              style={{ width: "auto", height: "40px" }}
              id="button-onboarding"
            >
              Connect Wallet
            </button>
          );
        }
        return (
          <SuperfluidWidget
            productDetails={productDetails}
            paymentDetails={paymentDetails}
            type="dialog"
          >
            {({ openModal }) => {
              return (
                <button
                  onClick={() => openModal()}
                  style={{ width: "auto", height: "40px" }}
                  id="button-onboarding"
                >
                  Support
                </button>
              );
            }}
          </SuperfluidWidget>
        );
      }}
    </ConnectButton.Custom>
  );
};

const WrappedDonationRow = (props) => {
  return (
    <WagmiConfig config={client}>
      <RainbowKitProvider chains={chains}>
        <DonationRow />
      </RainbowKitProvider>
    </WagmiConfig>
  );
};

export default WrappedDonationRow;
