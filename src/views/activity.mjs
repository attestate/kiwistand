
import htm from "htm";
import vhtml from "vhtml";
import normalizeUrl from "normalize-url";
import { sub } from "date-fns";
import { utils } from "ethers";
import DOMPurify from "isomorphic-dompurify";

import * as ens from "../ens.mjs";
import * as registry from "../chainstate/registry.mjs";
import { custom } from "./components/head.mjs";
import { Tile, communityPath } from "./components/communities.mjs";
import { Page, EmptyState, Icon, timeAgo } from "./components/n2.mjs";
import { getSlug } from "../utils.mjs";
import {
  MAX_AVATARS,
  newestDistinct,
  othersText,
  headlineText,
  groupReactions,
  groupJoins,
} from "./activity-groups.mjs";
import {
  getUpvotes,
  getComments,
  getReactionsToComments,
  getJoins,
  getTimestamp,
  setTimestamp,
} from "../cache.mjs";

const html = htm.bind(vhtml);

const generateFeed = (messages) => {
  const groupedMessages = {};

  messages
    .sort((a, b) => a.timestamp - b.timestamp)
    .forEach((message) => {
      // Skip normalization for text posts and kiwi references
      const href = (message.href && (message.href.startsWith('data:') || message.href.startsWith('kiwi:')))
        ? message.href
        : normalizeUrl(!!message.href && message.href, { stripWWW: false });

      if (!groupedMessages[href]) {
        groupedMessages[href] = {
          identities: [],
          verb: "submitted",
          message,
          timestamp: message.timestamp,
          towards: message.identity,
          index: message.index,
        };
      } else {
        if (message.timestamp > groupedMessages[href].timestamp) {
          groupedMessages[href].timestamp = message.timestamp;
        }
        groupedMessages[href].identities.push(message.identity);
        groupedMessages[href].verb = "liked";
      }
    });

  return Object.values(groupedMessages);
};

export function truncateComment(comment, maxLength = 260) {
  if (comment.length <= maxLength) return comment;
  return comment.slice(0, comment.lastIndexOf(" ", maxLength)) + "...";
}

function linkFromComment(activity) {
  // For reaction notifications
  // NOTE: The same #0x… anchor as a comment notification (the story page
  // scrolls to and highlights the comment), plus the emoji: the story page
  // then pops it on the comment's reaction chip (reactionBurst.mjs). A
  // group of reactions pops the newest one.
  if (activity.verb === "reacted" || activity.verb === "reactions") {
    const submissionIndex = activity.message.submissionId.split(":")[1];
    const commentId = activity.message.commentId.split(":")[1];
    const slug = getSlug(activity.message.submission_title);
    const reaction = activity.emoji
      ? `&reaction=${encodeURIComponent(activity.emoji)}`
      : "";
    return `/stories/${slug}?index=${submissionIndex}${reaction}#${commentId}`;
  }

  // For regular comments
  const [_, index] = activity.message.href.split(":");
  const slug = getSlug(activity.message.submission_title);
  const link = `/stories/${slug}?index=${index}#0x${activity.message.index}`;
  return link;
}

function linkFromLike(activity) {
  const title = DOMPurify.sanitize(activity.message.title);
  return `/stories/${getSlug(title)}?index=0x${activity.message.index}`;
}

// NOTE: Someone joined one of your communities (protocol 14.0.0): its page.
function linkFromJoin(activity) {
  return communityPath(activity.message.community.id);
}

export function href(activity) {
  if (activity.verb === "joined" || activity.verb === "joins") {
    return linkFromJoin(activity);
  }
  return activity.verb === "liked"
    ? linkFromLike(activity)
    : linkFromComment(activity);
}

const spinnerOnClick =
  "if(!event.ctrlKey && !event.metaKey && !event.shiftKey && event.button !== 1) {var el=document.getElementById('spinner-overlay'); if(el) el.style.display='block';}";

const profileLink = (address) => `/upvotes?address=${address}`;

