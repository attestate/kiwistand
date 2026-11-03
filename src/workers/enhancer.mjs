import { utils } from "ethers";

import { ecrecover, toDigest, messageTypes } from "../id.mjs";

async function enhance({ node }) {
  const cacheEnabled = false;
  // NOTE: A delegation is signed by its account, maybe a smart wallet, whose
  // signature store.add checked (src/delegations.mjs).
  const signer =
    node.type === "delegation"
      ? utils.getAddress(node.account)
      : ecrecover(node, messageTypes(node), cacheEnabled);

  const { index } = toDigest(node);

  return {
    index,
    ...node,
    signer,
  };
}
export default enhance;
