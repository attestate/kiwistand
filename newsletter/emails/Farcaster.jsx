import React from "react";

import Credit from "./_components/Credit.jsx";
import { StoryFrame, PostEmbed, clip } from "./_components/kit.jsx";

const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

// The first picture among a cast's embeds, if any.
function castImage(cast) {
  const embed = (cast?.embeds || []).find((embed) => {
    if (!embed) return false;
    const url = (embed.url || "").toLowerCase();
    return imageExtensions.some((ext) => url.includes(ext)) || embed.metadata?.image;
  });
  return embed ? embed.metadata?.image?.url || embed.url : null;
}

// A Farcaster cast, laid out like an X post.
export default function FarcasterEmail({ story = { metadata: { farcasterCast: { author: {} } } }, rank = 1, hero = true }) {
  const cast = story.metadata?.farcasterCast || {};
  const author = cast.author || {};
  const image = castImage(cast);
  const text = clip(cast.text || story.metadata?.ogDescription || "", hero ? 360 : 280);

  return (
    <StoryFrame
      story={story}
      rank={rank}
      hero={hero}
      source="farcaster.xyz"
      body={
        <PostEmbed
          href={story.storyLink}
          hero={hero}
          avatar={author.pfp}
          handle={`@${author.username || "farcaster"}`}
          text={text}
          image={image}
        />
      }
      thumbnail={hero ? null : image}
      credit={<Credit story={story} />}
    />
  );
}
