import htm from "htm";
import vhtml from "vhtml";
import DOMPurify from "isomorphic-dompurify";

const html = htm.bind(vhtml);

const renderEmbed = (embed) => {
  if (!embed || !embed.url) return null;

  // Check if it's an image embed
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
  const isImage = imageExtensions.some(ext => embed.url.toLowerCase().includes(ext));
  
  // Check if it's a video embed
  const videoExtensions = ['.mp4', '.webm', '.ogg'];
  const isVideo = videoExtensions.some(ext => embed.url.toLowerCase().includes(ext));

  if (isImage || (embed.metadata && embed.metadata.image)) {
    const imageUrl = embed.metadata?.image?.url || embed.url;
    return html`
      <div style="margin-top: 16px;">
        <img
          src="${DOMPurify.sanitize(imageUrl)}"
          alt="${DOMPurify.sanitize(embed.metadata?.title || 'Embedded image')}"
          style="max-width: 100%; height: auto; border-radius: 8px; border: 1px solid rgba(0,0,0,0.1);"
          loading="lazy"
        />
      </div>
    `;
  }

  if (isVideo) {
    return html`
      <div style="margin-top: 16px;">
        <video
          src="${DOMPurify.sanitize(embed.url)}"
          controls
          style="max-width: 100%; height: auto; border-radius: 8px;"
        />
      </div>
    `;
  }

  // For other embeds (links, etc), show a link preview if metadata is available
  if (embed.metadata) {
    return html`
      <a
        href="${DOMPurify.sanitize(embed.url)}"
        target="_blank"
        rel="noopener noreferrer"
        style="display: block; margin-top: 16px; text-decoration: none; color: inherit; border: 1px solid rgba(0,0,0,0.1); border-radius: 8px; padding: 12px; background-color: rgba(0,0,0,0.02);"
      >
        ${embed.metadata.image ? html`
          <img
            src="${DOMPurify.sanitize(embed.metadata.image.url)}"
            alt="${DOMPurify.sanitize(embed.metadata.title || '')}"
            style="width: 100%; max-height: 200px; object-fit: cover; border-radius: 4px; margin-bottom: 8px;"
          />
        ` : null}
        <div style="font-weight: 500; margin-bottom: 4px;">
          ${DOMPurify.sanitize(embed.metadata.title || embed.url)}
        </div>
        ${embed.metadata.description ? html`
          <div style="font-size: 14px; opacity: 0.7; line-height: 1.4;">
            ${DOMPurify.sanitize(embed.metadata.description).substring(0, 150)}${embed.metadata.description.length > 150 ? '...' : ''}
          </div>
        ` : null}
      </a>
    `;
  }

  // Fallback for plain URL embeds
  return html`
    <a
      href="${DOMPurify.sanitize(embed.url)}"
      target="_blank"
      rel="noopener noreferrer"
      style="display: block; margin-top: 16px; color: #472a91; text-decoration: underline; word-break: break-all;"
    >
      ${DOMPurify.sanitize(embed.url)}
    </a>
  `;
};

const FarcasterFullCast = ({ cast }) => {
  if (!cast) return null;

  return html`
    <div class="farcaster-full-cast-container" style="padding: 20px; background-color: rgba(255,255,255,0.4);">
      <div class="farcaster-cast-header" style="display: flex; align-items: center; margin-bottom: 16px;">
        <div class="farcaster-author-avatar" style="margin-right: 12px;">
          ${cast.author.pfp 
            ? html`<img
                src="${DOMPurify.sanitize(cast.author.pfp)}"
                alt="${DOMPurify.sanitize(cast.author.displayName || cast.author.username)}"
                width="48"
                height="48"
                style="border-radius: 24px; border: 2px solid #472a91;"
              />`
            : html`<div style="width: 48px; height: 48px; border-radius: 24px; background-color: #472a91; display: flex; align-items: center; justify-content: center;">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 1000 1000"
                  xmlns="http://www.w3.org/2000/svg"
                  style="color: white;"
                >
                  <path
                    d="M257.778 155.556H742.222V844.444H671.111V528.889H257.778V155.556Z"
                    fill="currentColor"
                  />
                  <path
                    d="M128.889 528.889H257.778V844.444H128.889V528.889Z"
                    fill="currentColor"
                  />
                </svg>
              </div>`}
        </div>
        <div class="farcaster-author-info">
          <div style="font-weight: 600; font-size: 16px;">
            ${DOMPurify.sanitize(cast.author.displayName || cast.author.username)}
          </div>
          <div style="color: #666; font-size: 14px;">
            @${DOMPurify.sanitize(cast.author.username)}
          </div>
        </div>
      </div>
      
      <div class="farcaster-cast-content" style="font-size: 16px; line-height: 1.5; white-space: pre-wrap; word-break: break-word;">
        ${DOMPurify.sanitize(cast.text)}
      </div>
      
      ${cast.embeds && cast.embeds.length > 0 ? html`
        <div class="farcaster-cast-embeds" style="margin-top: 16px;">
          ${cast.embeds.map(embed => renderEmbed(embed))}
        </div>
      ` : null}
    </div>
  `;
};

export default FarcasterFullCast;