import { eligibleAt } from "@attestate/delegator2";

import { ecrecover, toDigest } from "../id.mjs";
import { EIP712_MESSAGE } from "../constants.mjs";

async function enhance({ node, accounts, delegations }) {
  const cacheEnabled = false;
  const signer = ecrecover(node, EIP712_MESSAGE, cacheEnabled);
  const validationTime = new Date(node.timestamp * 1000);
  const identity = eligibleAt(accounts, delegations, {
    address: signer,
    validationTime,
  });
  if (!identity) {
    return null;
  }

  const { index } = toDigest(node);

  return {
    index,
    ...node,
    signer,
    identity,
  };
}
export default enhance;
