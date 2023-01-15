// @format
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { utils } from "ethers";
import canonicalize from "canonicalize";
import { keccak256 } from "ethereum-cryptography/keccak.js";
import { bytesToHex } from "ethereum-cryptography/utils.js";

import log from "./logger.mjs";

const ajv = new Ajv();
addFormats(ajv);

export function handleDiscovery(peer) {
  log(`discovered ${peer.toCID()}`);
}

/*
 * Upon peer discovery:
 *
 * - query timestamps from other peers
 * - If average(remote_timestamp) > local_timestamp:
 *   - "Oh, I'm out of sync": For a message range of 10 messages,
 *
 */

// TODO: Make this an EIP-712 message so that its not replayable by someone
// else.
const schemata = {
  message: {
    type: "object",
    properties: {
      timestamp: {
        format: "date-time",
        type: "string",
      },
      text: {
        type: "string",
        minLength: 240,
        maxLength: 5000,
      },
      signature: {
        type: "string",
        pattern: "0x[a-fA-F0-9]+",
      },
    },
  },
};
const messageValidator = ajv.compile(schemata.message);

export function toDigest(message) {
  const copy = { ...message };
  if (copy.signature) delete copy["signature"];
  const canonical = Buffer.from(canonicalize(copy));
  const hash = bytesToHex(keccak256(canonical));
  return prefixHex(hash);
}

export function prefixHex(value) {
  return `0x${value}`;
}

export function verify(message) {
  const result = messageValidator(message);
  if (!result) {
    log(`Wrongly formatted message: ${messageValidator.errors}`);
    return;
  }
  const digest = toDigest(message);
  const address = utils.verifyMessage(digest, message.signature);
  return address;
}
