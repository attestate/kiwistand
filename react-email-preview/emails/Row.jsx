import { Head, Html, Body, Container, Tailwind, Text, Link, Img, Row, Column, Section } from "@react-email/components";
import {
  differenceInHours,
  formatDistanceToNowStrict as originalFormatDistance,
} from "date-fns";

import { mockStory } from "./_mock.js";

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

    const beforeLink = truncateLongWords(comment.slice(0, lastLinkStart).trim());
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

export default function RowEmail({ story = mockStory }) {
  // --- Logic from row.mjs ---
  // Simplified for email context
  const {
    href,
    title,
    metadata,
    timestamp,
    identity,
    displayName,
    upvoters,
  } = story;

  const commentCount = story.commentCount || 0; // Mocked
  const extractedDomain = extractDomain(href);
  const isTweet = extractedDomain.includes("twitter.com") || extractedDomain.includes("x.com");
  const isFarcasterCast = extractedDomain.includes("warpcast.com") || extractedDomain.includes("farcaster.xyz");

  const storyAgeHours = differenceInHours(new Date(), new Date(timestamp * 1000));
  const isStoryNew = storyAgeHours <= 4;

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

  return (
    <Html>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <Tailwind>
        <Body style={main}>
          <Container style={container}>
            <Row>
              <Column>
                {canRenderTweetPreview ? (
                  <Link href={href} style={previewContainer}>
                    <Section style={tweetEmbedContainer}>
                      <Row>
                        <Column width="30">
                          <Img
                            src={metadata.twitterAuthorAvatar}
                            alt={metadata.twitterCreator || "Author"}
                            width="20"
                            height="20"
                            style={{ borderRadius: '9999px', marginRight: '8px' }}
                          />
                        </Column>
                        <Column>
                          <Text style={{ fontWeight: 600, color: '#0f1419', fontSize: '14px' }}>
                            {metadata.twitterCreator || "@tweet"}
                          </Text>
                        </Column>
                      </Row>
                      <Text>{metadata.ogDescription}</Text>
                      {metadata.image && (
                        <Img
                          src={metadata.image}
                          alt="Tweet image"
                          width="100%"
                          style={{ marginTop: '12px', aspectRatio: '16 / 9', objectFit: 'cover' }}
                        />
                      )}
                      <Text style={{ fontSize: '11px', opacity: 0.55, color: '#0f1419', textAlign: 'right' }}>x.com</Text>
                    </Section>
                  </Link>
                ) : canRenderFarcasterPreview ? (
                  <Link href={href} style={previewContainer}>
                    <Section style={farcasterEmbedContainer}>
                       <Row>
                        <Column width="30">
                          <Img
                            src={metadata.farcasterCast?.author?.pfp}
                            alt={metadata.farcasterCast?.author?.username || "farcaster"}
                            width="20"
                            height="20"
                            style={{ borderRadius: '9999px', marginRight: '8px' }}
                          />
                        </Column>
                        <Column>
                          <Text style={{ fontWeight: 600, color: '#12212b', fontSize: '14px' }}>
                            @{metadata.farcasterCast?.author?.username || "farcaster"}
                          </Text>
                        </Column>
                      </Row>
                      <Text>{metadata.farcasterCast?.text || metadata.ogDescription}</Text>
                      {farcasterImageUrl && (
                        <Img
                          src={farcasterImageUrl}
                          alt="Cast image"
                          width="100%"
                          style={{ marginTop: '12px', aspectRatio: '16 / 9', objectFit: 'cover' }}
                        />
                      )}
                      <Text style={{ fontSize: '11px', opacity: 0.75, color: '#7c65c1', textAlign: 'right' }}>farcaster.xyz</Text>
                    </Section>
                  </Link>
                ) : displayImage ? (
                  <Link href={href}>
                    <Img
                      src={metadata.image}
                      alt="Story image"
                      width="100%"
                      style={{ aspectRatio: '2 / 1', objectFit: 'cover' }}
                    />
                  </Link>
                ) : null}

                <Section style={{ padding: '12px 20px' }}>
                  <Link href={href} style={{ lineHeight: '15pt', fontSize: '13pt', color: '#000' }}>
                    {truncateLongWords(metadata.compliantTitle || title)}
                  </Link>

                  <Text style={{ fontSize: '9pt', marginTop: '3px', marginBottom: '0', lineHeight: '1.4', color: '#666' }}>
                    by <Link href={`https://news.kiwistand.com/upvotes?address=${identity}`} style={{ fontWeight: 600, color: 'black' }}>{displayName}</Link>
                    {' • '}
                    {extractedDomain}
                  </Text>
                </Section>

                <Section style={{ padding: '0 20px 10px' }}>
                  <Row>
                    <Column width="80">
                      <Row>
                        <Column width="20" style={{ verticalAlign: 'middle' }}><HeartSVG /></Column>
                        <Column style={{ verticalAlign: 'middle' }}><Text style={interactionText}>{upvoters ? upvoters.length : 0}</Text></Column>
                      </Row>
                    </Column>
                    <Column width="80">
                      <Row>
                        <Column width="20" style={{ verticalAlign: 'middle' }}><ChatsSVG /></Column>
                        <Column style={{ verticalAlign: 'middle' }}><Text style={interactionText}>{commentCount}</Text></Column>
                      </Row>
                    </Column>
                    <Column />
                  </Row>
                </Section>
              </Column>
            </Row>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

// --- Styles ---
const main = {
  backgroundColor: "#ffffff",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif',
};

const container = {
  margin: "0 auto",
  padding: "0",
  maxWidth: "580px",
  border: "1px solid #eaeaea",
  borderRadius: "3px",
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

const interactionButton = {
  padding: '8px 12px',
};

const interactionText = {
  fontSize: '13px',
  color: 'rgba(83, 100, 113, 1)',
  fontWeight: 400,
  margin: 0,
  marginLeft: '4px'
};
