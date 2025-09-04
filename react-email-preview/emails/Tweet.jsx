import { Head, Html, Body, Container, Tailwind, Text, Link, Img, Row, Column, Section } from "@react-email/components";
import {
  differenceInHours,
  formatDistanceToNowStrict as originalFormatDistance,
} from "date-fns";

import { mockTweet } from "./_mockTweet.js";

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

export default function TweetEmail({ story = mockTweet }) {
  const {
    href,
    metadata,
    upvoters,
    commentCount,
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

                <Section style={{ padding: '12px 20px 10px', backgroundColor: '#f6f6ef' }}>
                   <Text style={{ fontSize: '9pt', marginTop: '3px', marginBottom: '0', lineHeight: '1.4', color: '#666' }}>
                    submitted by <Link href={`https://news.kiwistand.com/upvotes?address=${story.identity}`} style={{ fontWeight: 600, color: 'black' }}>{displayName}</Link>
                    {' • '}
                    {extractedDomain}
                  </Text>
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

const tweetEmbedContainer = {
  padding: '12px',
  backgroundColor: '#ffffff',
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




