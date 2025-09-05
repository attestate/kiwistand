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

export async function generateDigestData(trie) {
  log("Starting digest generation...");
  log(`CACHE_DIR is: ${process.env.CACHE_DIR}`);
  const page = 0;
  const period = "week";
  const domain = "";
  const stories = await getStories(page, period, domain);
  console.log(stories);
}