// NOTE: Mobile shows the apps' marks (heart with "+1 🥝", the commenter's
// avatar, a spark for reactions); desktop shows a small icon box, like the
// designs.
function Avatar(identity) {
  return identity && identity.safeAvatar
    ? html`<img
        class="n2-notif-avatar"
        src="${DOMPurify.sanitize(identity.safeAvatar)}"
        loading="lazy"
        alt=""
      />`
    : html`<span class="n2-notif-avatar">${Icon("person")}</span>`;
}

function Mark(kind, identity) {
  const mobile =
    kind === "like"
      ? html`<span class="n2-notif-like"
          >${Icon("heart")}<span class="n2-notif-karma">+1 🥝</span></span
        >`
      : kind === "react"
      ? html`<span class="n2-notif-spark">${Icon("sparkle")}</span>`
      : Avatar(identity);
  const desktopIcon = { like: "heart", comment: "chat", react: "sparkle" }[
    kind
  ];
  return html`<span class="n2-notif-mark">
    <span class="n2-m">${mobile}</span>
    <span class="n2-notif-box n2-d">${Icon(desktopIcon)}</span>
  </span>`;
}

function Row({ isNew, href, i, mark, headline, comment, timestamp }) {
  return html`<li class="n2-notif${isNew ? " is-new" : ""}">
    <a
      class="n2-notif-link notification"
      href="${href}"
      data-no-instant="${i < 3}"
      onclick="${spinnerOnClick}"
    >
      ${mark}
      <span class="n2-notif-body">
        <span class="n2-notif-headline">${headline}</span>
        ${comment
          ? html`<span class="n2-notif-comment">${comment}</span>`
          : null}
        <span class="n2-notif-when">${timeAgo(timestamp)}</span>
      </span>
      ${isNew ? html`<span class="n2-notif-dot" aria-label="New"></span>` : null}
    </a>
  </li>`;
}

// NOTE: One of the faces above a grouped notification (Farcaster's
// NotificationAvatars): 24px, links to the person's profile. Fixed sizes, so
// the row doesn't shift when the images load.
function Face(actor) {
  const name = actor.displayName || actor.address;
  return html`<a
    class="n2-notif-face"
    href="${profileLink(actor.address)}"
    title="${name}"
    aria-label="${name}"
    >${actor.safeAvatar
      ? html`<img
          src="${DOMPurify.sanitize(actor.safeAvatar)}"
          width="24"
          height="24"
          loading="lazy"
          alt=""
        />`
      : Icon("person")}</a
  >`;
}

// NOTE: Likes on a story and reactions to a comment, grouped like the
// Farcaster client's notification groups: the mark, the faces of up to
// MAX_AVATARS people (newest first), "<newest> and N others <predicate>" and
// the story's title or the comment in the secondary colour. The faces and
// the name link to profiles, so the row isn't one link: a cover link under
// them goes to the story (no links inside links).
function GroupRow({
  isNew,
  href,
  i,
  kind,
  mark,
  activity,
  predicate,
  extra,
  text,
}) {
  const [newest] = activity.actors;
  const name = newest.displayName || newest.address;
  const label = `${headlineText(name, activity.actorCount, predicate)}${
    extra ? ` ${extra}` : ""
  }`;
  return html`<li class="n2-notif n2-notif-group${isNew ? " is-new" : ""}">
    <div class="n2-notif-link">
      <a
        class="n2-notif-cover notification"
        href="${href}"
        aria-label="${label}"
        data-no-instant="${i < 3}"
        onclick="${spinnerOnClick}"
      ></a>
      ${mark || Mark(kind)}
      <span class="n2-notif-body">
        <span class="n2-notif-faces">${activity.actors.map(Face)}</span>
        <span class="n2-notif-headline"
          ><a class="n2-notif-name" href="${profileLink(newest.address)}"
            >${name}</a
          >${othersText(activity.actorCount)} ${predicate}${extra
            ? html` <span class="n2-notif-emojis">${extra}</span>`
            : null}</span
        >
        ${text ? html`<span class="n2-notif-comment">${text}</span>` : null}
        <span class="n2-notif-when">${timeAgo(activity.timestamp)}</span>
      </span>
      ${isNew ? html`<span class="n2-notif-dot" aria-label="New"></span>` : null}
    </div>
  </li>`;
}

