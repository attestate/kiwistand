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
    await pay(props.address);
  };

  return (
    <span>
      <span> • </span>
      <a onClick={handlePayClick} className="caster-link">
        $ Tip
      </a>
    </span>
  );
};

export default Container;
