import React from "react";
import { Head, Html, Body } from "@react-email/components";
import fs from "fs";
import path from "path";

import RowEmail from "./Row.jsx";
import TweetEmail from "./Tweet.jsx";
import FarcasterEmail from "./Farcaster.jsx";
import BlueskyEmail from "./Bluesky.jsx";
import { Hairline, LinkText, emailCSS, fontCSS, light, font } from "./_components/kit.jsx";

// Load digest data
let digestStories = [];
let digestGeneratedAt = null;
let digestIssue = null;
try {
  const digestDataPath = process.env.DIGEST_DATA
    ? path.resolve(process.env.DIGEST_DATA)
    : path.join(process.cwd(), '..', 'digest-data.json');
  const digestData = JSON.parse(fs.readFileSync(digestDataPath, 'utf-8'));
  digestStories = digestData.stories || [];
  digestGeneratedAt = digestData.generatedAt || null;
  // Optional issue number; without it the header shows the week.
  digestIssue = digestData.issue || null;
} catch (error) {
  console.error('Failed to load digest-data.json:', error);
}

// --- Main Component ---

export default function DigestEmail({
  stories = digestStories,
  generatedAt = digestGeneratedAt,
  issue = digestIssue,
}) {
  const components = {
    Row: RowEmail,
    Tweet: TweetEmail,
    Farcaster: FarcasterEmail,
    Bluesky: BlueskyEmail,
  };

  // Uploaded pictures (imagedelivery.net) are rendered by Row.jsx now.
  const bannedDomains = [];
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

  const date = issueDate(generatedAt);

  return (
    <Html lang="en">
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="x-apple-disable-message-reformatting" />
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style>{fontCSS}</style>
        <style>{emailCSS}</style>
      </Head>
      {/* NOTE: No background color in the Body's style: react-email copies
          it onto a wrapper cell that the dark-mode classes can't reach. The
          page color comes from the bgcolor attributes. */}
      <Body className="k-body" bgcolor={light.page} style={{ margin: 0, padding: 0, color: light.text, fontFamily: font }}>
        <div style={preheader}>{preheaderText(storiesToRender)}</div>
        <table role="presentation" className="k-page" width="100%" cellPadding="0" cellSpacing="0" border="0" bgcolor={light.page} style={{ borderCollapse: "collapse", backgroundColor: light.page }}>
          <tbody>
            <tr>
              <td align="center" className="k-page-pad" style={{ padding: "32px 40px" }}>
                <table role="presentation" className="k-card k-frame" width="100%" cellPadding="0" cellSpacing="0" border="0" bgcolor={light.card} style={{ maxWidth: "600px", margin: "0 auto", borderCollapse: "separate", backgroundColor: light.card, border: `1px solid ${light.border}`, borderRadius: "8px" }}>
                  <tbody>
                    <tr>
                      <td className="k-card-pad" style={{ padding: "28px 32px 36px 32px", fontFamily: font, textAlign: "left" }}>
                        <Header issue={issue} date={date} />
                        <Hairline />
                        <Intro date={date} count={storiesToRender.length} />

                        {storiesToRender.map((story, index) => {
                          const Component = components[getComponentForStory(story)];
                          return (
                            <React.Fragment key={story.href}>
                              {index > 0 && <Hairline />}
                              <Component story={story} rank={index + 1} hero={index === 0} />
                            </React.Fragment>
                          );
                        })}

                        <Hairline />
                        <AppBox />
                        <Footer />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </Body>
    </Html>
  );
}

