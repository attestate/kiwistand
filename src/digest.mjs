import path from "path";
import fs from "fs";

import { getStories } from "./views/best.mjs";
import { metadata } from "./parser.mjs";
import { resolve } from "./ens.mjs";
import log from "./logger.mjs";
import { sub } from "date-fns";
import * as store from "./store.mjs";
import * as registry from "./chainstate/registry.mjs";
import DOMPurify from "isomorphic-dompurify";
import slugify from "slugify";

function getSlug(title) {
  if (!title) {
    return "";
  }
  // This mimics the logic from the main codebase
  return slugify(DOMPurify.sanitize(title));
}

export async function generateDigestData() {
  log("Starting digest generation...");
  log(`CACHE_DIR is: ${process.env.CACHE_DIR}`);

  try {
    // 1. Fetch the top 3 stories using the same function as the website,
    //    but with options for fresh, complete data.
    log("Fetching top stories for digest...");
    const stories = await getStories(0, "week", "", {
      forceFetch: true,
      rawMetadata: true,
      createStoryLink: true,
      amount: 3,
    });
    log(`Found ${stories.length} total stories.`);

    if (stories.length === 0) {
      log("No stories found. Aborting digest generation.");
      return;
    }
    
    log(`Selected top ${stories.length} stories.`);

    const generatedAt = new Date();
    const isoDate = generatedAt.toISOString();
    const campaignDate = isoDate.slice(0, 10);

    const storiesWithTracking = stories.map((story, index) => {
      let trackedStoryLink = story.storyLink;
      if (story.storyLink) {
        try {
          const url = new URL(story.storyLink);
          url.searchParams.set("utm_source", "kiwi-newsletter");
          url.searchParams.set("utm_medium", "email");
          url.searchParams.set("utm_campaign", `newsletter-${campaignDate}`);
          url.searchParams.set("utm_content", `story-${index + 1}`);
          trackedStoryLink = url.toString();
        } catch (error) {
          log(`Failed to append tracking parameters for story ${story.href}: ${error.message}`);
        }
      }

      let submitterLink = null;
      if (story.identity) {
        const baseProfileUrl = `https://news.kiwistand.com/upvotes?address=${story.identity}`;
        try {
          const profileUrl = new URL(baseProfileUrl);
          profileUrl.searchParams.set("utm_source", "kiwi-newsletter");
          profileUrl.searchParams.set("utm_medium", "email");
          profileUrl.searchParams.set("utm_campaign", `newsletter-${campaignDate}`);
          profileUrl.searchParams.set("utm_content", `submitter-${index + 1}`);
          submitterLink = profileUrl.toString();
        } catch (error) {
          submitterLink = baseProfileUrl;
          log(`Failed to append tracking parameters for submitter ${story.identity}: ${error.message}`);
        }
      }

      return {
        ...story,
        storyLink: trackedStoryLink,
        submitterLink,
      };
    });

    // 2. Save the result to a JSON file.
    const outputPath = path.join(process.cwd(), "digest-data.json");
    fs.writeFileSync(
      outputPath,
      JSON.stringify(
        {
          generatedAt: isoDate,
          stories: storiesWithTracking,
        },
        null,
        2,
      ),
    );
    log(`Digest data successfully saved to ${outputPath}`);
  } catch (error) {
    log(`FATAL: An error occurred during digest generation: ${error.stack}`);
  }
}
