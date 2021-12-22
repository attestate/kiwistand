// @format
import PeerId from "peer-id";
import { writeFile, readFile } from "fs/promises";

import config from "./config.mjs";

export async function bootstrap(path) {
  let peerId;
  if (!path) {
    return await create();
  }

  try {
    peerId = await load(path);
  } catch (err) {
    if ((err.code = "ENOENT")) {
      peerId = await create();
      await store(path, peerId);
    } else {
      throw err;
    }
  }
  return peerId;
}

export async function create() {
  return await PeerId.create(config.peerId.options);
}

export async function store(path, id) {
  await writeFile(path, JSON.stringify(id.toJSON()));
}

export async function load(path) {
  const content = (await readFile(path)).toString();
  const id = JSON.parse(content);
  return await PeerId.createFromJSON(id);
}
