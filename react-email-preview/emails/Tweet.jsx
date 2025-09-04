import { Head, Html, Body, Container, Tailwind, Text, Link, Img, Row, Column, Section } from "@react-email/components";

import { mockTweet } from "./_mockTweet.js";

// --- Main Component ---

export default function TweetEmail({ story = mockTweet }) {
  const {
    href,
    metadata,
    displayName,
  } = story;

  const extractedDomain = "x.com";

  return (
    <Html>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" />
      </Head>
      <Tailwind>
        <Body style={main}>
          <Container style={container}>
            <Row>
              <Column>
                <Section style={{...tweetEmbedContainer, backgroundColor: '#ffffff', borderBottom: '1px solid #e6e6df' }}>
                  <Link href={href} style={previewContainer}>
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
                          style={{ marginTop: '12px', objectFit: 'cover' }}
                        />
                      )}
                  </Link>
                </Section>

                <Section style={{ padding: '12px 20px 10px 12px', backgroundColor: '#f6f6ef' }}>
                   <Text style={{ fontSize: '9pt', marginTop: '3px', marginBottom: '0', lineHeight: '1.4', color: '#666' }}>
                    submitted by <Link href={`https://news.kiwistand.com/upvotes?address=${story.identity}`} style={{ fontWeight: 600, color: 'black' }}>{displayName}</Link>
                    {' • '}
                    {extractedDomain}
                  </Text>
                </Section>
              </Column>
            </Row>
          </Container>
          <Container style={{ margin: '0 auto', maxWidth: '580px' }}>
            <Section style={{ padding: '12px 0' }}>
              <Link href={href} style={buttonStyle}>GO TO STORY</Link>
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
  padding: '12px',
  backgroundColor: '#ffffff',
};

const buttonStyle = {
  backgroundColor: '#000000',
  color: '#ffffff',
  padding: '10px 20px',
  borderRadius: '0',
  textDecoration: 'none',
  display: 'inline-block',
  fontSize: '14px',
};