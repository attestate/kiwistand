import React from "react";
import { Head, Html, Body, Container, Tailwind, Text, Link, Img, Row, Column, Section } from "@react-email/components";
import {
  differenceInHours,
  formatDistanceToNowStrict as originalFormatDistance,
} from "date-fns";

// --- Helper functions from row.mjs ---

const formatDistanceToNowStrict = (date) => {
  return originalFormatDistance(date)
    .replace(/ years?/, "y")
    .replace(/ months?/, "mo")
    .replace(/ weeks?/, "w")
    .replace(/ days?/, "d")
    .replace(/ hours?/, "h")
    .replace(/ minutes?/, "m")
    .replace(/ seconds?/, "s");
};

function extractDomain(link) {
  try {
    const parsedUrl = new URL(link);
    const parts = parsedUrl.hostname.split(".");
    const tld = parts.slice(-2).join(".");
    return tld;
  } catch (error) {
    return "Invalid URL";
  }
}

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

// --- SVGs as React Components ---

const HeartSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="15" height="15">
    <rect width="256" height="256" fill="none" />
    <path
      d="M128,224S24,168,24,102A54,54,0,0,1,78,48c22.59,0,41.94,12.31,50,32,8.06-19.69,27.41-32,50-32a54,54,0,0,1,54,54C232,168,128,224,128,224Z"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
    />
  </svg>
);

const ChatsSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="15" height="15">
    <rect width="256" height="256" fill="none" />
    <path
      d="M71.58,144,32,176V48a8,8,0,0,1,8-8H168a8,8,0,0,1,8,8v88a8,8,0,0,1-8,8Z"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
    />
    <path
      d="M80,144v40a8,8,0,0,0,8,8h96.42L224,224V96a8,8,0,0,0-8-8H176"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
    />
  </svg>
);

// --- Main Component ---

export default function RowEmail({ story = {} }) {
  const {
    href,
    title,
    metadata,
    identity,
    displayName,
  } = story;

  const extractedDomain = extractDomain(href);
  const isTweet = extractedDomain.includes("twitter.com") || extractedDomain.includes("x.com");
  const isFarcasterCast = extractedDomain.includes("warpcast.com") || extractedDomain.includes("farcaster.xyz");

  const canRenderTweetPreview = isTweet && metadata && metadata.ogDescription;
  const canRenderFarcasterPreview = isFarcasterCast && metadata && (metadata.farcasterCast || metadata.ogDescription);

  let farcasterImageUrl = null;
  if (canRenderFarcasterPreview && metadata.farcasterCast?.embeds) {
    const imageEmbed = metadata.farcasterCast.embeds.find(embed => embed && embed.url);
    if (imageEmbed) {
      farcasterImageUrl = imageEmbed.url;
    }
  }

  const displayImage = !canRenderTweetPreview && !canRenderFarcasterPreview && metadata && metadata.image;

  // Return just the content for Digest, not a full HTML document  
  return (
    <>
      <Section style={container}>
        {displayImage ? (
          <Link href={href}>
            <Img
              src={metadata.image}
              alt="Story image"
              width="100%"
              style={{ aspectRatio: '2 / 1', objectFit: 'cover' }}
            />
          </Link>
        ) : null}

        <Section style={{ padding: '12px 12px 12px 12px' }}>
          <Link href={href} style={{ lineHeight: '15pt', fontSize: '13pt', color: '#000000 !important', textDecoration: 'none' }}>
            {truncateLongWords(metadata?.compliantTitle || title)}
          </Link>

          <Text style={{ fontSize: '9pt', marginTop: '3px', marginBottom: '0', lineHeight: '1.4', color: '#666' }}>
            submitted by <Link href={`https://news.kiwistand.com/upvotes?address=${identity}`} style={{ fontWeight: 600, color: '#000000 !important', textDecoration: 'none' }}>{displayName}</Link>
            {' • '}
            <Link href={href} style={{ color: '#000000 !important', textDecoration: 'none' }}>{extractedDomain}</Link>
          </Text>
        </Section>
      </Section>
      <Section style={{ padding: '12px 0' }}>
        <Link href={href} style={buttonStyle}>GO TO STORY</Link>
      </Section>
    </>
  );
}

// --- Styles ---
const main = {
  backgroundColor: "#fffffa",
  fontFamily: "'Inter', Verdana, Geneva, sans-serif",
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

const tweetEmbedContainer = {
  border: '1px solid #cfd9de',
  borderRadius: '12px',
  padding: '12px',
  margin: '0 20px',
};

const farcasterEmbedContainer = {
  border: '1px solid #e0e0e0',
  borderRadius: '12px',
  padding: '12px',
  margin: '0 20px',
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