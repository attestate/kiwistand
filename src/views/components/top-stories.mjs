//@format
import htm from "htm";
import vhtml from "vhtml";
import DOMPurify from "isomorphic-dompurify";
import { getSlug } from "../../utils.mjs";
import { extractDomain } from "./row.mjs";
import { getImageLoading, sizedImageUrl } from "../utils/imageLoading.mjs";
import { ms } from "./icons.mjs";

const html = htm.bind(vhtml);

// NOTE: The first two cards are on screen on a phone (200px wide cards), so
// their pictures load eagerly; the rest wait until they are scrolled to.
const EAGER_CARDS = 2;

function TopStoryCard(story, i) {
  const title = DOMPurify.sanitize(story.title || "");
  const slug = getSlug(title);
  const storyLink = `/stories/${slug}?index=0x${story.index}`;
  const domain = story.href && !story.href.startsWith("data:") && !story.href.startsWith("kiwi:")
    ? extractDomain(story.href)
    : "";
  const image = story.metadata?.image
    ? sizedImageUrl(DOMPurify.sanitize(story.metadata.image), 480)
    : null;
  const likeCount = story.upvotes || 0;
  const commentCount = story.commentCount || 0;

  // Collect avatars from submitter + upvoter ENS data
  const avatars = [];
  if (story.submitter?.safeAvatar) {
    avatars.push(sizedImageUrl(DOMPurify.sanitize(story.submitter.safeAvatar), 60));
  }
  if (story.upvoterAvatars) {
    for (const avatar of story.upvoterAvatars) {
      if (avatars.length >= 3) break;
      const sized = avatar && sizedImageUrl(DOMPurify.sanitize(avatar), 60);
      if (sized && !avatars.includes(sized)) {
        avatars.push(sized);
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
              loading="${getImageLoading(i < EAGER_CARDS, image)}"
              onerror="this.style.display='none';this.nextElementSibling.style.display='';this.parentElement.classList.add('top-story-no-image')"
            />
            <span class="top-story-domain-large" style="display:none"
              >${domain}</span
            >
          </div>`
        : html`<div class="top-story-image top-story-no-image">
            <span class="top-story-domain-large">${domain}</span>
          </div>`}
      <div class="top-story-content">
        <div class="top-story-title">${title}</div>
        <div class="top-story-meta">
          ${avatars.length > 0 || likeCount > 0
            ? html`<div class="top-story-avatars">
                ${avatars.length > 0
                  ? avatars.map(
                      (avatar) => html`
                        <img
                          class="top-story-avatar"
                          src="${avatar}"
                          alt=""
                          loading="lazy"
                          onerror="this.style.display='none'"
                        />
                      `,
                    )
                  : // NOTE: No upvoter has an avatar: the design's empty
                    // avatar circles, one per like (up to two).
                    Array.from({ length: Math.min(likeCount, 2) }, () =>
                      html`<span class="top-story-avatar top-story-avatar-empty"
                        >${ms("user", 11)}</span
                      >`,
                    )}
              </div>`
            : null}
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
            <h2 class="top-stories-title">Top stories</h2>
            <div class="top-stories-nav">
              <button
                class="top-stories-arrow top-stories-arrow-left"
                onclick="var c=this.closest('.top-stories-section').querySelector('.top-stories-scroll');c.scrollBy({left:-266,behavior:'smooth'})"
                aria-label="Scroll left"
              >
                ${ms("caret-left-bold", 16)}
              </button>
              <button
                class="top-stories-arrow top-stories-arrow-right"
                onclick="var c=this.closest('.top-stories-section').querySelector('.top-stories-scroll');c.scrollBy({left:266,behavior:'smooth'})"
                aria-label="Scroll right"
              >
                ${ms("caret-right-bold", 16)}
              </button>
            </div>
          </div>
          <div class="top-stories-scroll">
            ${stories.map((story, i) => TopStoryCard(story, i))}
          </div>
        </div>
      </td>
    </tr>
  `;
}
