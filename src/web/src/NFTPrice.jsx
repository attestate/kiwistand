import { useContractRead, WagmiConfig } from "wagmi";
import { parseEther, formatEther } from "viem";
import { optimism } from "wagmi/chains";
import { useEffect, useState } from "react";
import { getAddress } from "@ethersproject/address";

import { client, chains } from "./client.mjs";
import { fetchPrice } from "./API.mjs";
import theme from "./theme.jsx";

export const PriceComponent = (props) => {
  const [ethPrice, setEthPrice] = useState(null);
  const [price, setPrice] = useState(null);
  const [selector, setSelector] = useState(null);
  const [validDiscount, setValidDiscount] = useState(false);

  let referral;
  const queryReferral = localStorage.getItem("--kiwi-news-original-referral");
  try {
    referral = getAddress(queryReferral);
  } catch (err) {
    console.log("Couldn't find referral address in URL bar");
    //noop
  }

  useEffect(() => {
    const handleUrlChange = () => {
      const discountQuery = new URLSearchParams(window.location.search).get(
        "discount",
      );
      setValidDiscount(discountQuery === theme.discount.code);
    };

    // Create custom event for pushState
    const originalPushState = history.pushState;
    history.pushState = function () {
      originalPushState.apply(history, arguments);
      handleUrlChange(); // Call handler directly after pushState
    };

    // Initial check
    handleUrlChange();

    // Cleanup
    return () => {
      history.pushState = originalPushState;
    };
  }, []);

  // Separate useEffect for selector updates
  useEffect(() => {
    if (validDiscount) {
      setSelector("min");
    } else if (referral) {
      setSelector("referralPrice");
    } else if (props.selector) {
      setSelector(props.selector);
    } else {
      setSelector("authoritative");
    }
  }, [validDiscount, referral, props.selector]);

  useEffect(() => {
    (async () => {
      const price = await fetchPrice();
      setPrice(price);
    })();
    (async () => {
      let data;
      try {
        const response = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
        );

        data = await response.json();
      } catch (err) {
        console.error("Error in coingecko response");
      }
      if (data?.ethereum?.usd) {
        setEthPrice(data.ethereum.usd);
      } else {
        console.error("Couldn't get coingecko ETH/USD price");
      }
    })();
  }, []);

  const getUSDPrice = (price, selector) =>
    ethPrice && price && price[selector]
      ? `$${(formatEther(price[selector]) * ethPrice).toFixed(2)}`
      : null;

  const usdPrice = getUSDPrice(price, selector);

  let percentageOff;
  if (validDiscount && price) {
    percentageOff = (price["difference"] * 100n) / price["authoritative"];
  } else if (referral && price) {
    percentageOff =
      ((price["difference"] / 2n) * 100n) / price["authoritative"];
  }

  if (!usdPrice && !price) {
    return "...loading";
  }

  return (
    <span>
      {price && price[selector] ? (
        <span>{parseFloat(formatEther(price[selector])).toFixed(5)} ETH</span>
      ) : (
        ""
      )}
      {usdPrice ? <span> ~ {usdPrice} </span> : ""}
      <span> </span>
      {percentageOff ? (
        <span
          style={{
            backgroundColor: validDiscount
              ? theme.discount.secondary
              : theme.color,
            color: validDiscount ? theme.discount.primary : "white",
            borderRadius: "1px",
            padding: "3px 5px",
            border: "1px solid #ccc",
          }}
        >
          {percentageOff.toString()}% off!
        </span>
      ) : (
        ""
      )}
    </span>
  );
};

const WrappedPriceComponent = (props) => {
  return (
    <WagmiConfig config={client}>
      <PriceComponent {...props} />
    </WagmiConfig>
  );
};

export default WrappedPriceComponent;
