import htm from "htm";
import vhtml from "vhtml";
import DOMPurify from "isomorphic-dompurify";
import { formatDistanceToNowStrict } from "date-fns";

const html = htm.bind(vhtml);

const ParagraphFullPost = ({ post }) => {
  if (!post) return null;

  // Format the publish date if available
  const publishDate = post.publishedAt 
    ? new Date(post.publishedAt).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
    : null;

  // Get the content to display
  let displayContent = '';
  
  // Priority 1: Use staticHtml if available (already has working images)
  if (post.content) {
    displayContent = post.content;
    
    // Process the content to handle Paragraph's image format
    // Fix Next.js image URLs and other image issues
    displayContent = displayContent.replace(/<img[^>]+>/g, (imgTag) => {
      // Extract the src attribute
      const srcMatch = imgTag.match(/src="([^"]+)"/);
      if (srcMatch && srcMatch[1]) {
        let src = srcMatch[1];
        
        // Check if it's a Next.js image URL
        if (src.includes('/_next/image?url=')) {
          // Extract the actual URL from the query parameter
          const urlMatch = src.match(/url=([^&]+)/);
          if (urlMatch && urlMatch[1]) {
            // Decode the URL
            src = decodeURIComponent(urlMatch[1]);
            console.log('Extracted real image URL from Next.js:', src);
          }
        }
        
        // Skip data URLs (blur placeholders)
        if (src.startsWith('data:image')) {
          return imgTag; // Keep as is for now
        }
        
        // Extract other attributes
        const altMatch = imgTag.match(/alt="([^"]*)"/);
        const alt = altMatch ? altMatch[1] : '';
        
        // Return a properly sized image
        return `<img src="${src}" alt="${alt}" style="max-width: 100%; height: auto; display: block; margin: 1em auto;">`;
      }
      return imgTag;
    });
    
    // Also ensure figure elements are properly constrained
    displayContent = displayContent.replace(/<figure[^>]*>/g, '<figure style="margin: 1em 0; text-align: center; max-width: 100%;">');
  } 
  // Priority 2: Convert TipTap JSON if available
  else if (post.tiptapJson) {
    try {
      const tiptapData = typeof post.tiptapJson === 'string' ? JSON.parse(post.tiptapJson) : post.tiptapJson;
      displayContent = convertTipTapToHTML(tiptapData);
    } catch (e) {
      console.error('Failed to convert TipTap JSON:', e);
    }
  }
  // Priority 3: Use markdown if available
  else if (post.markdown) {
    // For now, just display markdown as plain text in paragraphs
    displayContent = `<p>${DOMPurify.sanitize(post.markdown).replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
  }

  // Helper function to convert TipTap JSON to HTML
  function convertTipTapToHTML(doc) {
    if (!doc || !doc.content) return '';
    
    const convertNode = (node) => {
      if (!node) return '';
      
      // Process children first
      let children = '';
      if (node.content && Array.isArray(node.content)) {
        children = node.content.map(convertNode).join('');
      }
      
      // Handle text content
      if (node.text !== undefined) {
        let text = DOMPurify.sanitize(node.text);
        
        // Apply marks (formatting)
        if (node.marks && Array.isArray(node.marks)) {
          node.marks.forEach(mark => {
            switch (mark.type) {
              case 'bold':
                text = `<strong>${text}</strong>`;
                break;
              case 'italic':
                text = `<em>${text}</em>`;
                break;
              case 'link':
                const href = mark.attrs?.href || '#';
                const target = mark.attrs?.target || '_blank';
                const rel = mark.attrs?.rel || 'noopener noreferrer';
                text = `<a href="${href}" target="${target}" rel="${rel}">${text}</a>`;
                break;
              case 'underline':
                text = `<u>${text}</u>`;
                break;
              case 'code':
                text = `<code>${text}</code>`;
                break;
            }
          });
        }
        return text;
      }
      
      // Handle different node types
      switch (node.type) {
        case 'paragraph':
          const textAlign = node.attrs?.textAlign || 'left';
          return `<p style="text-align: ${textAlign};">${children}</p>`;
        case 'heading':
          const level = node.attrs?.level || 1;
          return `<h${level}>${children}</h${level}>`;
        case 'bulletList':
          return `<ul>${children}</ul>`;
        case 'orderedList':
          return `<ol>${children}</ol>`;
        case 'listItem':
          return `<li>${children}</li>`;
        case 'blockquote':
          return `<blockquote>${children}</blockquote>`;
        case 'codeBlock':
          return `<pre><code>${children}</code></pre>`;
        case 'image':
          const imgAttrs = node.attrs || {};
          if (imgAttrs.src) {
            return `<img src="${imgAttrs.src}" alt="${imgAttrs.alt || ''}" style="max-width: 100%; height: auto;">`;
          }
          return '';
        case 'figure':
          return `<figure style="margin: 1em 0; text-align: center;">${children}</figure>`;
        case 'figcaption':
          return `<figcaption style="margin-top: 0.5em; font-style: italic; color: var(--text-tertiary);">${children}</figcaption>`;
        case 'hardBreak':
          return '<br>';
        case 'emoji':
          // Handle emoji nodes
          const emoji = node.attrs?.name || '';
          return `<span class="emoji">${emoji === 'blue_circle' ? '🔵' : emoji === 'purple_circle' ? '🟣' : emoji === 'kiwi' ? '🥝' : ''}</span>`;
        default:
          // For unknown types, just return the children
          return children;
      }
    };
    
    return convertNode(doc);
  }
  
  return html`
    <div class="paragraph-full-post-container" style="padding: 20px; background-color: rgba(255,255,255,0.4);">
      <div class="paragraph-post-header" style="margin-bottom: 24px;">
        <h2 style="font-size: 24px; font-weight: 700; margin: 0 0 12px 0; line-height: 1.3;">
          ${DOMPurify.sanitize(post.title)}
        </h2>
        
        <div style="display: flex; align-items: center; gap: 16px; color: var(--text-tertiary); font-size: 14px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <svg 
              style="width: 16px; height: 16px;" 
              viewBox="0 0 24 24" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" fill="currentColor"/>
            </svg>
            <span>
              @${DOMPurify.sanitize(post.author.username)}
              ${post.author.displayName && post.author.displayName !== post.author.username 
                ? ` (${DOMPurify.sanitize(post.author.displayName)})`
                : ''}
            </span>
          </div>
          
          ${publishDate ? html`
            <div style="display: flex; align-items: center; gap: 8px;">
              <svg 
                style="width: 16px; height: 16px;" 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z" fill="currentColor"/>
              </svg>
              <span>${publishDate}</span>
            </div>
          ` : null}
          
          ${post.arweaveId ? html`
            <div style="display: flex; align-items: center; gap: 8px;" title="Stored on Arweave">
              <svg 
                style="width: 16px; height: 16px;" 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" fill="currentColor"/>
              </svg>
              <span style="color: var(--color-success);">Permanently stored</span>
            </div>
          ` : null}
        </div>
        
        ${post.description ? html`
          <div style="margin-top: 16px; font-size: 16px; color: var(--text-muted); line-height: 1.5; font-style: italic;">
            ${DOMPurify.sanitize(post.description)}
          </div>
        ` : null}
      </div>
      
      <div class="paragraph-post-content" style="font-size: 16px; line-height: 1.6; color: var(--text-primary);">
        <style>
          .paragraph-post-content a {
            color: var(--text-primary);
            font-weight: 500;
            text-decoration: underline;
          }
          .paragraph-post-content a:visited {
            color: var(--text-secondary);
          }
          .paragraph-post-content a:hover {
            text-decoration: underline;
            opacity: 0.8;
          }
        </style>
        ${html`<div dangerouslySetInnerHTML=${{ __html: DOMPurify.sanitize(displayContent, {
            ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
                          'blockquote', 'ul', 'ol', 'li', 'a', 'img', 'pre', 'code', 'span', 'div', 
                          'figure', 'figcaption'],
            ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'style', 'target', 'rel', 'title', 'width', 'height', 
                          'blurdataurl', 'nextheight', 'nextwidth', 'data-type', 'float'],
            ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|xxx|blob):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
          }) }}></div>`}
      </div>
    </div>
  `;
};

export default ParagraphFullPost;