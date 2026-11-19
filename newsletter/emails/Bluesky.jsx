import React from "react";

import Credit from "./_components/Credit.jsx";
import { StoryFrame, PostEmbed, clip } from "./_components/kit.jsx";

// A Bluesky post, laid out like an X post.
export default function BlueskyEmail({ story = { metadata: {} }, rank = 1, hero = true }) {
  const post = story.metadata?.blueskyPost || {};
  const image = post.images?.[0] || null;

  return (
    <StoryFrame
      story={story}
      rank={rank}
      hero={hero}
      source="bsky.app"
      body={
        <PostEmbed
          href={story.storyLink}
          hero={hero}
          avatar={post.author?.avatar}
          handle={`@${post.author?.handle || "bsky.app"}`}
          text={clip(post.text || "", hero ? 360 : 280)}
          image={image}
        />
      }
      thumbnail={hero ? null : image}
      credit={<Credit story={story} />}
    />
  );
}
