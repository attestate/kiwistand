import React from "react";

import Credit from "./_components/Credit.jsx";
import { StoryFrame, Title, hostname, clip, isUpload, uploadVariant, light, font } from "./_components/kit.jsx";

// A link, a text post, an uploaded picture, an X article or a video-only
// tweet. In the hero the picture sits on top in its own shape; in a row it
// is a square thumbnail, and without a picture the text uses the full width.
export default function RowEmail({ story = {}, rank = 1, hero = true }) {
  const { href, title, metadata } = story;

  const isTextPost = typeof href === "string" && href.startsWith("data:");
  let textPost = "";
  if (isTextPost) {
    try {
      textPost = decodeURIComponent(href.replace(/^data:text\/plain,/, ""));
    } catch {}
  }
  const upload = isUpload(href);

  const source = isTextPost
    ? "text post"
    : upload
      ? "imagedelivery.net"
      : hostname(href) || metadata?.domain || "";

  const heroImage = upload
    ? uploadVariant(href, "w=1072,h=800,fit=scale-down")
    : metadata?.image || null;
  const thumbnail = upload
    ? uploadVariant(href, "w=208,h=208,fit=cover")
    : metadata?.image || null;

  const headline =
    metadata?.isXArticle && metadata?.ogTitle
      ? metadata.ogTitle
      : metadata?.compliantTitle || title;

  const body = (
    <>
      <Title href={story.storyLink} hero={hero}>{headline}</Title>
      {textPost ? (
        <div className="k-tertiary" style={{ margin: "8px 0 0 0", fontFamily: font, fontSize: "14px", lineHeight: "21px", color: light.tertiary, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {clip(textPost, 280)}
        </div>
      ) : null}
    </>
  );

  return (
    <StoryFrame
      story={story}
      rank={rank}
      hero={hero}
      source={source}
      body={body}
      heroImage={heroImage}
      thumbnail={thumbnail}
      credit={<Credit story={story} />}
    />
  );
}
