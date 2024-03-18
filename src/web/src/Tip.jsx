// @format
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiConfig, useAccount } from "wagmi";
import { DawnProvider, useDawnPay } from "@dawnpay/kit";

import { client, chains } from "./client.mjs";
import { getLocalAccount } from "./session.mjs";

const Container = (props) => {
  return (
    <WagmiConfig config={client}>
      <RainbowKitProvider chains={chains}>
        <DawnProvider>
          <Tip {...props} />
        </DawnProvider>
      </RainbowKitProvider>
    </WagmiConfig>
  );
};

const Tip = (props) => {
  const { pay } = useDawnPay();

  const handlePayClick = async () => {
    const amount = 0.69;
    await pay(props.address, amount, props.metadata);
  };

  const account = useAccount();
  if (!account.isConnected) {
    return;
  }

  return (
    <span>
      <span> • </span>
      <a onClick={handlePayClick} className="caster-link">
        $ Tip{" "}
      </a>
    </span>
  );
};

export default Container;
