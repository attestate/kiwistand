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
    const { success, receipt, error } = await pay(props.address);

    if (success) {
        console.log("Transaction Success: ", receipt)
    }

    if (!success) {
        console.log("Transaction Error: ", error)
    }
  };

  return (
    <a onClick={handlePayClick} class="caster-link">
      $ Tip
    </a>
  );
};

export default Container;