// Logo and wordmark on the left, the issue (or week) on the right.
function Header({ issue, date }) {
  const label = issue ? `ISSUE #${issue}` : `WEEK ${date.week}`;
  return (
    <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" border="0" style={{ borderCollapse: "collapse" }}>
      <tbody>
        <tr>
          <td style={{ padding: "0 0 18px 0", verticalAlign: "middle" }}>
            <a href={withUtm("https://news.kiwistand.com/", "logo")} style={{ textDecoration: "none" }}>
              <table role="presentation" cellPadding="0" cellSpacing="0" border="0" style={{ borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td width="29" style={{ width: "29px", verticalAlign: "middle" }}>
                      <img src="https://news.kiwistand.com/kiwi-icon-email-transparent.png" alt="" width="29" height="29" style={{ display: "block", border: 0 }} />
                    </td>
                    <td style={{ padding: "0 0 0 8px", verticalAlign: "middle", lineHeight: 0 }}>
                      {/* "Kiwi" brown and "news" lime; mail apps that support
                          dark mode swap in the dark theme's colors. */}
                      <img className="k-light-img" src="https://news.kiwistand.com/kiwi-wordmark-email-2-light.png" alt="Kiwi News" width="112" height="16" style={{ display: "block", border: 0 }} />
                      <div className="k-dark-img" style={{ display: "none", maxHeight: 0, overflow: "hidden", msoHide: "all" }}>
                        <img src="https://news.kiwistand.com/kiwi-wordmark-email-2-dark.png" alt="Kiwi News" width="112" height="16" style={{ display: "block", border: 0 }} />
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </a>
          </td>
          <td align="right" className="k-muted" style={{ padding: "0 0 18px 0", verticalAlign: "middle", textAlign: "right", fontFamily: font, fontSize: "11px", lineHeight: "14px", fontWeight: 500, letterSpacing: "1px", color: light.secondary, whiteSpace: "nowrap" }}>
            {label}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

// "SUNDAY, 11 OCT" / "The week's five."
function Intro({ date, count }) {
  const headline = `The week's ${countWord(count)}.`;
  return (
    <div style={{ padding: "24px 0 20px 0" }}>
      <div className="k-muted" style={{ fontFamily: font, fontSize: "11px", lineHeight: "14px", fontWeight: 500, letterSpacing: "1px", color: light.secondary, margin: "0 0 8px 0" }}>
        {date.label}
      </div>
      <h1 className="k-text k-headline" style={{ fontFamily: font, fontSize: "40px", lineHeight: "48px", fontWeight: 800, letterSpacing: "-1.4px", color: light.text, margin: 0 }}>
        {headline}
      </h1>
    </div>
  );
}

// The iOS app: text on the left, the TestFlight QR code on the right
// (below it on phones).
function AppBox() {
  const href = TESTFLIGHT_URL;
  return (
    <table role="presentation" className="k-strip" width="100%" cellPadding="0" cellSpacing="0" border="0" bgcolor={light.strip} style={{ borderCollapse: "separate", backgroundColor: light.strip, borderRadius: "8px" }}>
      <tbody>
        <tr>
          <td className="k-stack k-app-text" valign="middle" style={{ padding: "20px 0 20px 20px", verticalAlign: "middle" }}>
            <table role="presentation" cellPadding="0" cellSpacing="0" border="0" style={{ borderCollapse: "separate" }}>
              <tbody>
                <tr>
                  <td bgcolor={light.accent} style={{ backgroundColor: light.accent, color: light.accentText, borderRadius: "4px", padding: "2px 6px", fontFamily: font, fontSize: "10px", lineHeight: "13px", fontWeight: 600, letterSpacing: "1px" }}>
                    NEW
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="k-row-title" style={{ margin: "8px 0 0 0", fontFamily: font, fontSize: "18px", lineHeight: "23px", fontWeight: 700 }}>
              <LinkText href={href}>Kiwi News for iPhone, rebuilt from scratch</LinkText>
            </div>
            <div className="k-tertiary" style={{ margin: "8px 0 0 0", fontFamily: font, fontSize: "14px", lineHeight: "21px", color: light.tertiary }}>
              The iOS app is now fully native: a faster feed, comments and
              reactions, notifications, and sharing links straight from Safari.
              It's in beta on TestFlight, and we'd love your feedback.
            </div>
          </td>
          <td className="k-stack-gap" width="20" style={{ width: "20px", fontSize: 0, lineHeight: 0 }}>&nbsp;</td>
          <td className="k-stack k-qr" align="center" valign="middle" width="138" style={{ padding: "20px 20px 20px 0", width: "138px", verticalAlign: "middle", textAlign: "center" }}>
            <a href={href} style={{ display: "inline-block", textDecoration: "none" }}>
              <table role="presentation" cellPadding="0" cellSpacing="0" border="0" style={{ borderCollapse: "separate" }}>
                <tbody>
                  <tr>
                    <td bgcolor="#FFFFFF" style={{ backgroundColor: "#FFFFFF", border: `1px solid ${light.border}`, borderRadius: "6px", padding: "6px" }}>
                      <img src="https://news.kiwistand.com/testflight-qr.png" alt="QR code for the Kiwi News TestFlight beta" width="112" height="112" style={{ display: "block", border: 0 }} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </a>
            <div className="k-muted" style={{ margin: "8px 0 0 0", fontFamily: font, fontSize: "11px", lineHeight: "14px", color: light.secondary, whiteSpace: "nowrap" }}>
              Scan for the iPhone beta
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

// Buttondown adds its own Subscribe / Unsubscribe / View online links
// below this.
function Footer() {
  return (
    <div className="k-tertiary" style={{ padding: "24px 0 0 0", fontFamily: font, fontSize: "14px", lineHeight: "20px", color: light.tertiary }}>
      More every day on{" "}
      <LinkText href={withUtm("https://news.kiwistand.com/", "footer")} style={{ fontWeight: 600, color: light.text }}>
        news.kiwistand.com
      </LinkText>
    </div>
  );
}

// "SUNDAY, 11 OCT" and the ISO week of the day the digest was made.
function issueDate(generatedAt) {
  let day = new Date(generatedAt || Date.now());
  if (Number.isNaN(day.getTime())) day = new Date();
  const weekday = day.toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
  const month = day.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
  const label = `${weekday}, ${day.getUTCDate()} ${month}`.toUpperCase();
  // ISO 8601 week number.
  const thursday = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
  thursday.setUTCDate(thursday.getUTCDate() + 3 - ((thursday.getUTCDay() + 6) % 7));
  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((thursday - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return { label, week };
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

const preheader = {
  fontSize: "1px",
  lineHeight: "1px",
  color: light.page,
  display: "none",
  maxHeight: 0,
  maxWidth: 0,
  opacity: 0,
  overflow: "hidden",
  msoHide: "all",
};
