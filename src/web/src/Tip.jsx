// @format
import { PayKitProvider } from "@dawnpay/kit"
import { useDawnPay } from "@dawnpay/kit";

const Container = (props) => {
  return (
    <PayKitProvider>
        <Tip {...props} />
    </PayKitProvider>
  );
};

const Tip = (props) => {
  const { pay } = useDawnPay();

  const handlePayClick = async () => {
    await pay(props.address);
  };

  return (
    <a onClick={handlePayClick} class="caster-link">
      $ Tip
    </a>
  );
};

export default Container;
