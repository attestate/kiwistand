//@format
import htm from "htm";
import vhtml from "vhtml";
import DOMPurify from "isomorphic-dompurify";
import { getSlug } from "../../utils.mjs";
import { extractDomain } from "./row.mjs";
import { transformImageUrl } from "../utils/imageLoading.mjs";

const html = htm.bind(vhtml);

const chevronLeftSVG = html`<svg
  style="width: 20px; height: 20px;"
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 256 256"
  fill="none"
>
  <polyline
    points="160 208 80 128 160 48"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="24"
  />
</svg>`;

const chevronRightSVG = html`<svg
  style="width: 20px; height: 20px;"
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 256 256"
  fill="none"
>
  <polyline
    points="96 48 176 128 96 208"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="24"
  />
</svg>`;

function TopStoryCard(story) {
  const title = DOMPurify.sanitize(story.title || "");
  const slug = getSlug(title);
  const storyLink = `/stories/${slug}?index=0x${story.index}`;
  const domain = story.href && !story.href.startsWith("data:") && !story.href.startsWith("kiwi:")
    ? extractDomain(story.href)
    : "";
  const image = story.metadata?.image
    ? transformImageUrl(DOMPurify.sanitize(story.metadata.image))
    : null;
  const likeCount = story.upvotes || 0;
  const commentCount = story.commentCount || 0;

  // Collect avatars from submitter + upvoter ENS data
  const avatars = [];
  if (story.submitter?.safeAvatar) {
    avatars.push(DOMPurify.sanitize(story.submitter.safeAvatar));
  }
  if (story.upvoterAvatars) {
    for (const avatar of story.upvoterAvatars) {
      if (avatars.length >= 3) break;
      if (avatar && !avatars.includes(avatar)) {
        avatars.push(DOMPurify.sanitize(avatar));
      }
    }
  }

  return html`
    <a
      href="${storyLink}"
      class="top-story-card"
      data-no-instant
    >
      ${image
        ? html`<div class="top-story-image">
            <img
              src="${image}"
              alt=""
              loading="lazy"
              onerror="this.parentElement.style.display='none'"
            />
          </div>`
        : html`<div class="top-story-image top-story-no-image">
            <span class="top-story-domain-large">${domain}</span>
          </div>`}
      <div class="top-story-content">
        <div class="top-story-title">${title}</div>
        <div class="top-story-meta">
          <div class="top-story-avatars">
            ${avatars.map(
              (avatar) => html`
                <img
                  class="top-story-avatar"
                  src="${avatar}"
                  alt=""
                  loading="lazy"
                  onerror="this.style.display='none'"
                />
              `,
            )}
          </div>
          <span class="top-story-stats">
            ${likeCount} likes${commentCount > 0 ? html` · ${commentCount} comments` : ""}${domain ? html` · ${domain}` : ""}
          </span>
        </div>
      </div>
    </a>
  `;
}

export default function TopStoriesCarousel(stories) {
  if (!stories || stories.length === 0) return "";

  return html`
    <tr>
      <td>
        <div class="top-stories-section">
          <div class="top-stories-header">
            <h2 class="top-stories-title">Top Stories</h2>
            <div class="top-stories-nav">
              <button
                class="top-stories-arrow top-stories-arrow-left"
                onclick="var c=this.closest('.top-stories-section').querySelector('.top-stories-scroll');c.scrollBy({left:-280,behavior:'smooth'})"
                aria-label="Scroll left"
              >
                ${chevronLeftSVG}
              </button>
              <button
                class="top-stories-arrow top-stories-arrow-right"
                onclick="var c=this.closest('.top-stories-section').querySelector('.top-stories-scroll');c.scrollBy({left:280,behavior:'smooth'})"
                aria-label="Scroll right"
              >
                ${chevronRightSVG}
              </button>
            </div>
          </div>
          <div class="top-stories-scroll">
            ${stories.map((story) => TopStoryCard(story))}
          </div>
        </div>
      </td>
    </tr>
  `;
}
