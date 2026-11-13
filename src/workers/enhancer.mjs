import { ecrecover, toDigest, messageTypes } from "../id.mjs";

async function enhance({ node }) {
  const cacheEnabled = false;
  const signer = ecrecover(node, messageTypes(node), cacheEnabled);

  const { index } = toDigest(node);

  return {
    index,
    ...node,
    signer,
  };
}
export default enhance;
