//@format
import htm from "htm";
import vhtml from "vhtml";
import DOMPurify from "isomorphic-dompurify";
import { formatDistanceToNowStrict } from "date-fns";

import { countComments } from "../../cache.mjs";
import { getSlug } from "../../utils.mjs";

const html = htm.bind(vhtml);

function ago(timestamp) {
  return formatDistanceToNowStrict(new Date(timestamp * 1000))
    .replace(/ seconds?/, "s")
    .replace(/ minutes?/, "m")
    .replace(/ hours?/, "h")
    .replace(/ days?/, "d");
}

function storyLink(story) {
  return `/stories/${getSlug(story.title)}?index=0x${story.index}`;
}

function counts(story) {
  const upvotes = Array.isArray(story.upvoters)
    ? story.upvoters.length
    : story.upvotes || 0;
  let comments = 0;
  try {
    comments = countComments(`kiwi:0x${story.index}`);
  } catch (err) {}
  return [
    upvotes ? `${upvotes} ${upvotes === 1 ? "like" : "likes"}` : null,
    comments ? `${comments} ${comments === 1 ? "comment" : "comments"}` : null,
  ].filter(Boolean);
}

// NOTE: Several stories about the same news event, grouped by
// src/clusters.mjs: a shared headline, then one row per story linking to its
// story page, newest first.
export default function StoryGroup(group) {
  const stories = group.stories;
  return html`
    <tr>
      <td>
        <section class="story-group" aria-label="${DOMPurify.sanitize(group.headline)}">
          <div class="story-group-label">
            Developing · ${stories.length} posts
          </div>
          <h2 class="story-group-headline">
            ${DOMPurify.sanitize(group.headline)}
          </h2>
          <ol class="story-group-list">
            ${stories.map((story) => {
              const name =
                story.displayName || story.submitter?.displayName || "";
              const avatar = story.submitter?.safeAvatar;
              const meta = [
                name ? `by ${DOMPurify.sanitize(name)}` : null,
                ...counts(story),
                ago(story.timestamp),
              ].filter(Boolean);
              return html`
                <li class="story-group-item">
                  <a class="story-group-link" href="${storyLink(story)}">
                    ${avatar
                      ? html`<img
                          class="story-group-avatar"
                          src="${DOMPurify.sanitize(avatar)}"
                          alt=""
                          width="20"
                          height="20"
                          loading="lazy"
                        />`
                      : html`<span class="story-group-avatar"></span>`}
                    <span class="story-group-text">
                      <span class="story-group-title"
                        >${DOMPurify.sanitize(story.title)}</span
                      >
                      <span class="story-group-meta">${meta.join(" · ")}</span>
                    </span>
                  </a>
                </li>
              `;
            })}
          </ol>
        </section>
      </td>
    </tr>
  `;
}