const Quote = (text) => html`<span class="n2-q">${text}</span>`;

function generateRow(lastUpdate) {
  return (activity, i) => {
    const isNew = lastUpdate < activity.timestamp;

    if (activity.verb === "commented" || activity.verb === "involved") {
      const identity = activity.identities[0];
      return Row({
        isNew,
        i,
        href: linkFromComment(activity),
        mark: Mark("comment", identity),
        headline: html`${identity.displayName} commented on${" "}${Quote(
            DOMPurify.sanitize(activity.message.submission_title),
          )}`,
        comment: DOMPurify.sanitize(truncateComment(activity.message.title)),
        timestamp: activity.timestamp,
      });
    }

    if (activity.verb === "reactions" && activity.actors?.length) {
      return GroupRow({
        isNew,
        i,
        href: linkFromComment(activity),
        kind: "react",
        activity,
        predicate: "reacted to your comment",
        extra: activity.emojis.join(" "),
        text: DOMPurify.sanitize(
          truncateComment(activity.message.comment_title),
        ),
      });
    }

    // NOTE: The people who joined one of your communities, under its icon in
    // its colour.
    if (activity.verb === "joins" && activity.actors?.length) {
      const { community } = activity.message;
      return GroupRow({
        isNew,
        i,
        href: linkFromJoin(activity),
        kind: "join",
        mark: html`<span class="n2-notif-mark"
          >${Tile(community, 32, 18)}</span
        >`,
        activity,
        predicate: "joined your community",
        text: DOMPurify.sanitize(community.name),
      });
    }

    if (activity.verb === "liked" && activity.actors?.length) {
      return GroupRow({
        isNew,
        i,
        href: linkFromLike(activity),
        kind: "like",
        activity,
        predicate: "liked your story",
        text: DOMPurify.sanitize(activity.message.title),
      });
    }
    return null;
  };
}

const Heading = html`<header class="n2-page-head">
  <h1 class="n2-title">
    <span class="n2-d">Notifications</span
    ><span class="n2-m">Your notifications</span>
  </h1>
  <p class="n2-sub n2-m">The conversation continues.</p>
</header>`;

// NOTE: `notifications` is data()'s `feed`: likes grouped per story,
// reactions grouped per comment and joins grouped per community.
export async function page(
  theme,
  identity,
  notifications,
  lastUpdate,
  isQueryParamVersion,
) {
  identity = DOMPurify.sanitize(identity);
  const newCount = notifications.filter(
    (n) => lastUpdate < n.timestamp,
  ).length;
  const feed =
    notifications.length === 0
      ? EmptyState({ icon: "bell", text: "No notifications yet" })
      : html`<ol class="n2-notif-list">
          ${notifications.map(generateRow(lastUpdate))}
        </ol>`;
  const preloadNotifs = notifications.slice(0, 3).map(href);
  return Page({
    theme,
    path: "/activity",
    head: custom(
      undefined,
      "Activity | Kiwi News",
      "Your latest notifications and activity on Kiwi News.",
      undefined,
      ["/", ...preloadNotifs],
    ),
    body: html`<div class="n2-notifs">
      ${Heading}
      ${newCount > 0
        ? html`<div class="n2-notifs-toolbar n2-d">
            <span class="n2-eyebrow">${newCount} new</span>
            ${
              // NOTE: Opening this page marks everything as read (the
              // lastUpdate cookie), so loading it again without the
              // lastUpdate parameter shows them as read.
              html`<a
                class="n2-mark-read"
                href="${isQueryParamVersion
                  ? `/activity?address=${identity}`
                  : "/activity"}"
                >Mark all as read</a
              >`
            }
          </div>`
        : null}
      ${feed}
    </div>`,
  });
}

