import { resolveIdentity } from "@attestate/delegator2";

import { ecrecover, toDigest } from "../id.mjs";
import { EIP712_MESSAGE } from "../constants.mjs";

async function enhance({ node, delegations }) {
  const cacheEnabled = false;
  const signer = ecrecover(node, EIP712_MESSAGE, cacheEnabled);
  const identity = resolveIdentity(delegations, signer);

  const { index } = toDigest(node);

  return {
    index,
    ...node,
    signer,
    identity,
  };
}
export default enhance;
