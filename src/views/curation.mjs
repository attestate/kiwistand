// @format
import { fetchBuilder, MemoryCache } from "node-fetch-cache";

const fetch = fetchBuilder.withCache(
  new MemoryCache({
    ttl: 60000, // 1min
  }),
);

const url =
  "https://opensheet.elk.sh/1R9zOdQPNo-UZqBNMvvnLig7eabKkTfMLjs1h_RGflaM/";

export async function getSheet(sheetName) {
  const response = await fetch(url + sheetName);
  if (!response.ok) {
    throw new Error("Couldn't fetch the sheet");
  }
  const data = await response.json();
  const { preview, displayName, description, curator } = data[0];
  const links = data.map(({ link }) => link);
  return {
    name: sheetName,
    links,
    displayName,
    preview,
    description,
    curator,
  };
}

export async function getSheets() {
  const sheets = ["publicgoods", "farcaster", "protocols"];
  const results = [];
  for (const sheet of sheets) {
    results.push(await getSheet(sheet));
  }
  return results;
}
