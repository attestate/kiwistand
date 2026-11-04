// @format
// A delegation (protocol 15.0.0, see /docs/delegation): the new signer signs
// the identity's address, the identity's wallet signs the delegation, and the
// node takes it like any message. No transaction, no network switch, no ETH.
import { getAddress } from "@ethersproject/address";

import { EIP712_DOMAIN } from "./eip712.mjs";

export const EIP712_AUTHORIZATION = {
  Authorization: [
    { name: "identity", type: "address" },
    { name: "authorize", type: "bool" },
  ],
};

export const EIP712_DELEGATION = {
  Delegation: [
    { name: "type", type: "string" },
    { name: "signer", type: "address" },
    { name: "authorization", type: "bytes" },
    { name: "authorize", type: "bool" },
    { name: "timestamp", type: "uint256" },
  ],
};

// `signer` is the new key on this device (an ethers Wallet), `wallet` the
// identity's wallet (its ethers signer) and `identity` its address. Returns
// the message and its signature for API.send.
export async function create(signer, wallet, identity) {
  const address = getAddress(identity);
  const authorization = await signer._signTypedData(
    EIP712_DOMAIN,
    EIP712_AUTHORIZATION,
    { identity: address, authorize: true },
  );
  const value = {
    type: "delegation",
    signer: signer.address,
    authorization,
    authorize: true,
    timestamp: Math.floor(Date.now() / 1000),
  };
  const signature = await wallet._signTypedData(
    EIP712_DOMAIN,
    EIP712_DELEGATION,
    value,
  );
  return { message: { ...value, identity: address }, signature };
}
