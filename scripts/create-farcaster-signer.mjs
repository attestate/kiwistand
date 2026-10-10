#!/usr/bin/env node
// @format
//
// Creates a Neynar-managed Farcaster signer so the server can cast as the
// Kiwi account (FC_SIGNER_UUID for src/social-posting.mjs).
//
//   node scripts/create-farcaster-signer.mjs
//
// Needs NEYNAR_API_KEY and FC_SEED_PHRASE (the custody mnemonic of the Kiwi
// Farcaster account). The script signs a signed key request with the custody
// key, registers it with Neynar and prints an approval URL. Open it on a
// phone logged into the Kiwi account, approve, then set FC_SIGNER_UUID in
// .env and check with `node scripts/social-test.mjs --channel farcaster --send`.
//
// Without FC_SEED_PHRASE you can create and approve a signer for the account
// in the Neynar developer portal instead and copy its UUID.
import "dotenv/config";
import { env, exit } from "process";
import { NeynarAPIClient, Configuration } from "@neynar/nodejs-sdk";
import { Wallet } from "ethers";

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

if (!env.NEYNAR_API_KEY) {
  console.error("NEYNAR_API_KEY environment variable is required");
  exit(1);
}
if (!env.FC_SEED_PHRASE) {
  console.error(
    "FC_SEED_PHRASE (custody mnemonic of the Kiwi account) is required to approve the signer. Alternatively create a signer in the Neynar developer portal.",
  );
  exit(1);
}

const client = new NeynarAPIClient(
  new Configuration({ apiKey: env.NEYNAR_API_KEY }),
);

try {
  const wallet = Wallet.fromMnemonic(env.FC_SEED_PHRASE);
  const { user } = await client.lookupUserByCustodyAddress({
    custodyAddress: wallet.address,
  });
  console.log(`Custody address ${wallet.address} belongs to fid ${user.fid} (@${user.username})`);

  const signer = await client.createSigner();
  const deadline = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
  const signature = await wallet._signTypedData(
    SIGNED_KEY_REQUEST_VALIDATOR,
    SIGNED_KEY_REQUEST_TYPE,
    { requestFid: user.fid, key: signer.public_key, deadline },
  );
  const registered = await client.registerSignedKey({
    signerUuid: signer.signer_uuid,
    appFid: user.fid,
    deadline,
    signature,
  });

  console.log(`\nSigner UUID: ${registered.signer_uuid}`);
  console.log(`Status: ${registered.status}`);
  if (registered.signer_approval_url) {
    console.log(`\nApprove it while logged into @${user.username}:`);
    console.log(registered.signer_approval_url);
  }
  console.log(`\nThen add to .env:\nFC_SIGNER_UUID=${registered.signer_uuid}`);
} catch (error) {
  console.error("Failed to create signer:", error.message);
  if (error.response?.data) console.error("API Error:", error.response.data);
  exit(1);
}
