import { Wallet } from "@ethersproject/wallet";
import { ethers } from "ethers";
import log from "./logger.mjs";
import { sendError, sendStatus } from "./http.mjs";

const globalRequests = [];
const HOURLY_LIMIT = 24;
const RATE_WINDOW = 60 * 60 * 1000;

export async function handleFaucetRequest(req, reply) {
  const { address } = req.body;

  try {
    ethers.utils.getAddress(address);
  } catch (err) {
    return sendError(reply, 400, "Bad Request", "Invalid Ethereum address");
  }

  const now = Date.now();

  const activeRequests = globalRequests.filter(
    (time) => now - time < RATE_WINDOW,
  );
  globalRequests.length = 0;
  activeRequests.forEach((time) => globalRequests.push(time));

  if (globalRequests.length >= HOURLY_LIMIT) {
    return sendError(
      reply,
      429,
      "Too Many Requests",
      "Faucet rate limit exceeded. Try again later.",
    );
  }

  const faucetPrivateKey = process.env.FAUCET_PRIVATE_KEY;
  if (!faucetPrivateKey) {
    log("Faucet private key not configured");
    return sendError(
      reply,
      500,
      "Internal Server Error",
      "Faucet service not available",
    );
  }

  const faucetWallet = new Wallet(faucetPrivateKey);
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.OPTIMISM_RPC_HTTP_HOST,
  );
  const connectedWallet = faucetWallet.connect(provider);

  try {
    const faucetBalance = await provider.getBalance(faucetWallet.address);

    if (faucetBalance.isZero()) {
      log(`Faucet balance is zero`);
      return sendError(
        reply,
        503,
        "Service Unavailable",
        "Faucet is out of funds",
      );
    }
  } catch (error) {
    log(`Error checking faucet balance: ${error.toString()}`);
    return sendError(
      reply,
      500,
      "Internal Server Error",
      "Error checking faucet status",
    );
  }

  const sendAmount = ethers.utils.parseEther("0.000005");

  try {
    const tx = await connectedWallet.sendTransaction({
      to: address,
      value: sendAmount,
      chainId: 10,
    });

    globalRequests.push(now);

    log(
      `Sent ${ethers.utils.formatEther(sendAmount)} ETH to ${address}, tx: ${
        tx.hash
      }`,
    );

    return sendStatus(reply, 200, "OK", "Funds sent successfully", {
      txHash: tx.hash,
      amount: ethers.utils.formatEther(sendAmount),
    });
  } catch (error) {
    // Handle "already known" transaction error gracefully
    if (error.toString().includes("already known")) {
      log(`Transaction already known for address ${address}`);
      globalRequests.push(now);
      
      return sendStatus(reply, 200, "OK", "Funds already being sent", {
        status: "already_processing",
      });
    }
    
    log(`Error sending transaction: ${error.toString()}`);
    return sendError(
      reply,
      500,
      "Internal Server Error",
      "Error sending funds",
    );
  }
}
