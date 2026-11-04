// Deploys the inbox (contracts/Inbox.sol) to Ethereum mainnet with its owner
// (EIP-173: it can transfer ownership and change the sequencer) and its
// sequencer, the only address that can commit to it:
//
//   node -r dotenv/config scripts/deploy-inbox.mjs <owner> <sequencer>
//
// with ETHEREUM_RPC_URL set and SEQUENCER_PRIVATE_KEY funded; that key sends
// the deployment. It prints INBOX_ADDRESS and INBOX_BLOCK for every node's
// .env.
//
// contracts/Inbox.json is the contract's ABI and bytecode, from
// `forge build` (Foundry, solc 0.8.28) in a folder with contracts/Inbox.sol
// as src/Inbox.sol: {abi, bytecode: bytecode.object} of out/Inbox.sol/Inbox.json.
import { env, argv, exit } from "process";
import { readFileSync } from "fs";

import { createWalletClient, createPublicClient, http, isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

const [owner, sequencer] = argv.slice(2);
if (!isAddress(owner ?? "") || !isAddress(sequencer ?? "")) {
  console.error("Usage: scripts/deploy-inbox.mjs <owner> <sequencer>");
  exit(1);
}

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
  args: [owner, sequencer],
});
console.log(`Sent ${hash}, waiting for it...`);
const receipt = await client.waitForTransactionReceipt({ hash });
console.log(`INBOX_ADDRESS=${receipt.contractAddress}`);
console.log(`INBOX_BLOCK=${receipt.blockNumber}`);
