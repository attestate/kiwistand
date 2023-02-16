// @format
import { open } from "npm:lmdb";

export function init(path, table) {
  const db = new open({ path });
  return db.openDB(table);
}

// TODO: Apart from storing each value by their hash, we should also stored
// them based on their time stamps, so that we can do range queries, similar to
// how we do it in @attestate/groupie
// However, for now this isn't important
export async function store(db, key, value) {
  await db.put(key, value);
}
