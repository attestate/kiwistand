import { useContractRead, WagmiConfig } from "wagmi";
import { parseEther, formatEther } from "viem";
import { optimism } from "wagmi/chains";
import { useEffect, useState } from "react";

import { client, chains } from "./client.mjs";
import { fetchPrice } from "./API.mjs";
import theme from "./theme.jsx";

// TODO: Move this to theme.jsx. Couldn't figure it out because of the react
// preamble wasn't loaded error
export const DiscountLogo = (props) => (
  <svg dataTest="Svg" viewBox="0 0 40 40" style={props.style}>
    <g clipPath="url(#octant)">
      <path
        fill="#171717"
        fillRule="evenodd"
        d="M40 20C40 5.244 34.78 0 20 0 5.263 0 0 5.312 0 20c0 14.632 5.35 20 20 20 14.693 0 20-5.3 20-20Zm-27.067 6.058a6.06 6.06 0 0 0 5.588-3.715 9.095 9.095 0 0 0 7.854 6.697c.78.08.929-.056.929-.9v-3.62c0-.707.239-1.491 1.371-1.491h2.172c.468 0 .487-.01.752-.385 0 0 1.139-1.59 1.365-1.928.226-.338.203-.426 0-.716S31.6 18.106 31.6 18.106c-.266-.37-.288-.378-.752-.378h-2.893c-.473 0-.65.252-.65.757v2.627c0 .64 0 1.16-.93 1.16-1.35 0-2.082-1.017-2.082-2.272 0-1.1.816-2.227 2.083-2.227.852 0 .929-.204.929-.613v-5.49c0-.72-.314-.773-.93-.71a9.095 9.095 0 0 0-7.852 6.696A6.06 6.06 0 0 0 6.874 20a6.058 6.058 0 0 0 6.058 6.058Zm0-4.039a2.02 2.02 0 1 0 0-4.039 2.02 2.02 0 0 0 0 4.04Z"
        clipRule="evenodd"
      ></path>
    </g>
    <defs>
      <clipPath id="octant">
        <path fill="#fff" d="M0 0h40v40H0z"></path>
      </clipPath>
    </defs>
  </svg>
);

export const PriceComponent = (props) => {
  const [ethPrice, setEthPrice] = useState(null);
  const [price, setPrice] = useState(null);
  const discountQuery = new URLSearchParams(window.location.search).get(
    "discount",
  );
  const validDiscount = discountQuery === theme.discount.code;

  let selector;
  if (validDiscount) {
    selector = "min";
  } else if (props.selector) {
    selector = props.selector;
  } else {
    selector = "authoritative";
  }

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
            backgroundColor: theme.discount.secondary,
            color: theme.discount.primary,
            borderRadius: "1px",
            padding: "3px 5px",
            border: "1px solid #ccc",
          }}
        >
          <DiscountLogo style={{ height: "10px" }} /> {percentageOff.toString()}
          % off!
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
