// @format
import * as lp from "it-length-prefixed";
import { pipe } from "it-pipe";
import { toString } from "uint8arrays/to-string";
import { fromString } from "uint8arrays/from-string";
import all from "it-all";

import log from "./logger.mjs";

export async function toWire(message, sink) {
  const sMessage = JSON.stringify(message);
  const buf = fromString(sMessage);
  return await pipe([buf], lp.encode(), sink);
}

export async function fromWire(source) {
  return await pipe(source, lp.decode(), async (_source) => {
    const [message] = await all(_source);
    const sMessage = toString(message.subarray());
    return JSON.parse(sMessage);
  });
}

export function handleDiscovery(peer) {
  log(`discovered ${peer.toCID()}`);
}
