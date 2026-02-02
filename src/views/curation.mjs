// @format
import path from "path";
import { env } from "process";

import { fetchBuilder, FileSystemCache } from "node-fetch-cache";

import { fetchCache } from "../utils.mjs";

const minuteInMs = 60000;
const cacheDirectory = path.resolve(env.CACHE_DIR);
const cache = new FileSystemCache({
  cacheDirectory: cacheDirectory,
  ttl: minuteInMs * 60,
});
const fetch = fetchBuilder.withCache(cache);
const fetchStaleWhileRevalidate = fetchCache(fetch, cache, cacheDirectory);

const url =
  "https://opensheet.elk.sh/1R9zOdQPNo-UZqBNMvvnLig7eabKkTfMLjs1h_RGflaM/";

export async function getSheet(sheetName) {
  const signal = AbortSignal.timeout(10000);
  const response = await fetchStaleWhileRevalidate(url + sheetName, { signal });
  if (!response.ok) {
    throw new Error("Couldn't fetch the sheet");
  }
  const data = await response.json();
  const links = data.map(({ link }) => link);
  return {
    name: sheetName,
    links,
  };
}
