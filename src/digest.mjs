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
    // 1. Fetch the top stories using the same function as the website.
    log("Fetching top stories for digest...");
    const stories = await getStories(0, "week", "");
    log(`Found ${stories.length} total stories.`);

    if (stories.length === 0) {
      log("No stories found. Aborting digest generation.");
      return;
    }

    // Process more stories to ensure we get 3 with images
    const topStories = stories.slice(0, 10); // Get more initially
    log(`Processing top ${topStories.length} stories to find 3 for digest.`);

    // 2. Enrich the stories with fresh metadata and identity data.
    log("Enriching stories with raw metadata and identities for digest...");
    const enrichedStories = await Promise.all(
      topStories.map(async (story) => {
        try {
          log(`Processing story for digest: ${story.title}`);
          const storyMetadata = await metadata(
            story.href,
            false,
            undefined,
            true,
          ); // raw = true
          const storyIdentity = await resolve(story.identity, true); // forceFetch = true
          const sanitizedTitle = DOMPurify.sanitize(story.title || "");
          const slug = getSlug(sanitizedTitle);

          return {
            ...story,
            sanitizedTitle,
            storyLink: `https://news.kiwistand.com/stories/${slug}?index=0x${story.index}`,
            metadata: storyMetadata,
            submitter: storyIdentity,
            identity: storyIdentity,
            farcasterCast: storyMetadata.farcasterCast,
          };
        } catch (error) {
          log(
            `Error processing story "${story.title}" (${story.href}) for digest: ${error.message}`,
          );
          return null; // Return null for failed stories
        }
      }),
    );

    const successfulStories = enrichedStories.filter((story) => story !== null);
    
    // Take top 3 stories without filtering for images
    const finalStories = successfulStories.slice(0, 3);
    
    log(`Selected top ${finalStories.length} stories from ${successfulStories.length} total`);

    // 3. Save the result to a JSON file.
    const outputPath = path.join(process.cwd(), "digest-data.json");
    fs.writeFileSync(
      outputPath,
      JSON.stringify({ stories: finalStories }, null, 2),
    );
    log(`Digest data successfully saved to ${outputPath}`);
  } catch (error) {
    log(`FATAL: An error occurred during digest generation: ${error.stack}`);
    // We don't want to crash the main server process, so we just log the error.
  }
}
