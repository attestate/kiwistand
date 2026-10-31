// @format
// The read side of communities (protocol 13.0.0, src/communities.mjs):
// GET /api/v1/communities and /api/v1/communities/:owner/:key, the
// `community` query of the feeds, and the `community` object on stories. See
// "Reading communities" in docs/src/pages/http-api.mdx.
//
// NOTE: Communities are read through cache.listCommunities and
// cache.getCommunity only, with the delegations, which resolve a community's
// owner. Their `id` is the one posts name, "<owner lowercase>/<name key>",
// and a community's stories are the submissions whose `community` is it.
import { utils } from "ethers";

import * as cache from "./cache.mjs";
import * as registry from "./chainstate/registry.mjs";
import * as ens from "./ens.mjs";
import { hasName } from "./hotnames.mjs";
import * as moderation from "./views/moderation.mjs";
import { sendError, sendStatus } from "./api.mjs";
import { COMMUNITY_ID_PATTERN } from "./constants.mjs";
import log from "./logger.mjs";

const idPattern = new RegExp(COMMUNITY_ID_PATTERN);
const addressPattern = /^0x[a-fA-F0-9]{40}$/;

export const LIST_LIMIT = 50;
export const LIST_MAX_LIMIT = 200;

const defaults = {
  delegations: () => registry.delegations(),
  getLists: () => moderation.getLists(),
  resolve: (address) => ens.resolve(address),
  listCommunities: (delegations) => cache.listCommunities(delegations),
  getCommunity: (id, delegations) => cache.getCommunity(id, delegations),
  communityActivity: (id) => cache.communityActivity(id),
};

// A community ID from a request: undefined without one, else the lowercase
// ID. Throws for a value that isn't a community ID.
export function parseCommunity(value) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !idPattern.test(value)) {
    throw new Error(
      "community must be a community ID: <owner address>/<name key>",
    );
  }
  return value.toLowerCase();
}

// Express middleware for a community's feeds (/api/v1/communities/:owner/
// :key/…): 400 for an invalid ID, else the lowercase ID in
// res.locals.community.
export function communityParams(req, res, next) {
  try {
    res.locals.community = parseCommunity(
      `${req.params.owner}/${req.params.key}`,
    );
  } catch (err) {
    return sendError(res, 400, "Bad Request", err.message);
  }
  return next();
}

// Express middleware for Kiwi News' feeds: no community.
export function kiwiNews(req, res, next) {
  res.locals.community = undefined;
  return next();
}

function checksum(address) {
  try {
    return utils.getAddress(address);
  } catch (err) {
    return address;
  }
}

async function bannedAddresses(getLists) {
  try {
    return (await getLists()).addresses || [];
  } catch (err) {
    log(`communities: Couldn't get the moderation lists: ${err.message}`);
    return [];
  }
}

// The owner's display name, like a story's submitter's, or null without a
// name (ENS, Farcaster, Lens or a Kiwi nickname, see hotnames.mjs).
async function ownerName(owner, resolve) {
  try {
    const profile = await resolve(owner);
    return hasName(profile) ? profile.displayName : null;
  } catch (err) {
    return null;
  }
}

// The Community object of the API.
async function present(id, community, activity, resolve) {
  const { stories = 0, lastStory = null } = activity || {};
  return {
    id,
    owner: checksum(community.owner),
    ownerName: await ownerName(community.owner, resolve),
    name: community.name,
    about: community.about,
    rules: community.rules,
    icon: community.icon,
    color: community.color,
    created: community.created,
    timestamp: community.timestamp,
    stories,
    lastStory,
  };
}

