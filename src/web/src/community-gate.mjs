// @format
// Whether a page loads Communities.jsx, which decides which communities are
// yours. The feeds' tabs and side box list your communities, so readers who
// can't have any skip it: nothing joined in this browser (`joined`, the
// stored list as Communities.jsx writes it) and no account that could run
// one. A community's own pages always need it (Join, Invite).
// NOTE: It reads the stored list itself: theme-init.js marks it too, but
// browsers may have cached a theme-init.js from before a deploy.
export function needsCommunities(kinds, joined, identity) {
  if (kinds.length === 0) return false;
  const lists = kinds.every((kind) => kind === "tabs" || kind === "side");
  return !lists || mayHaveCommunities(joined, identity);
}

// Whether a reader may have communities: some joined in this browser, or an
// account (it may run some). The submit page's "Post to" asks this too.
export function mayHaveCommunities(joined, identity) {
  let list = [];
  try {
    list = JSON.parse(joined || "[]");
  } catch (err) {
    list = [];
  }
  return (Array.isArray(list) && list.length > 0) || !!identity;
}
