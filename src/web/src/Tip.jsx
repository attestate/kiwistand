// @format
import { PayKitProvider } from "@dawnpay/kit";
import { useDawnPay } from "@dawnpay/kit";

const Container = (props) => {
  return (
    <PayKitProvider>
      <Tip {...props} />
    </PayKitProvider>
  );
};

const Tip = (props) => {
  if (!window.ethereum) return null;
  const { pay } = useDawnPay();

  const handlePayClick = async () => {
    await pay(props.address, props.metadata);
  };

  return (
    <span>
      <span> • </span>
      <a onClick={handlePayClick} className="caster-link">
        $ Tip {props.totalValue > 0 ? `($${parseFloat(props.tipValue).toFixed(2)} received)` : "(Be the first to tip)"}
      </a>
    </span>
  );
};

export default Container;
