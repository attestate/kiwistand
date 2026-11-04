import { ecrecover, toDigest, messageTypes } from "../id.mjs";

async function enhance({ node }) {
  const cacheEnabled = false;
  const { index } = toDigest(node);

  // NOTE: A delegation keeps its own `identity`, which signed it (maybe a
  // smart wallet, whose signature store.add checked), and its own `signer`,
  // the key it lets sign for the identity (src/delegations.mjs).
  if (node.type === "delegation") return { index, ...node };

  const signer = ecrecover(node, messageTypes(node), cacheEnabled);
  return {
    index,
    ...node,
    signer,
  };
}
export default enhance;
