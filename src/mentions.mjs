// @format
// GET /api/v1/mentions?q=<prefix>&index=0x<story index>: the people the
// comment box suggests after "@" (src/web/src/mentions.mjs has how a
// mention is written). Answers {people: [{address, name, avatar}]}, at most
// MAX_PEOPLE: the story's people (who posted it, then who commented, most
// recent first) whose name starts with `q`, then other people with a name.
// Without `q`, only the story's people.
import { utils } from "ethers";

import log from "./logger.mjs";
import * as ens from "./ens.mjs";
import appCache, { getStoryPeople } from "./cache.mjs";
import * as karma from "./karma.mjs";
import * as profiles from "./profiles.mjs";
import { hasName } from "./hotnames.mjs";
import * as moderation from "./views/moderation.mjs";
import { sendError, sendStatus } from "./api.mjs";
import { nameOf } from "./web/src/mentions.mjs";

export const MAX_PEOPLE = 8;
export const MAX_QUERY = 32;
export const DIRECTORY_SIZE = 1000;
export const DIRECTORY_TTL_MS = 15 * 60 * 1000;
const storyPattern = /^0x[a-fA-F0-9]{72}$/;

// NOTE: Only reads the profile cache: looking up everyone who isn't cached
// would send a thousand requests to the profile APIs.
async function cachedProfile(address) {
  const cached = await appCache.get(`${ens.ENS_CACHE_PREFIX}${address}`);
  return ens.overlay(address, cached || { address });
}

const defaults = {
  getLists: () => moderation.getListsForStory(),
  resolve: (address) => ens.resolve(address),
  cachedProfile,
  storyPeople: (index) => getStoryPeople(index),
  ranking: () => karma.ranking(),
  nicknamed: (limit) => profiles.named(limit),
  now: () => Date.now(),
};

function person(address, profile) {
  return {
    address: utils.getAddress(address),
    name: nameOf(profile, address),
    avatar: profile?.safeAvatar || null,
  };
}

// The names a query matches the start of: the one shown, the ENS name and
// the Farcaster username.
function keys(profile, name) {
  return [name, profile?.ens, profile?.farcaster?.username]
    .filter((key) => typeof key === "string" && key)
    .map((key) => key.toLowerCase());
}

// NOTE: The other people with a name: the top of the karma ranking and
// everyone with a Kiwi nickname, whose cached profile has a name
// (hotnames.hasName), at most DIRECTORY_SIZE. Kept in memory per process and
// rebuilt in the background once it's older than DIRECTORY_TTL_MS.
let directory = { people: null, built: 0, pending: null };
export function resetDirectory() {
  directory = { people: null, built: 0, pending: null };
}

async function build(d) {
  const addresses = new Set([
    ...d
      .ranking()
      .slice(0, DIRECTORY_SIZE)
      .map(({ identity }) => identity.toLowerCase()),
    ...d.nicknamed(DIRECTORY_SIZE).map((address) => address.toLowerCase()),
  ]);
  const people = [];
  for (const address of addresses) {
    if (people.length >= DIRECTORY_SIZE) break;
    let profile;
    try {
      profile = await d.cachedProfile(address);
    } catch (err) {
      continue;
    }
    if (!hasName(profile)) continue;
    const entry = person(address, profile);
    people.push({ ...entry, keys: keys(profile, entry.name) });
  }
  return people;
}

function refresh(d) {
  if (!directory.pending) {
    const current = directory;
    current.pending = build(d)
      .then((people) => {
        directory = { people, built: d.now(), pending: null };
      })
      .catch((err) => {
        log(`mentions: Couldn't build the directory of names: ${err.stack}`);
        current.pending = null;
      });
  }
  return directory.pending;
}

async function named(d) {
  if (!directory.people) {
    await refresh(d);
  } else if (d.now() - directory.built > DIRECTORY_TTL_MS) {
    refresh(d);
  }
  return directory.people || [];
}

export async function suggest(q, story, deps = {}) {
  const d = { ...defaults, ...deps };
  const query = q.toLowerCase();

  let banned = [];
  try {
    banned = (await d.getLists()).addresses || [];
  } catch (err) {
    log(`mentions: Couldn't get the banned profiles: ${err}`);
  }
  const seen = new Set(banned);
  const people = [];

  const own = story
    ? [...new Set(d.storyPeople(story).map((a) => a.toLowerCase()))].filter(
        (address) => !seen.has(address),
      )
    : [];
  const resolved = await Promise.allSettled(
    own.map((address) => d.resolve(address)),
  );
  own.forEach((address, i) => {
    const profile =
      resolved[i].status === "fulfilled" ? resolved[i].value : null;
    const entry = person(address, profile);
    if (keys(profile, entry.name).some((key) => key.startsWith(query))) {
      seen.add(address);
      people.push(entry);
    }
  });
  if (!query) return people.slice(0, MAX_PEOPLE);

  for (const { keys: names, ...entry } of await named(d)) {
    if (people.length >= MAX_PEOPLE) break;
    const address = entry.address.toLowerCase();
    if (seen.has(address)) continue;
    if (!names.some((key) => key.startsWith(query))) continue;
    seen.add(address);
    people.push(entry);
  }
  return people.slice(0, MAX_PEOPLE);
}

export function handler(deps = {}) {
  return async (request, reply) => {
    reply.header("Cache-Control", "no-cache");
    const { q = "", index } = request.query;
    if (typeof q !== "string" || q.length > MAX_QUERY) {
      const details = `q must have at most ${MAX_QUERY} characters`;
      return sendError(reply, 400, "Bad Request", details);
    }
    if (
      index !== undefined &&
      (typeof index !== "string" || !storyPattern.test(index))
    ) {
      const details = "index must be a story's index (0x and 72 hex digits)";
      return sendError(reply, 400, "Bad Request", details);
    }

    let people;
    try {
      people = await suggest(q, index?.toLowerCase(), deps);
    } catch (err) {
      log(`/api/v1/mentions: ${err.stack}`);
      const details = "Couldn't find people to mention";
      return sendError(reply, 500, "Internal Server Error", details);
    }
    return sendStatus(reply, 200, "OK", "People to mention", { people });
  };
}
