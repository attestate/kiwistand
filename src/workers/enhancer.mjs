import { ecrecover, toDigest } from "../id.mjs";
import { EIP712_MESSAGE } from "../constants.mjs";

async function enhance({ node }) {
  const cacheEnabled = false;
  const signer = ecrecover(node, EIP712_MESSAGE, cacheEnabled);

  const { index } = toDigest(node);

  return {
    index,
    ...node,
    signer,
  };
}
export default enhance;
