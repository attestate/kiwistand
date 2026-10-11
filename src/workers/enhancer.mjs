import { ecrecover, toDigest, eip712Types } from "../id.mjs";

async function enhance({ node }) {
  const cacheEnabled = false;
  const signer = ecrecover(node, eip712Types(node), cacheEnabled);

  const { index } = toDigest(node);

  return {
    index,
    ...node,
    signer,
  };
}
export default enhance;
