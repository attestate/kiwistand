import React from "react";
import { Head, Html, Body, Container, Tailwind, Text, Link, Img, Row, Column, Section } from "@react-email/components";

// --- Helper functions ---
const truncateLongWords = (text, maxLength = 20) => {
  if (!text) return "";
  const words = text.split(" ");
  const truncatedWords = words.map((word) =>
    word.length > maxLength ? `${word.substring(0, maxLength)}...` : word
  );
  return truncatedWords.join(" ");
};

function truncateComment(comment, maxLength = 180) {
  if (!comment) return "";
  
  const emptyLineIndex = comment.indexOf("\n\n");
  if (emptyLineIndex !== -1 && emptyLineIndex < maxLength)
    return truncateLongWords(comment.slice(0, emptyLineIndex)) + "\n...";

  const lastLinkStart = comment.lastIndexOf("https://", maxLength);
  if (lastLinkStart !== -1 && lastLinkStart < maxLength) {
    const nextSpace = comment.indexOf(" ", lastLinkStart);
    const linkEnd = nextSpace === -1 ? comment.length : nextSpace;
    const fullLink = comment.slice(lastLinkStart, linkEnd);
    const truncatedLink =
      fullLink.length > 60 ? fullLink.substring(0, 60) + "..." : fullLink;

    const beforeLink = truncateLongWords(
      comment.slice(0, lastLinkStart).trim()
    );
    if (beforeLink && beforeLink.length > 0) {
      return beforeLink + " " + truncateLongWords(truncatedLink) + "...";
    } else {
      return truncatedLink + "...";
    }
  }

  if (comment.length <= maxLength) return truncateLongWords(comment);
  return truncateLongWords(
    comment.slice(0, comment.lastIndexOf(" ", maxLength)) + "..."
  );
}

// --- Main Component ---

export default function FarcasterEmail({ story = { metadata: { farcasterCast: { author: {} } } } }) {
  const {
    href,
    metadata,
    displayName,
    identity,
  } = story;

  const extractedDomain = "farcaster.xyz";
  const submitterProfileLink =
    story.submitterLink || `https://news.kiwistand.com/upvotes?address=${identity}`;
  
  // Extract first image from Farcaster cast embeds
  let farcasterImageUrl = null;
  if (metadata?.farcasterCast?.embeds) {
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];
    const imageEmbed = metadata.farcasterCast.embeds.find((embed) => {
      if (!embed) return false;
      
      // Check if the URL is a direct image URL
      const url = embed.url || "";
      const isDirectImage = imageExtensions.some((ext) => url.toLowerCase().includes(ext));
      
      // Check if the embed has image metadata
      const hasImageMetadata = embed.metadata && embed.metadata.image;
      
      return isDirectImage || hasImageMetadata;
    });

    if (imageEmbed) {
      farcasterImageUrl = imageEmbed.metadata?.image?.url || imageEmbed.url;
    }
  }

  // Return just the content for Digest, not a full HTML document
  return (
    <>
      <Section style={container} bgcolor="#f6f6ef">
        <Section style={{...farcasterEmbedContainer, backgroundColor: '#ffffff', borderBottom: '1px solid #e6e6df' }} bgcolor="#ffffff">
          <Link href={story.storyLink} style={{...previewContainer, color: '#000000 !important', textDecoration: 'none'}}>
              <Row>
                <Column width="30">
                  <Img
                    src={metadata.farcasterCast.author.pfp}
                    alt={metadata.farcasterCast.author.username || "Author"}
                    width="20"
                    height="20"
                    style={{ borderRadius: '9999px', marginRight: '8px' }}
                  />
                </Column>
                <Column>
                  <Text style={{ fontWeight: 600, color: '#12212b', fontSize: '14px' }}>
                    @{metadata.farcasterCast.author.username || "farcaster"}
                  </Text>
                </Column>
              </Row>
              <Text style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                {metadata.farcasterCast.text && metadata.farcasterCast.text.length > 260 
                  ? metadata.farcasterCast.text.slice(0, 260) + '…'
                  : metadata.farcasterCast.text}
              </Text>
              {farcasterImageUrl && (
                <Img
                  src={farcasterImageUrl}
                  alt="Farcaster image"
                  width="100%"
                  style={{ marginTop: '12px', objectFit: 'cover' }}
                />
              )}
          </Link>
        </Section>

        <Section style={{ padding: '12px 20px 10px 12px', backgroundColor: '#f6f6ef' }} bgcolor="#f6f6ef">
           <Text style={{ fontSize: '9pt', marginTop: '3px', marginBottom: '0', lineHeight: '1.4', color: '#666' }}>
            submitted by <Link href={submitterProfileLink} style={{ fontWeight: 600, color: '#000000 !important', textDecoration: 'none' }}>{displayName}</Link>
            {' • '}
            <Link href={story.storyLink} style={{ color: '#000000 !important', textDecoration: 'none' }}>{extractedDomain}</Link>
          </Text>
        </Section>
      </Section>
      <Section style={{ padding: '12px 0' }}>
        <Link href={story.storyLink} style={buttonStyle}>GO TO STORY</Link>
      </Section>
    </>
  );
}

// --- Styles ---
const main = {
  backgroundColor: "#fffffa",
  fontFamily:
    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif",
};

const container = {
  margin: "0 auto",
  padding: "0",
  maxWidth: "580px",
  border: "1px solid #e6e6df",
  borderRadius: "3px",
  backgroundColor: "#f6f6ef",
};

const previewContainer = {
  textDecoration: 'none',
  color: 'inherit',
  display: 'block',
};

const farcasterEmbedContainer = {
  padding: '12px',
  backgroundColor: '#ffffff',
};

const buttonStyle = {
  backgroundColor: '#000000',
  color: '#ffffff !important',
  padding: '10px 20px',
  borderRadius: '0',
  textDecoration: 'none',
  display: 'inline-block',
  fontSize: '14px',
};
