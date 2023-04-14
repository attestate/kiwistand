// @format
import { database } from "@attestate/crawler";
import { resolve } from "path";

export async function allowlist() {
  const path = resolve(process.env.DATA_DIR, "call-block-logs-load");
  const db = database.open(path);
  const name = database.order("call-block-logs");
  const subdb = db.openDB(name);
  const all = await database.all(subdb, "");
  const addresses = all.map(({ value }) => value);
  return addresses;
}
