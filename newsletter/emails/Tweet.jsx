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

export default function TweetEmail({ story = { metadata: {} } }) {
  const {
    href,
    metadata,
    displayName,
  } = story;

  const extractedDomain = "x.com";
  const submitterProfileLink =
    story.submitterLink || `https://news.kiwistand.com/upvotes?address=${story.identity}`;

  return (
    <Html>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="x-apple-disable-message-reformatting" />
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Tailwind>
        <Body style={main} bgcolor="#fffffa">
          <Container style={container} bgcolor="#f6f6ef">
            <Row>
              <Column>
                <Section style={{...tweetEmbedContainer, backgroundColor: '#ffffff', borderBottom: '1px solid #e6e6df' }} bgcolor="#ffffff">
                  <Link href={story.storyLink} style={{...previewContainer, color: '#000000 !important', textDecoration: 'none'}}>
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
                      <Text style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                        {metadata.ogDescription && metadata.ogDescription.length > 260
                          ? metadata.ogDescription.slice(0, 260) + '…'
                          : metadata.ogDescription}
                      </Text>
                      {metadata.image && (
                        <Img
                          src={metadata.image}
                          alt="Tweet image"
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
              </Column>
            </Row>
          </Container>
          <Container style={{ margin: '0 auto', maxWidth: '580px' }}>
            <Section style={{ padding: '12px 0' }}>
              <Link href={story.storyLink} style={buttonStyle}>GO TO STORY</Link>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
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

const tweetEmbedContainer = {
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