// Most active first: by the newest story, then the communities without
// stories, the newest first.
export function byActivity(a, b) {
  if (a.lastStory !== b.lastStory) {
    if (a.lastStory === null) return 1;
    if (b.lastStory === null) return -1;
    return b.lastStory - a.lastStory;
  }
  if (a.created !== b.created) return b.created - a.created;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function parseLimit(value) {
  const limit = parseInt(value, 10);
  if (isNaN(limit) || limit < 1) return LIST_LIMIT;
  return Math.min(limit, LIST_MAX_LIMIT);
}

// GET /api/v1/communities. Throws a TypeError for invalid parameters.
// NOTE: The communities of a profile the moderation bans aren't listed, as
// its stories aren't.
export async function listCommunities({ q, owner, limit } = {}, deps = {}) {
  const d = { ...defaults, ...deps };
  if (q !== undefined && typeof q !== "string") {
    throw new TypeError("q must be a string");
  }
  if (owner === "") owner = undefined;
  if (owner !== undefined && !addressPattern.test(owner)) {
    throw new TypeError("owner must be an address");
  }

  const [delegations, banned] = await Promise.all([
    d.delegations(),
    bannedAddresses(d.getLists),
  ]);
  const query = (q || "").trim().toLowerCase();
  const communities = d
    .listCommunities(delegations)
    .filter(
      (community) =>
        !banned.includes(community.owner.toLowerCase()) &&
        (!owner || community.owner.toLowerCase() === owner.toLowerCase()) &&
        (!query ||
          community.name.toLowerCase().includes(query) ||
          community.about.toLowerCase().includes(query)),
    );

  const activity = d.communityActivity();
  const ranked = communities
    .map((community) => ({
      community,
      id: community.id,
      created: community.created,
      lastStory: activity.get(community.id)?.lastStory ?? null,
    }))
    .sort(byActivity)
    .slice(0, parseLimit(limit));
  return await Promise.all(
    ranked.map(({ id, community }) =>
      present(id, community, activity.get(id), d.resolve),
    ),
  );
}

// GET /api/v1/communities/:owner/:key: the Community object, or null when
// it isn't known (or its owner is banned). `owner` may be in any case.
export async function findCommunity(owner, key, deps = {}) {
  const d = { ...defaults, ...deps };
  const id = `${String(owner).toLowerCase()}/${key}`;
  if (!idPattern.test(id)) return null;

  const [delegations, banned] = await Promise.all([
    d.delegations(),
    bannedAddresses(d.getLists),
  ]);
  const community = d.getCommunity(id, delegations);
  if (!community || banned.includes(community.owner.toLowerCase())) {
    return null;
  }
  return await present(
    id,
    community,
    d.communityActivity(id).get(id),
    d.resolve,
  );
}

const CACHE_CONTROL = "public, s-maxage=30, max-age=0, stale-while-revalidate=300";

export function listHandler(deps = {}) {
  return async (request, reply) => {
    let communities;
    try {
      communities = await listCommunities(request.query, deps);
    } catch (err) {
      if (err instanceof TypeError) {
        return sendError(reply, 400, "Bad Request", err.message);
      }
      log(`/api/v1/communities: ${err.stack}`);
      return sendError(reply, 500, "Internal Server Error", "Couldn't list the communities");
    }
    reply.header("Cache-Control", CACHE_CONTROL);
    return sendStatus(reply, 200, "OK", "Communities", communities);
  };
}

export function detailHandler(deps = {}) {
  return async (request, reply) => {
    const { owner, key } = request.params;
    let community;
    try {
      community = await findCommunity(owner, key, deps);
    } catch (err) {
      log(`/api/v1/communities/${owner}/${key}: ${err.stack}`);
      return sendError(reply, 500, "Internal Server Error", "Couldn't read the community");
    }
    reply.header("Cache-Control", CACHE_CONTROL);
    if (!community) {
      return sendError(reply, 404, "Not Found", "Couldn't find the community");
    }
    return sendStatus(reply, 200, "OK", "Community", community);
  };
}

// Puts each story's community, {id, name, icon, color}, or null for a Kiwi
// News story, into `community`, in place of the cache's `communityId`.
// A community this node doesn't know (yet) is null as well. A story that
// already has its community object keeps it.
export async function withCommunities(stories, deps = {}) {
  const d = { ...defaults, ...deps };
  const idOf = (story) =>
    story.communityId ??
    (typeof story.community === "string" ? story.community : null);
  const needed = stories.some((story) => idOf(story));
  const delegations = needed ? await d.delegations() : undefined;

  const refs = new Map();
  function ref(id) {
    if (!id) return null;
    if (!refs.has(id)) {
      let community = null;
      try {
        community = d.getCommunity(id, delegations);
      } catch (err) {
        log(`withCommunities: Couldn't read community "${id}": ${err.message}`);
      }
      refs.set(
        id,
        community
          ? {
              id,
              name: community.name,
              icon: community.icon,
              color: community.color,
            }
          : null,
      );
    }
    return refs.get(id);
  }

  return stories.map((story) => {
    const { communityId, ...rest } = story;
    if (story.community && typeof story.community === "object") return rest;
    return { ...rest, community: ref(idOf(story)) };
  });
}

// Every community this node knows, by ID, as withCommunities puts it on a
// story: for the home feed, which renders in a worker thread that has no
// delegations to find a community's owner with (http.mjs feedPiscina).
export async function communityRefs(deps = {}) {
  const d = { ...defaults, ...deps };
  const delegations = await d.delegations();
  const refs = {};
  for (const { id, name, icon, color } of d.listCommunities(delegations)) {
    refs[id] = { id, name, icon, color };
  }
  return refs;
}
