// @format
// User communities (protocol 13.0.0).
//
// A community belongs to the identity that signs it and lives in that
// identity's namespace, so creating one needs no consensus: two people can
// both run a community called "AI". It is a `Community` message (see
// EIP712_COMMUNITY in src/constants.mjs). Signing a `Community` again under a
// name you already use updates that community; the newest version wins.
//
// A post goes into a community through today's amplify with one more field,
// `community`, set to the community's ID "<owner address>/<name key>". Nodes
// accept such a post only if the community already exists and is older than
// the post, the same check comments make against their story. Upvotes and
// comments don't name a community; a story stays in the community of its
// first submission.

// "Agent Builders" -> "agent-builders"
export function nameKey(name) {
  return name.toLowerCase().replace(/ /g, "-");
}

// The ID a post uses to name a community: "<owner address>/<name key>", with
// the address in lowercase.
export function communityId(owner, name) {
  return `${owner.toLowerCase()}/${nameKey(name)}`;
}

// The schema allows any case in the address part of a post's `community`.
export function normalizeId(id) {
  return id.toLowerCase();
}

export function create({ name, about, rules, icon, color, timestamp }) {
  return {
    type: "community",
    name,
    about,
    rules,
    icon,
    color,
    timestamp,
  };
}

// When each community was first created: the timestamp of its oldest version
// this node has seen, which is what the "older than the post" check needs.
// store.mjs fills it as communities are added; launch.mjs fills it from the
// trie at startup. The SQLite cache (cache.mjs) keeps the same value across
// restarts.
const created = new Map();

export function remember(id, timestamp) {
  const key = normalizeId(id);
  const known = created.get(key);
  if (known === undefined || timestamp < known) created.set(key, timestamp);
}

export function createdAt(id) {
  return created.get(normalizeId(id));
}

export function clear() {
  created.clear();
}
