import { useEffect, useState } from "react";

const start = Date.now();
export default function DecayingPrice({ initialPrice }) {
  const [price, setPrice] = useState(initialPrice);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    const duration = 2629742000;

    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.max(0, 1 - elapsed / duration);
      const scaler = 10000000000;
      const scalerBigInt = 10000000000n;
      const current =
        (BigInt(initialPrice) * BigInt(Math.floor(pct * scaler))) /
        scalerBigInt;
      setPrice(current);
      if (current % 5n === 0n) {
        setFlash(true);
      } else {
        setFlash(false);
      }
    }, 50);

    return () => clearInterval(timer);
  }, [initialPrice]);

  return (
    <>
      <span>Price: </span>
      <span
        style={{
          color: flash ? "#ff0000" : "inherit",
          textShadow: flash ? "0 0 10px rgba(255,0,0,0.5)" : "none",
          transition: "color 0.1s",
          display: "inline-block",
          minWidth: "85px",
          textAlign: "right",
          fontFamily: "monospace"
        }}
      >
        ↓{(Number(price) / 1e18).toFixed(9)}
      </span>
      <span> ETH</span>
    </>
  );
}
