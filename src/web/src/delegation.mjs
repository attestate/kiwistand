// @format
// A delegation (protocol 15.0.0, see /docs/delegation): the new key signs the
// account's address, the wallet signs the delegation, and the node takes it
// like any message. No transaction, no network switch, no ETH.
import { getAddress } from "@ethersproject/address";

import { EIP712_DOMAIN } from "./API.mjs";

export const EIP712_AUTHORIZATION = {
  Authorization: [
    { name: "from", type: "address" },
    { name: "authorize", type: "bool" },
  ],
};

export const EIP712_DELEGATION = {
  Delegation: [
    { name: "type", type: "string" },
    { name: "key", type: "address" },
    { name: "authorization", type: "bytes" },
    { name: "authorize", type: "bool" },
    { name: "timestamp", type: "uint256" },
  ],
};

// `key` is the new key (an ethers Wallet), `signer` the wallet's ethers
// signer. Returns the message and its signature for API.send.
export async function create(key, signer, account) {
  const from = getAddress(account);
  const authorization = await key._signTypedData(
    EIP712_DOMAIN,
    EIP712_AUTHORIZATION,
    { from, authorize: true },
  );
  const value = {
    type: "delegation",
    key: key.address,
    authorization,
    authorize: true,
    timestamp: Math.floor(Date.now() / 1000),
  };
  const signature = await signer._signTypedData(
    EIP712_DOMAIN,
    EIP712_DELEGATION,
    value,
  );
  return { message: { ...value, account: from }, signature };
}
