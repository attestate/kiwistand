// @format
import * as lp from "it-length-prefixed";
import { pipe } from "it-pipe";
import { toString } from "uint8arrays/to-string";
import { fromString } from "uint8arrays/from-string";
import map from "it-map";
import all from "it-all";

import log from "./logger.mjs";
import * as store from "./store.mjs";

// This function must return the differences in nodes and it also must indicate
// the point of view.
export function compareLevels(a, b) {
  const maxLength = Math.max(a.length, b.length);
  const results = [];
  for (let i = 0; i < maxLength; i++) {
    if (!a[i] || !b[i]) {
      results[i] = false;
    } else {
      results[i] = Buffer.compare(a[i].hash, b[i].hash) === 0 ? true : false;
    }
  }
  return results;
}

export async function toWire(message, sink) {
  const sMessage = JSON.stringify(message);
  const buf = fromString(sMessage);
  return await pipe([buf], lp.encode(), sink);
}

export async function fromWire(source) {
  return await pipe(source, lp.decode(), async (_source) => {
    const results = await map(_source, (message) => {
      if (!message) return;
      const sMessage = toString(message.subarray());
      return JSON.parse(sMessage);
    });
    return await all(results);
  });
}

export function handleDiscovery(evt) {
  log(`discovered ${evt.detail.id.toString()}`);
}

export async function handleConnection(evt) {
  const trie = await store.create();
  console.log(trie.root());
  log(`connected ${evt.detail.remotePeer.toString()}`);
}

export function handleDisconnection(evt) {
  log(`disconnected ${evt.detail.remotePeer.toString()}`);
}
