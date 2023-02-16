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
 * Problems of synchronization of nodes: How do we make sure what is the
 * objective state of the network when a new node with state s_0 joins?  Now
 * any node could pretend that they're the authoritative source of data. One
 * way of circumventing that problem is by regularly committing the network
 * state as a root hash into the Ethereum network. If we have a trail of
 * messages that are committed in there, then we can also hard code a canonical
 * smart contract address that others are trusting. The question is then of
 * course who shall we allowed to write to this bytes32, because if they're
 * malicious then that's bad too.
 *
 * A different way of addressing it is by going from the user perspective and
 * saying that for a smart contract that registers user names, there are a
 * bunch of people sending new messages with signatures. We could use the
 * lamport clock of multiple nodes as a rough estimate at what point the
 * network currently is. And then this would make it much harder for an eclipse
 * attacker to anyways pretend to show an entirely different version.
 *
 * Another question is: Would there need to be network wide consensus? Or would
 * eventual consistency suffice? If we e.g. wanted a node to sync based on a
 * snapshot of the tree, then I think we'd have to implement consensus based on
 * some kind of commit and reveal scheme.
 *
 * This one is helpful: https://notes.ethereum.org/@djrtwo/ws-sync-in-practice
 *
 * Actually, this sounds pretty much how I was planning to do it too. But one
 * question is now: For a Lamport Clock, does a lamport timestamp even exist
 * among different nodes? Or is it uniquely always just present in one node?
 *
 * Anyways, we don't need to establish a name registry, the slashcash staking
 * protocol would be enough. And then a node verifies that this address
 * currently has eth staked in that contract.
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
