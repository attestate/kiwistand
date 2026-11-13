// @format
// Community membership (protocol 14.0.0).
//
// Joining or leaving a community is a signed `Membership` message (see
// EIP712_MEMBERSHIP in src/constants.mjs): `type` is "join" or "leave" and
// `community` the community's ID, "<owner address>/<name key>". Nodes accept
// one only if the community already exists and is older than the message,
// the same rule as for posts to a community. They don't look at the signer's
// earlier memberships, so whether a node takes a message never depends on the
// order messages arrive in, and set reconciliation converges.
//
// A person's newest membership message per community says whether they're a
// member; of two with the same timestamp, the one with the greater message ID
// wins. A person is an identity: messages signed with a delegated key count
// for the account that delegated to it. The owner of a community is always a
// member, whether or not they signed a join.

export const TYPES = ["join", "leave"];

export function isMembership(message) {
  return TYPES.includes(message?.type);
}

export function create({ type, community, timestamp }) {
  return { type, community, timestamp };
}
