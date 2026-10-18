// NOTE: Hot only shows stories from people with a name, to keep out
// throwaway accounts. A name is ENS, Lens, Farcaster or a Kiwi nickname
// (profiles.mjs, applied by ens.overlay). A story from someone without one
// still shows once enough other people with a name have upvoted it.
export const MIN_NAMED_UPVOTERS = 2;

export function hasName(profile) {
  return !!(
    profile &&
    (profile.ens ||
      profile.lens ||
      profile.farcaster ||
      profile.kiwiProfile?.name)
  );
}

// `story.submitter` is the resolved submitter, `story.upvoters` the upvoting
// addresses (the submitter's own submission counts as one; it's skipped).
export async function showInHot(story, resolve) {
  if (hasName(story.submitter)) return true;
  const submitter = (story.identity || "").toLowerCase();
  const others = [
    ...new Set((story.upvoters || []).map((address) => address.toLowerCase())),
  ].filter((address) => address !== submitter);
  if (others.length < MIN_NAMED_UPVOTERS) return false;

  let named = 0;
  for (const address of others) {
    try {
      if (hasName(await resolve(address))) named++;
    } catch (err) {
      // An upvoter we can't resolve doesn't count.
    }
    if (named >= MIN_NAMED_UPVOTERS) return true;
  }
  return false;
}
