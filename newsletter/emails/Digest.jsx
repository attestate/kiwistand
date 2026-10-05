import React from "react";
import { Head, Html, Body, Container, Tailwind, Hr, Img, Text, Row, Column, Section, Link } from "@react-email/components";
import fs from "fs";
import path from "path";

import RowEmail from "./Row.jsx";
import TweetEmail from "./Tweet.jsx";
import FarcasterEmail from "./Farcaster.jsx";
import BlueskyEmail from "./Bluesky.jsx";

// Load digest data
let digestStories = [];
try {
  const digestDataPath = process.env.DIGEST_DATA
    ? path.resolve(process.env.DIGEST_DATA)
    : path.join(process.cwd(), '..', 'digest-data.json');
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
    Bluesky: BlueskyEmail,
  };

  const bannedDomains = ['imagedelivery.net'];
  const sanitizeStories = stories.filter((story) => {
    const metadataDomain = story.metadata?.domain?.toLowerCase?.();
    let hrefDomain = null;
    try {
      hrefDomain = new URL(story.href).hostname.toLowerCase();
    } catch (error) {
      hrefDomain = null;
    }

    const domainsToCheck = [metadataDomain, hrefDomain].filter(Boolean);
    return !domainsToCheck.some((domain) =>
      bannedDomains.some((bannedDomain) =>
        domain === bannedDomain || domain.endsWith(`.${bannedDomain}`)
      )
    );
  });

  const storiesToRender = sanitizeStories.slice(0, 5);

  const getComponentForStory = (story) => {
    const domain = story.metadata?.domain || '';
    const isTweetDomain = domain.includes('twitter.com') || domain.includes('x.com');

    if (isTweetDomain) {
      // X articles and video-only tweets render better as regular cards
      const isXArticle = story.metadata?.isXArticle;
      const isVideoTweet = story.metadata?.hasVideo && !story.metadata?.image;

      if (isXArticle || isVideoTweet) {
        return 'Row';
      }
      return 'Tweet';
    }

    if (domain.includes('warpcast.com') || domain.includes('farcaster.xyz')) {
      return 'Farcaster';
    }

    if (domain.includes('bsky.app') && story.metadata?.blueskyPost) {
      return 'Bluesky';
    }

    return 'Row';
  };

  return (
    <Html lang="en">
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="x-apple-disable-message-reformatting" />
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style>{darkModeCSS}</style>
      </Head>
      <Tailwind>
        <Body style={main} className="k-body" bgcolor="#fffffa">
          <Container style={container}>
            <Text style={preheader}>
              {preheaderText(storiesToRender)}
            </Text>
            <Section style={{ marginTop: '10px', marginBottom: '15px' }}>
              <Row>
                <Column width="44">
                  <Img src="https://news.kiwistand.com/kiwi-icon-email.png" alt="" width="35" height="35" style={{ borderRadius: '50%' }} />
                </Column>
                <Column>
                  {/* Live text instead of the transparent wordmark PNG, which
                      disappeared on dark backgrounds. */}
                  <Text style={wordmark}>
                    <span style={{ color: '#7a8f1c' }} className="k-kiwi">Kiwi</span>{' '}
                    <span className="k-text">News</span>
                  </Text>
                </Column>
              </Row>
            </Section>
            <Img src="https://news.kiwistand.com/banner-email.jpg" alt="Kiwi News weekly" width="580" style={{ width: '100%', height: 'auto' }} />
            <Text style={introGreeting} className="k-text">
              <strong>GM,</strong>
            </Text>
            <Text style={introBody} className="k-text">
              Here are the {countWord(storiesToRender.length)} stories the Kiwi community upvoted most this week.
              Liked one? Upvote it or leave a comment on Kiwi: that's how the best
              links rise to the top.
            </Text>

            <Section style={appSection} className="k-card" bgcolor="#f6f6ef">
              <Text style={appKicker} className="k-kiwi">NEW</Text>
              <Text style={appTitle} className="k-text">Kiwi News for iPhone, rebuilt from scratch</Text>
              <Text style={appBody} className="k-text">
                The iOS app is now fully native: a faster feed, comments and
                reactions, notifications, and sharing links straight from Safari.
                It's in beta on TestFlight, and we'd love your feedback.
              </Text>
              <Link href={TESTFLIGHT_URL} className="k-button" style={buttonStyle}><span><span className="k-button-text" style={{ color: '#ffffff' }}>Get the beta</span></span></Link>
            </Section>

            {storiesToRender.map((story, index) => {
              const Component = components[getComponentForStory(story)];
              return (
                <React.Fragment key={story.href}>
                  <Component story={story} />
                  {index < storiesToRender.length - 1 && <Hr style={hr} className="k-hr" />}
                </React.Fragment>
              );
            })}

            <Hr style={hr} className="k-hr" />

            <Section style={footerSection}>
              <Text style={footerText} className="k-text">
                More every day on <Link href={withUtm("https://news.kiwistand.com/", "footer")} className="k-link" style={footerLink}><span><span className="k-link" style={{ color: '#000000' }}>news.kiwistand.com</span></span></Link>.
                On a computer? Scan the code to get the iPhone beta:
              </Text>
              <Img
                src="https://news.kiwistand.com/testflight-qr.png"
                alt="QR code for the Kiwi News TestFlight beta"
                width="120"
                height="120"
              />
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

function countWord(n) {
  return ["no", "one", "two", "three", "four", "five", "six", "seven"][n] || String(n);
}

const TESTFLIGHT_URL = "https://testflight.apple.com/join/6jyvYECH";

function withUtm(link, content) {
  try {
    const url = new URL(link);
    url.searchParams.set("utm_source", "kiwi-newsletter");
    url.searchParams.set("utm_medium", "email");
    url.searchParams.set("utm_content", content);
    return url.toString();
  } catch {
    return link;
  }
}

// Shown as the inbox preview line next to the subject.
function preheaderText(stories) {
  const titles = stories
    .map((story) => story.metadata?.compliantTitle || story.title)
    .filter(Boolean)
    .slice(1, 3);
  return titles.length
    ? `Also: ${titles.join(" · ")} · plus the new native iPhone app`
    : "This week's top stories on Kiwi News, plus the new native iPhone app";
}

// Clients that honor prefers-color-scheme (Apple Mail, iOS Mail, Outlook
// for Mac/iOS) get a designed dark theme; [data-ogsc]/[data-ogsb] are
// Outlook.com's dark-mode hooks. Clients that invert colors on their own
// (Gmail apps, Outlook Windows) ignore this; the layout uses live text and
// opaque images so inversion stays readable there too.
const darkModeCSS = `
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  @media (prefers-color-scheme: dark) {
    .k-body, body { background-color: #161614 !important; color: #ecece6 !important; }
    .k-card { background-color: #23231f !important; border-color: #3a3a34 !important; }
    .k-embed { background-color: #2b2b27 !important; border-color: #3a3a34 !important; }
    .k-text { color: #ecece6 !important; }
    .k-link { color: #ffffff !important; }
    .k-muted { color: #a8a89e !important; }
    .k-kiwi { color: #b5cc3a !important; }
    .k-hr { border-color: #3a3a34 !important; }
    .k-button { background-color: #ecece6 !important; color: #111111 !important; }
    .k-button-text { color: #111111 !important; }
  }
  [data-ogsc] .k-text { color: #ecece6 !important; }
  [data-ogsc] .k-link { color: #ffffff !important; }
  [data-ogsc] .k-muted { color: #a8a89e !important; }
  [data-ogsc] .k-kiwi { color: #b5cc3a !important; }
  [data-ogsb] .k-card { background-color: #23231f !important; }
  [data-ogsb] .k-embed { background-color: #2b2b27 !important; }
  [data-ogsb] .k-button { background-color: #ecece6 !important; }
  [data-ogsc] .k-button, [data-ogsc] .k-button-text { color: #111111 !important; }
`;

// --- Styles ---
// NOTE: No background color here: react-email copies the Body's style onto
// a wrapper cell that the dark-mode classes can't reach. The light
// background comes from the body's bgcolor attribute.
const main = {
  color: "#111111",
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

const preheader = {
  fontSize: "1px",
  lineHeight: "1px",
  color: "#fffffa",
  display: "none",
  maxHeight: 0,
  maxWidth: 0,
  opacity: 0,
  overflow: "hidden",
};

const wordmark = {
  fontSize: "22px",
  fontWeight: "700",
  lineHeight: "35px",
  margin: "0",
  color: "#111111",
};

const appSection = {
  border: "1px solid #e6e6df",
  borderRadius: "3px",
  padding: "4px 16px 16px",
  margin: "0 0 24px 0",
};

const appKicker = {
  fontSize: "11px",
  fontWeight: "700",
  letterSpacing: "1px",
  color: "#7a8f1c",
  margin: "12px 0 0 0",
};

const appTitle = {
  fontSize: "17px",
  fontWeight: "600",
  lineHeight: "22px",
  margin: "4px 0 6px 0",
};

const appBody = {
  fontSize: "14px",
  lineHeight: "22px",
  margin: "0 0 14px 0",
};

const buttonStyle = {
  backgroundColor: "#000000",
  color: "#ffffff",
  padding: "10px 20px",
  textDecoration: "none",
  display: "inline-block",
  fontSize: "14px",
};

const footerSection = {
  padding: "8px 0 0 0",
};

const footerText = {
  fontSize: "13px",
  lineHeight: "20px",
  margin: "0 0 12px 0",
};

const footerLink = {
  color: "#000000",
  textDecoration: "underline",
};
