// Deploys the inbox (contracts/Inbox.sol) to Ethereum mainnet, from the
// sequencer's key, which becomes the only address that can commit to it:
//
//   node -r dotenv/config scripts/deploy-inbox.mjs
//
// with ETHEREUM_RPC_URL and SEQUENCER_PRIVATE_KEY set (and funded). It prints
// INBOX_ADDRESS, INBOX_BLOCK and SEQUENCER_ADDRESS for every node's .env.
//
// contracts/Inbox.json is the contract's ABI and bytecode, from
// `forge build` (Foundry, solc 0.8.28) in a folder with contracts/Inbox.sol
// as src/Inbox.sol: {abi, bytecode: bytecode.object} of out/Inbox.sol/Inbox.json.
import { env } from "process";
import { readFileSync } from "fs";

import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

const { abi, bytecode } = JSON.parse(
  readFileSync(new URL("../contracts/Inbox.json", import.meta.url)),
);
const account = privateKeyToAccount(env.SEQUENCER_PRIVATE_KEY);
const transport = http(env.ETHEREUM_RPC_URL);
const wallet = createWalletClient({ account, chain: mainnet, transport });
const client = createPublicClient({ chain: mainnet, transport });

const hash = await wallet.deployContract({
  abi,
  bytecode,
  args: [account.address],
});
console.log(`Sent ${hash}, waiting for it...`);
const receipt = await client.waitForTransactionReceipt({ hash });
console.log(`INBOX_ADDRESS=${receipt.contractAddress}`);
console.log(`INBOX_BLOCK=${receipt.blockNumber}`);
console.log(`SEQUENCER_ADDRESS=${account.address}`);
