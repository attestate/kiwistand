import { useContractRead, WagmiConfig } from "wagmi";
import SuperfluidWidget from "@superfluid-finance/widget";

import { client } from "./client.mjs";

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
            Donate
          </button>
        );
      }}
    </SuperfluidWidget>
  );
};

const WrappedDonationRow = (props) => {
  return (
    <WagmiConfig config={client}>
      <DonationRow />
    </WagmiConfig>
  );
};

export default WrappedDonationRow;
