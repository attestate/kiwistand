import { useContractRead, WagmiConfig } from "wagmi";
import { parseEther, formatEther } from "viem";
import { optimism } from "wagmi/chains";
import { useEffect, useState } from "react";

import { client, chains } from "./client.mjs";
import { fetchPrice } from "./API.mjs";

export const PriceComponent = (props) => {
  const [ethPrice, setEthPrice] = useState(null);
  const [price, setPrice] = useState(null);
  const selector = props.selector ? props.selector : "authoritative";

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

  const usdPrice =
    ethPrice && price && price[selector]
      ? `$${(formatEther(price[selector]) * ethPrice).toFixed(2)}`
      : null;

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
      {usdPrice ? <span> ({usdPrice}) </span> : ""}
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
