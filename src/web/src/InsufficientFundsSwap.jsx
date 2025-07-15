import { useState, useEffect } from "react";
import { useAccount, useBalance } from "wagmi";
import { parseEther, formatEther } from "viem";
import { base, optimism } from "wagmi/chains";
import sdk from "@farcaster/frame-sdk";

// USDC on Base address
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const InsufficientFundsSwap = ({ requiredAmount, onSwapInitiated }) => {
  const { address } = useAccount();
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapError, setSwapError] = useState(null);
  
  // Check Base ETH balance
  const { data: baseETHBalance } = useBalance({
    address,
    chainId: base.id,
  });

  // Check Base USDC balance
  const { data: baseUSDCBalance } = useBalance({
    address,
    token: USDC_BASE,
    chainId: base.id,
  });

  const requiredAmountBN = parseEther(requiredAmount);
  
  // Calculate ideal swap amounts with buffer
  const bufferedAmount = requiredAmountBN + (requiredAmountBN / 2n); // 50% buffer
  const minSwapAmount = parseEther("0.0001"); // Lower minimum to allow small swaps
  
  // For ETH: Use whatever the user has, but warn if it's below ideal
  const idealSwapAmountETH = bufferedAmount > minSwapAmount ? bufferedAmount : minSwapAmount;
  const actualSwapAmountETH = baseETHBalance && baseETHBalance.value > 0n 
    ? baseETHBalance.value 
    : 0n;
  const hasBaseETH = baseETHBalance && baseETHBalance.value >= minSwapAmount;
  const hasIdealBaseETH = baseETHBalance && baseETHBalance.value >= idealSwapAmountETH;
  
  // For USDC: Similar approach
  const minUSDCAmount = parseEther("0.1"); // 0.1 USDC minimum
  const idealSwapAmountUSDC = bufferedAmount > minUSDCAmount ? bufferedAmount : minUSDCAmount;
  const actualSwapAmountUSDC = baseUSDCBalance && baseUSDCBalance.value > 0n
    ? baseUSDCBalance.value
    : 0n;
  const hasBaseUSDC = baseUSDCBalance && baseUSDCBalance.value >= minUSDCAmount;
  const hasIdealBaseUSDC = baseUSDCBalance && baseUSDCBalance.value >= idealSwapAmountUSDC;

  const handleSwap = async (sellToken, sellAmount) => {
    try {
      setIsSwapping(true);
      setSwapError(null);

      const result = await sdk.actions.swapToken({
        sellToken,
        buyToken: "eip155:10/native", // Optimism ETH
        sellAmount
      });

      if (result && result.success) {
        onSwapInitiated();
      } else {
        throw new Error("Swap was cancelled or failed");
      }
    } catch (error) {
      console.error("Swap error:", error);
      setSwapError(error.message || "Swap failed");
    } finally {
      setIsSwapping(false);
    }
  };

  // If no Base assets, show standard insufficient funds message
  if (!hasBaseETH && !hasBaseUSDC) {
    return (
      <div style={{ textAlign: "center" }}>
        <button className="buy-button" disabled>
          Insufficient funds
        </button>
        <p style={{ marginTop: "10px", fontSize: "14px" }}>
          Need {requiredAmount} ETH on Optimism
        </p>
        <p style={{ marginTop: "5px", fontSize: "12px", color: "#666" }}>
          You need at least {formatEther(minSwapAmount)} ETH or {formatEther(minUSDCAmount)} USDC on Base to swap
        </p>
        {baseETHBalance && baseETHBalance.value > 0n && (
          <p style={{ marginTop: "5px", fontSize: "12px", color: "#666" }}>
            Current Base ETH: {formatEther(baseETHBalance.value)} (insufficient)
          </p>
        )}
        {baseUSDCBalance && baseUSDCBalance.value > 0n && (
          <p style={{ marginTop: "5px", fontSize: "12px", color: "#666" }}>
            Current Base USDC: {formatEther(baseUSDCBalance.value)} (insufficient)
          </p>
        )}
      </div>
    );
  }

  return (
    <div style={{ textAlign: "center" }}>
      {hasBaseETH && (
        <button 
          className="buy-button" 
          onClick={() => handleSwap("eip155:8453/native", actualSwapAmountETH.toString())}
          disabled={isSwapping}
        >
          {isSwapping ? "Opening swap..." : `Swap ${formatEther(actualSwapAmountETH)} ETH from Base`}
        </button>
      )}

      {hasBaseUSDC && !hasBaseETH && (
        <button 
          className="buy-button" 
          onClick={() => handleSwap(
            `eip155:8453/erc20:${USDC_BASE}`, 
            actualSwapAmountUSDC.toString()
          )}
          disabled={isSwapping}
        >
          {isSwapping ? "Opening swap..." : `Swap ${formatEther(actualSwapAmountUSDC)} USDC from Base`}
        </button>
      )}

      {swapError && (
        <p style={{ marginTop: "10px", fontSize: "14px", color: "red" }}>
          {swapError}
        </p>
      )}
    </div>
  );
};

export default InsufficientFundsSwap;