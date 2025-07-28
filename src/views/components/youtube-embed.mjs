//@format
import htm from "htm";
import vhtml from "vhtml";
import { formatDuration } from "../../youtube.mjs";

const html = htm.bind(vhtml);

export default function YouTubeEmbed({ videoId, metadata }) {
  if (!videoId) return null;

  const embedUrl = `https://www.youtube.com/embed/${videoId}`;
  
  return html`
    <div
      style="margin: 0; border-radius: 0; overflow: hidden; background: #000;"
    >
      <div style="position: relative; padding-bottom: 56.25%; height: 0;">
        <iframe
          src="${embedUrl}"
          title="${metadata?.title || 'YouTube video'}"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
          style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
        ></iframe>
      </div>
      ${metadata
        ? html`
            <div
              style="padding: 0.75rem 1rem; background: var(--bg-color); border-top: 1px solid var(--border-color);"
            >
              <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--color-muted); font-size: 0.875rem;">
                ${metadata.channelTitle
                  ? html`<span>${metadata.channelTitle}</span>`
                  : null}
                ${metadata.channelTitle && metadata.viewCount
                  ? html`<span>•</span>`
                  : null}
                ${metadata.viewCount
                  ? html`<span>${Number(metadata.viewCount).toLocaleString()} views</span>`
                  : null}
                ${metadata.duration
                  ? html`<span>• ${formatDuration(metadata.duration)}</span>`
                  : null}
              </div>
            </div>
          `
        : null}
    </div>
  `;
}