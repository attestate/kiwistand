import React from "react";
import { Head, Html, Body, Container, Tailwind, Hr, Img, Text, Row, Column, Section } from "@react-email/components";
import fs from "fs";
import path from "path";

import RowEmail from "./Row.jsx";
import TweetEmail from "./Tweet.jsx";
import FarcasterEmail from "./Farcaster.jsx";

// Load digest data
let digestStories = [];
try {
  const digestDataPath = path.join(process.cwd(), '..', 'digest-data.json');
  const digestData = JSON.parse(fs.readFileSync(digestDataPath, 'utf-8'));
  digestStories = digestData.stories || [];
} catch (error) {
  console.error('Failed to load digest-data.json:', error);
}

// --- Main Component ---

export default function DigestEmail({ stories = digestStories }) {
  const components = {
    Row: RowEmail,
    Tweet: TweetEmail,
    Farcaster: FarcasterEmail,
  };

  const getComponentForStory = (story) => {
    const domain = story.metadata?.domain || '';
    const isTweetDomain = domain.includes('twitter.com') || domain.includes('x.com');

    if (isTweetDomain) {
      const tweetContainsXArticle =
        story.metadata &&
        story.metadata.ogDescription &&
        (story.metadata.ogDescription.includes("x.com/i/article/") ||
          story.metadata.ogDescription.includes("twitter.com/i/article/"));

      if (tweetContainsXArticle) {
        return 'Row';
      }
      return 'Tweet';
    }

    if (domain.includes('warpcast.com') || domain.includes('farcaster.xyz')) {
      return 'Farcaster';
    }
    return 'Row';
  };

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
          <Container style={container}>
            <Text style={{
              fontSize: '1px',
              lineHeight: '1px',
              color: '#fffffa',
              display: 'none',
              maxHeight: 0,
              maxWidth: 0,
              opacity: 0,
              overflow: 'hidden'
            }}>
              Weekly highlights from Kiwi News — top community stories inside.
            </Text>
            <Section style={{ marginTop: '10px', marginBottom: '15px' }}>
              <Row>
                <Column width="40">
                  <Img src="https://news.kiwistand.com/kiwi-icon-email.png" alt="Kiwi News" width="35" height="35" />
                </Column>
                <Column>
                  <Text style={title}>Kiwi News</Text>
                </Column>
              </Row>
            </Section>
            <Img src="https://news.kiwistand.com/banner-email.webp" alt="Kiwi Newsletter Banner" width="100%" />
            <Text style={introGreeting}>
              <strong>Hi there,</strong>
            </Text>
            <Text style={introBody}>
              Here is an overview of what happened this week on Kiwi News. Make sure to like the stories, if you enjoyed reading them.
              <br />
              <br />
              Have a nice day.
            </Text>
            
            {stories.map((story, index) => {
              const Component = components[getComponentForStory(story)];
              return (
                <React.Fragment key={story.href}>
                  <Component story={story} />
                  {index < stories.length - 1 && <Hr style={hr} />}
                </React.Fragment>
              );
            })}

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
  padding: "0 0 48px",
  maxWidth: "580px",
};

const hr = {
  borderColor: "#cccccc",
  margin: "20px 0",
};

const title = {
  fontSize: "16px",
  fontWeight: "600",
  textAlign: "left",
  margin: "0",
};

const introGreeting = {
  fontSize: "14px",
  lineHeight: "24px",
  textAlign: "left",
  margin: "20px 0 10px 0",
};

const introBody = {
  fontSize: "14px",
  lineHeight: "24px",
  textAlign: "left",
  margin: "0 0 20px 0",
};
