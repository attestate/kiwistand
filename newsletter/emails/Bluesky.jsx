import React from "react";
import { Text, Link, Img, Row, Column, Section } from "@react-email/components";

function extractDomain(link) {
  try {
    const parsedUrl = new URL(link);
    const parts = parsedUrl.hostname.split(".");
    return parts.slice(-2).join(".");
  } catch {
    return "bsky.app";
  }
}

export default function BlueskyEmail({ story = { metadata: {} } }) {
  const { href, metadata, displayName, identity } = story;

  const submitterProfileLink =
    story.submitterLink || `https://news.kiwistand.com/upvotes?address=${identity}`;

  const post = metadata?.blueskyPost;
  const firstImage = post?.images?.[0] || null;

  return (
    <>
      <Section style={container} bgcolor="#f6f6ef">
        <Section style={{ ...embedContainer, backgroundColor: '#ffffff', borderBottom: '1px solid #e6e6df' }} bgcolor="#ffffff">
          <Link href={story.storyLink} style={{ textDecoration: 'none', color: '#000000 !important', display: 'block' }}>
            <Row>
              <Column width="30">
                {post?.author?.avatar ? (
                  <Img
                    src={post.author.avatar}
                    alt={post.author.handle || "Author"}
                    width="20"
                    height="20"
                    style={{ borderRadius: '9999px', marginRight: '8px' }}
                  />
                ) : null}
              </Column>
              <Column>
                <Text style={{ fontWeight: 600, color: '#0085ff', fontSize: '14px', margin: 0 }}>
                  @{post?.author?.handle || "bsky.app"}
                </Text>
              </Column>
            </Row>
            <Text style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap', margin: '8px 0 0', color: '#000000' }}>
              {post?.text && post.text.length > 260
                ? post.text.slice(0, 260) + '…'
                : post?.text}
            </Text>
            {firstImage && (
              <Img
                src={firstImage}
                alt="Bluesky image"
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
            <Link href={story.storyLink} style={{ color: '#000000 !important', textDecoration: 'none' }}>bsky.app</Link>
            {story.upvotes ? ` • ${story.upvotes} upvotes` : ''}
            {story.comments ? ` • ${story.comments} comments` : ''}
            {story.clicks ? ` • ${story.clicks} clicks` : ''}
          </Text>
        </Section>
      </Section>
      <Section style={{ padding: '12px 0' }}>
        <Link href={story.storyLink} style={buttonStyle}>Read the story</Link>
      </Section>
    </>
  );
}

const container = {
  margin: "0 auto",
  padding: "0",
  maxWidth: "580px",
  border: "1px solid #e6e6df",
  borderRadius: "3px",
  backgroundColor: "#f6f6ef",
};

const embedContainer = {
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
