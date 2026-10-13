import React from "react";

import Credit from "./_components/Credit.jsx";
import { StoryFrame, PostEmbed, Title, clip } from "./_components/kit.jsx";
import { splitQuote, isDeletedTweet, tweetHandle } from "../../src/quote.mjs";

// An X post. The hero shows the post card with its image; a row shows the
// image as the thumbnail and the card with the text only. When the post was
// deleted, the submitter's title takes over above the card.
export default function TweetEmail({ story = { metadata: {} }, rank = 1, hero = true }) {
  const metadata = story.metadata || {};
  const deleted = isDeletedTweet(metadata);

  let handle = metadata.twitterCreator || tweetHandle(story.title);
  if (!handle) {
    const match = /(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status/i.exec(story.href || "");
    handle = match ? `@${match[1]}` : "@x";
  }

  const description = (metadata.ogDescription || "").replace(/<br\s*\/?>/gi, "\n");
  const { text, quote } = splitQuote(description);
  const postText = deleted ? "" : clip(text || quote?.text || "", hero ? 360 : 280);
  const image = deleted ? null : metadata.image || null;

  const body = (
    <>
      {deleted ? (
        <div style={{ margin: "0 0 8px 0" }}>
          <Title href={story.storyLink} hero={hero}>{metadata.compliantTitle || story.title}</Title>
        </div>
      ) : null}
      <PostEmbed
        href={story.storyLink}
        hero={hero}
        avatar={deleted ? null : metadata.twitterAuthorAvatar}
        handle={handle}
        text={postText}
        image={image}
        deleted={deleted}
      />
    </>
  );

  return (
    <StoryFrame
      story={story}
      rank={rank}
      hero={hero}
      source="x.com"
      body={body}
      thumbnail={hero ? null : image}
      credit={<Credit story={story} />}
    />
  );
}
