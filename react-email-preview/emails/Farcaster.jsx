import { Head, Html, Body, Container, Tailwind, Text, Link, Img, Row, Column, Section } from "@react-email/components";

import { mockFarcaster } from "./_mockFarcaster.js";

// --- Main Component ---

export default function FarcasterEmail({ story = mockFarcaster }) {
  const {
    href,
    metadata,
    displayName,
  } = story;

  const extractedDomain = "farcaster.xyz";

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
                <Section style={{...farcasterEmbedContainer, backgroundColor: '#ffffff', borderBottom: '1px solid #e6e6df' }}>
                  <Link href={href} style={previewContainer}>
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
                      <Text>{metadata.farcasterCast.text}</Text>
                      {metadata.farcasterCast.embeds[0] && (
                        <Img
                          src={metadata.farcasterCast.embeds[0].url}
                          alt="Farcaster image"
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
  backgroundColor: "#ffffff",
  fontFamily: "'Inter', Verdana, Geneva, sans-serif",
};

const container = {
  margin: "0 auto",
  padding: "0",
  maxWidth: "580px",
  border: "1px solid #e6e6df",
  borderRadius: "3px",
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
  color: '#ffffff',
  padding: '10px 20px',
  borderRadius: '0',
  textDecoration: 'none',
  display: 'inline-block',
  fontSize: '14px',
};
