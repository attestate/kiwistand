import path from "path";
import fs from "fs";

import { getStories } from "./views/best.mjs";
import { metadata } from "./parser.mjs";
import { resolve } from "./ens.mjs";
import log from "./logger.mjs";

export async function generateDigestData(trie) {
  log("Starting digest generation...");
  log(`CACHE_DIR is: ${process.env.CACHE_DIR}`);

  try {
    // 1. Fetch the top stories from the database.
    log("Fetching top 3 stories for digest...");
    // The 'trie' argument is not used by getStories, so passing null is fine.
    // Using 'all' for the period to get all stories.
    const allStories = await getStories(trie, 0, "week", null);
    log(`Found ${allStories.length} total stories in database.`);

    if (allStories.length === 0) {
      log("No stories found in the database. Aborting digest generation.");
      return;
    }

    // Process more stories to ensure we get 3 with images
    const topStories = allStories.slice(0, 10); // Get more initially
    log(`Processing top ${topStories.length} stories to find 3 with images for digest.`);

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

          return {
            ...story,
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