// NOTE: /activity without an identity cookie, like the apps' logged-out
// notifications tab. main.jsx turns <kiwi-login-button> into a button that
// opens the login (LoginButton.jsx); the link is there until it loads.
export async function loggedOutPage(theme) {
  return Page({
    theme,
    path: "/activity",
    head: custom(
      undefined,
      "Notifications | Kiwi News",
      "Your latest notifications and activity on Kiwi News.",
    ),
    body: EmptyState({
      cls: "n2-empty-full",
      image: "/kiwi-glasses.webp",
      text: "Log in to see notifications when people like your content or reply to you.",
      action: html`<kiwi-login-button data-class="n2-btn n2-btn-wide"
        ><a class="n2-btn n2-btn-wide" href="/">Log in</a></kiwi-login-button
      >`,
    }),
  });
}

// `options.delegations`: the delegations to find the owner's communities and
// their members with; registry.delegations() by default. `options.resolve`:
// how to resolve a profile; ens.resolve by default.
export async function data(
  trie,
  identity,
  lastRemoteValue,
  skipDetails = false,
  options = {},
) {
  if (!identity) {
    throw new Error("Address has to be a query parameter");
  }
  if (!utils.isAddress(identity)) {
    throw new Error("Not a valid address");
  }

  let latestValue = getTimestamp(identity);
  if (!latestValue || latestValue < lastRemoteValue) {
    latestValue = lastRemoteValue;
    setTimestamp(identity, latestValue);
  }

  const cutoff = sub(new Date(), {
    weeks: 2,
  });

  let leaves = getUpvotes(identity);
  let comments = getComments(identity);
  let reactions = getReactionsToComments(identity);

  const path = "/activity";
  const activities = generateFeed(leaves).filter(
    (activity) => activity.verb === "liked",
  );

  comments.map((comment) => {
    activities.push({
      verb: "commented",
      message: comment,
      timestamp: comment.timestamp,
      identities: [comment.identity],
    });
  });

  // NOTE: The people who joined your communities (protocol 14.0.0), from the
  // memberships table, like comments from the last three weeks. They're
  // `joins`, not in `notifications`: the apps' notifications list would show
  // a verb it doesn't know as a like.
  const joinActivities = [];
  if (!skipDetails) {
    const delegations = options.delegations ?? (await registry.delegations());
    const threeWeeksAgo = Math.floor(Date.now() / 1000) - 1814400;
    for (const join of getJoins(identity, delegations, threeWeeksAgo)) {
      const { id, name, icon, color } = join.community;
      joinActivities.push({
        verb: "joined",
        message: {
          index: join.index,
          identity: join.identity,
          timestamp: join.timestamp,
          community: { id, name, icon, color },
        },
        timestamp: join.timestamp,
        identities: [join.identity],
      });
    }
  }

  // Process reactions - only include them if we'll resolve ENS data later
  if (!skipDetails) {
    reactions.map((reaction) => {
      activities.push({
        verb: "reacted",
        message: reaction,
        timestamp: reaction.timestamp,
        identities: [reaction.identity],
        emoji: reaction.title,
      });
    });
  }

  activities.sort((a, b) => b.timestamp - a.timestamp);

  // NOTE: Profiles are cached (ens.resolve reads the cache and fetches
  // misses in the background), and each address is resolved once per
  // request: a story with hundreds of likes only resolves the MAX_AVATARS
  // newest likers it shows (and the oldest one, the apps' first actor).
  const profiles = new Map();
  const profile = (address) => {
    const key = address.toLowerCase();
    if (!profiles.has(key)) {
      profiles.set(
        key,
        (options.resolve ?? ens.resolve)(address)
          .then((ensData) => ({ address, ...ensData }))
          .catch(() => null),
      );
    }
    return profiles.get(key);
  };
  const unresolved = (address) => {
    const truncatedAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
    return {
      address,
      truncatedAddress,
      displayName: truncatedAddress,
      safeAvatar: null,
    };
  };
  const actor = ({ address, displayName, safeAvatar }) => ({
    address,
    displayName,
    safeAvatar: safeAvatar || null,
  });

  const enriched = new Map();
  const enrich = (activity) => {
    if (!enriched.has(activity)) {
      enriched.set(
        activity,
        enrichOne(activity).catch(() => null),
      );
    }
    return enriched.get(activity);
  };
  async function enrichOne(activity) {
    if (skipDetails) return { ...activity, identities: [] };

    if (activity.verb === "liked") {
      // NOTE: `identities` stays every liker, oldest first (the iOS app
      // counts them and names the first); `actors` are the newest distinct
      // ones the rows show, `actorCount` all distinct likers.
      const newest = newestDistinct(activity.identities, identity);
      const shown = newest.slice(0, MAX_AVATARS);
      const resolve = new Set(
        [...shown, activity.identities[0]].map((a) => a.toLowerCase()),
      );
      const identities = (
        await Promise.all(
          activity.identities.map((address) =>
            resolve.has(address.toLowerCase())
              ? profile(address)
              : unresolved(address),
          ),
        )
      ).filter(Boolean);
      const actors = (await Promise.all(shown.map(profile)))
        .filter(Boolean)
        .map(actor);
      return {
        ...activity,
        identities,
        actors,
        actorCount: newest.length,
      };
    }

    const identities = (
      await Promise.all(activity.identities.map(profile))
    ).filter(Boolean);
    // Skip reaction activities if the reactor doesn't have an avatar
    if (
      activity.verb === "reacted" &&
      !identities.some((identity) => identity.safeAvatar)
    ) {
      return null;
    }
    return { ...activity, identities };
  }

  // NOTE: Reactions to one comment are one row on the page, like the
  // Farcaster client groups reactions per cast. Reactors without an avatar
  // are left out, like single reaction notifications.
  async function enrichReactions(group) {
    const resolved = await Promise.all(group.reactors.slice(0, 50).map(profile));
    const reactors = resolved.filter((p) => p && p.safeAvatar);
    if (reactors.length === 0) return null;
    return {
      ...group,
      actors: reactors.slice(0, MAX_AVATARS).map(actor),
      actorCount: reactors.length,
    };
  }

  // NOTE: Joins to one community are one row on the page, like likes on a
  // story. Members without a profile show their address.
  async function enrichJoins(group) {
    const shown = group.members.slice(0, MAX_AVATARS);
    const actors = (
      await Promise.all(
        shown.map(async (address) => (await profile(address)) || unresolved(address)),
      )
    ).map(actor);
    return { ...group, actors, actorCount: group.members.length };
  }

  const notifications = (
    await Promise.all(activities.slice(0, 20).map(enrich))
  ).filter(Boolean);
  const joins = (
    await Promise.all(joinActivities.slice(0, 20).map(enrich))
  ).filter(Boolean);

  // NOTE: The page's rows (`feed`): likes and comments as in
  // `notifications`, reactions grouped per comment. The API keeps
  // `notifications` as it was (the iOS app reads it).
  let feed = [];
  if (!skipDetails) {
    const groups = groupReactions(
      activities.filter((activity) => activity.verb === "reacted"),
      identity,
    );
    const rows = [
      ...activities.filter((activity) => activity.verb !== "reacted"),
      ...groups,
      ...groupJoins(joinActivities, identity),
    ]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20);
    feed = (
      await Promise.all(
        rows.map((row) =>
          row.verb === "reactions"
            ? enrichReactions(row)
            : row.verb === "joins"
            ? enrichJoins(row)
            : enrich(row),
        ),
      )
    ).filter(Boolean);
  }

  let lastUpdate = "0";
  const newest = Math.max(
    notifications[0]?.timestamp ?? 0,
    joins[0]?.timestamp ?? 0,
  );
  if (newest > 0) {
    lastUpdate = newest;
  }
  return {
    notifications: notifications,
    joins,
    feed,
    lastUpdate,
    latestValue,
  };
}
