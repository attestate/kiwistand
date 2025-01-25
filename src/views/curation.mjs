// @format
import path from "path";
import { env } from "process";

import { fetchBuilder, FileSystemCache } from "node-fetch-cache";

import { fetchCache } from "../utils.mjs";

const url =
  "https://opensheet.elk.sh/1R9zOdQPNo-UZqBNMvvnLig7eabKkTfMLjs1h_RGflaM/";

export async function getSheet(sheetName) {
  const signal = AbortSignal.timeout(5000);
  const response = await fetch(url + sheetName, { signal });
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
