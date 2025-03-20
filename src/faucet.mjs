import { Wallet } from "@ethersproject/wallet";
import { ethers } from "ethers";
import log from "./logger.mjs";
import { sendError, sendStatus } from "./http.mjs";

const globalRequests = [];
const HOURLY_LIMIT = 24;
const RATE_WINDOW = 60 * 60 * 1000;

export async function handleFaucetRequest(req, reply) {
  const startTime = Date.now();
  log(
    `Request started at ${new Date().toISOString()} for address: ${
      req.body?.address
    }`,
  );

  const { address } = req.body;

  try {
    ethers.utils.getAddress(address);
    log(`Address validation passed: ${address}`);
  } catch (err) {
    log(`Invalid address: ${req.body?.address}, error: ${err.toString()}`);
    return sendError(reply, 400, "Bad Request", "Invalid Ethereum address");
  }

  const now = Date.now();
  log(`Checking rate limits - elapsed time: ${now - startTime}ms`);

  const activeRequests = globalRequests.filter(
    (time) => now - time < RATE_WINDOW,
  );
  globalRequests.length = 0;
  activeRequests.forEach((time) => globalRequests.push(time));

  log(
    `Current request count in window: ${globalRequests.length}/${HOURLY_LIMIT}`,
  );

  if (globalRequests.length >= HOURLY_LIMIT) {
    log(`Rate limit exceeded - requests: ${globalRequests.length}`);
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

  log(`Setting up provider - elapsed time: ${Date.now() - startTime}ms`);

  let faucetWallet;
  let provider;
  let connectedWallet;

  try {
    faucetWallet = new Wallet(faucetPrivateKey);
    log(`Wallet created - faucet address: ${faucetWallet.address}`);

    provider = new ethers.providers.JsonRpcProvider(
      process.env.OPTIMISM_RPC_HTTP_HOST,
    );
    log(
      `Provider created with endpoint: ${process.env.OPTIMISM_RPC_HTTP_HOST}`,
    );

    connectedWallet = faucetWallet.connect(provider);
    log(
      `Wallet connected to provider - elapsed time: ${
        Date.now() - startTime
      }ms`,
    );
  } catch (error) {
    log(`Error setting up wallet or provider: ${error.toString()}`);
    return sendError(
      reply,
      500,
      "Internal Server Error",
      "Error connecting to blockchain",
    );
  }

  log(`Checking faucet balance - elapsed time: ${Date.now() - startTime}ms`);
  try {
    log(`Requesting balance for address: ${faucetWallet.address}`);
    const balanceCheckStart = Date.now();
    const faucetBalance = await provider.getBalance(faucetWallet.address);
    log(`Balance check completed in ${Date.now() - balanceCheckStart}ms`);

    if (faucetBalance.isZero()) {
      log(`Faucet balance is zero`);
      return sendError(
        reply,
        503,
        "Service Unavailable",
        "Faucet is out of funds",
      );
    }

    log(`Current balance: ${ethers.utils.formatEther(faucetBalance)} ETH`);
  } catch (error) {
    log(`Error checking faucet balance: ${error.toString()}`);
    log(`Stack trace: ${error.stack}`);
    return sendError(
      reply,
      500,
      "Internal Server Error",
      "Error checking faucet status",
    );
  }

  const sendAmount = ethers.utils.parseEther("0.000005");
  log(
    `Preparing to send ${ethers.utils.formatEther(
      sendAmount,
    )} ETH to ${address} - elapsed time: ${Date.now() - startTime}ms`,
  );

  try {
    log(`Initiating transaction`);
    const txStart = Date.now();

    const txRequest = {
      to: address,
      value: sendAmount,
      chainId: 10,
    };
    log(`Transaction request prepared: ${JSON.stringify(txRequest)}`);

    const tx = await connectedWallet.sendTransaction(txRequest);
    log(`Transaction sent in ${Date.now() - txStart}ms`);
    log(`Transaction hash: ${tx.hash}`);

    globalRequests.push(now);

    log(
      `Success: Sent ${ethers.utils.formatEther(
        sendAmount,
      )} ETH to ${address}, tx: ${tx.hash}, total time: ${
        Date.now() - startTime
      }ms`,
    );

    return sendStatus(reply, 200, "OK", "Funds sent successfully", {
      txHash: tx.hash,
      amount: ethers.utils.formatEther(sendAmount),
    });
  } catch (error) {
    log(`Transaction error for ${address}: ${error.toString()}`);
    log(`Error stack: ${error.stack}`);

    // Handle "already known" transaction error gracefully
    if (error.toString().includes("already known")) {
      log(`Transaction already known for address ${address}`);
      globalRequests.push(now);

      return sendStatus(reply, 200, "OK", "Funds already being sent", {
        status: "already_processing",
      });
    }

    // Check for timeout or network issues
    if (
      error.toString().includes("timeout") ||
      error.toString().includes("network") ||
      error.toString().includes("connection")
    ) {
      log(`Network timeout or connection issue: ${error.toString()}`);
      return sendError(
        reply,
        503,
        "Service Unavailable",
        "Network connection issue, please try again later",
      );
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
