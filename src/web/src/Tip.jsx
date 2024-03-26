// @format
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiConfig, useAccount } from "wagmi";
import { PayKitProvider } from "@dawnpay/kit";
import { useDawnPay } from "@dawnpay/kit";

import { client, chains } from "./client.mjs";
import { getLocalAccount } from "./session.mjs";

const Container = (props) => {
  return (
    <WagmiConfig config={client}>
      <RainbowKitProvider chains={chains}>
        <PayKitProvider>
          <Tip {...props} />
        </PayKitProvider>
      </RainbowKitProvider>
    </WagmiConfig>
  );
};

const Tip = (props) => {
  if (!window.ethereum) {
    return (
      <span style={{ visibility: "hidden" }}>
        <span> • </span>
        <a className="caster-link">$ Tip </a>
      </span>
    );
  }
  const { pay } = useDawnPay();

  const handlePayClick = async () => {
    await pay(props.address, props.metadata);
  };

  let address;
  const account = useAccount();
  const localAccount = getLocalAccount(account.address);
  if (account.isConnected) {
    address = account.address;
  }
  if (localAccount) {
    address = localAccount.identity;
  }
  if (props.address === address) {
    return (
      <span style={{ visibility: "hidden" }}>
        <span> • </span>
        <a className="caster-link">$ Tip </a>
      </span>
    );
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
