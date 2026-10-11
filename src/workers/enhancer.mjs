import { ecrecover, toDigest, eip712Types } from "../id.mjs";

async function enhance({ node }) {
  const cacheEnabled = false;
  // NOTE: Anonymous upvotes aren't signed, so they have no signer.
  const signer =
    node.type === "anon-upvote"
      ? null
      : ecrecover(node, eip712Types(node), cacheEnabled);

  const { index } = toDigest(node);

  return {
    index,
    ...node,
    signer,
  };
}
export default enhance;
