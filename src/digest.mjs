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

    // 2. Save the result to a JSON file.
    const outputPath = path.join(process.cwd(), "digest-data.json");
    fs.writeFileSync(
      outputPath,
      JSON.stringify({ stories: stories }, null, 2),
    );
    log(`Digest data successfully saved to ${outputPath}`);
  } catch (error) {
    log(`FATAL: An error occurred during digest generation: ${error.stack}`);
  }
}
