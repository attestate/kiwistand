#!/usr/bin/env node
// @format
//
// Registers our own ed25519 key (an "app key") for the Kiwi Farcaster
// account, so src/social-posting.mjs can sign casts itself and submit them
// to any Farcaster hub (FC_HUB_URL), without a paid Neynar plan.
//
//   node scripts/create-farcaster-key.mjs          # dry run: prints the plan
//   node scripts/create-farcaster-key.mjs --send   # sends the transaction
//
// Needs FC_SEED_PHRASE (custody mnemonic of the Kiwi Farcaster account) and
// OPTIMISM_RPC_HTTP_HOST. The custody address pays the gas for one
// KeyGateway.add() call on OP Mainnet, so it needs a little ETH there.
//
// On success it prints FC_FID and FC_SIGNER_PRIVATE_KEY for .env. Keep the
// private key as secret as the seed phrase: it can cast as Kiwi News (but
// can't move the account). Revoke it anytime via KeyRegistry.remove().
import "dotenv/config";
import crypto from "crypto";
import { env, argv, exit } from "process";
import { ethers } from "ethers";
import {
  NobleEd25519Signer,
  KEY_GATEWAY_ADDRESS,
  keyGatewayABI,
  ID_REGISTRY_ADDRESS,
  idRegistryABI,
} from "@farcaster/hub-nodejs";

// NOTE: https://docs.farcaster.xyz/reference/contracts/reference/signed-key-request-validator
const SIGNED_KEY_REQUEST_VALIDATOR = {
  name: "Farcaster SignedKeyRequestValidator",
  version: "1",
  chainId: 10,
  verifyingContract: "0x00000000FC700472606ED4fA22623Acf62c60553",
};
const SIGNED_KEY_REQUEST_TYPE = {
  SignedKeyRequest: [
    { name: "requestFid", type: "uint256" },
    { name: "key", type: "bytes" },
    { name: "deadline", type: "uint256" },
  ],
};

const send = argv.includes("--send");

if (!env.FC_SEED_PHRASE || !env.OPTIMISM_RPC_HTTP_HOST) {
  console.error("FC_SEED_PHRASE and OPTIMISM_RPC_HTTP_HOST are required");
  exit(1);
}

const rpc = env.OPTIMISM_RPC_HTTP_HOST.split(",")[0];
const provider = new ethers.providers.JsonRpcProvider(rpc, 10);
const custody = ethers.Wallet.fromMnemonic(env.FC_SEED_PHRASE).connect(provider);

const idRegistry = new ethers.Contract(ID_REGISTRY_ADDRESS, idRegistryABI, provider);
const fid = (await idRegistry.idOf(custody.address)).toNumber();
if (!fid) {
  console.error(`No Farcaster account for custody address ${custody.address}`);
  exit(1);
}

const privateKey = crypto.randomBytes(32);
const signer = new NobleEd25519Signer(privateKey);
const publicKey = await signer.getSignerKey();
if (publicKey.isErr()) {
  console.error(`Could not derive the public key: ${publicKey.error.message}`);
  exit(1);
}
const key = ethers.utils.hexlify(publicKey.value);

// The account requests its own key, so requestFid is our fid and the
// custody key signs the request.
const deadline = Math.floor(Date.now() / 1000) + 60 * 60;
const signature = await custody._signTypedData(
  SIGNED_KEY_REQUEST_VALIDATOR,
  SIGNED_KEY_REQUEST_TYPE,
  { requestFid: fid, key, deadline },
);
const metadata = ethers.utils.defaultAbiCoder.encode(
  ["tuple(uint256 requestFid, address requestSigner, bytes signature, uint256 deadline)"],
  [[fid, custody.address, signature, deadline]],
);

const balance = await provider.getBalance(custody.address);
console.log(`Account: fid ${fid}, custody ${custody.address}`);
console.log(`Custody balance on OP Mainnet: ${ethers.utils.formatEther(balance)} ETH`);
console.log(`New key: ${key}`);

const gateway = new ethers.Contract(KEY_GATEWAY_ADDRESS, keyGatewayABI, custody);
if (!send) {
  const gas = await gateway.estimateGas.add(1, key, 1, metadata);
  console.log(`Dry run: KeyGateway.add would use about ${gas.toString()} gas.`);
  console.log("Run again with --send to register the key.");
  exit(0);
}

const tx = await gateway.add(1, key, 1, metadata);
console.log(`Sent ${tx.hash}, waiting for confirmation...`);
await tx.wait();
console.log("Registered. Add to .env:");
console.log(`FC_FID=${fid}`);
console.log(`FC_SIGNER_PRIVATE_KEY=0x${privateKey.toString("hex")}`);
console.log("FC_HUB_URL=<a hub's HTTP API, e.g. https://<hub>:2281>");
