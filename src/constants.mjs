// @format
import { env } from "process";

import { keccak256 } from "ethereum-cryptography/keccak.js";

export const PROTOCOL = {
  pubsub: {
    prefix: "kiwi",
    topics: {
      roots: {
        id: "roots",
        version: "14.0.0",
      },
      messages: {
        id: "messages",
        version: "14.0.0",
      },
    },
  },
  protocols: {
    leaves: {
      id: "leaves",
      version: "17.0.0",
    },
    levels: {
      id: "levels",
      version: "17.0.0",
    },
  },
};

// NOTE: ethers-rs only allows strings as inputs that then get keccak256-hashed
// as salts. Hence, as a work-around, we hash a canonical string value here to
// simulate ethers-rs behavior.
//
// ethers-rs issue: https://github.com/gakonst/ethers-rs/issues/2321
const domainSeparatorSalt = Buffer.from("kiwinews domain separator salt");
const salt = Buffer.from(keccak256(domainSeparatorSalt)).toString("hex");

export const EIP712_DOMAIN = {
  name: "kiwinews",
  version: "1.0.0",
  salt: `0x${salt}`,
};

export const EIP712_MESSAGE = {
  Message: [
    { name: "title", type: "string" },
    { name: "href", type: "string" },
    { name: "type", type: "string" },
    { name: "timestamp", type: "uint256" },
  ],
};

// NOTE: An "anon-join" message registers a Semaphore identity commitment for
// the signer's identity. It has no title or href, so it's signed with its own
// type. Added in protocol version 14 (pubsub) / 17 (sync).
export const EIP712_ANON_JOIN = {
  Message: [
    { name: "commitment", type: "uint256" },
    { name: "type", type: "string" },
    { name: "timestamp", type: "uint256" },
  ],
};

// Anonymous upvotes (Semaphore v4). See src/anon.mjs.
//
// An identity needs at least this much karma (counted from messages with a
// timestamp at or before the "anon-join" message) to join the group.
export const ANON_MIN_KARMA = 10;
// A proof must use the root of one of the last ANON_ROOT_HISTORY group states
// (a state is the group after one join) ...
export const ANON_ROOT_HISTORY = 16;
// ... among the joins that are at least ANON_ROOT_SETTLE_SECS older than the
// upvote. Joins younger than that are ignored when checking an upvote, so a
// join that's still propagating between nodes can't make them disagree on
// which roots are valid.
export const ANON_ROOT_SETTLE_SECS = 300;
// Anonymous upvotes are stored in the cache's upvotes table under this
// identity, so they count for ranking and for the submitter's karma but give
// no one curator credit.
export const ANON_IDENTITY = "0x0000000000000000000000000000000000000000";

const node = {
  type: "object",
  additionalProperties: false,
  required: ["key", "hash"],
  properties: {
    level: { type: "integer" },
    key: { type: "string" },
    hash: { type: "string" },
    node: {
      $comment:
        "Type 'null' is allowed here as e.g. the root node might be of that type",
      type: ["string", "null"],
    },
  },
};

const nodes = {
  type: "array",
  items: {
    ...node,
  },
};

const comment = {
  type: "object",
  additionalProperties: false,
  properties: {
    timestamp: {
      $comment: "unix timestamp",
      type: "integer",
    },
    type: {
      const: "comment",
    },
    title: {
      type: "string",
      maxLength: 10_000,
    },
    href: {
      type: "string",
      format: "uri",
      pattern: "^kiwi:0x[a-fA-F0-9]{72}$",
      maxLength: 81,
    },
    signature: {
      type: "string",
      pattern: "0x[a-fA-F0-9]+",
    },
  },
  required: ["timestamp", "type", "title", "href", "signature"],
};

const uint256String = {
  type: "string",
  pattern: "^(0|[1-9][0-9]{0,77})$",
};

const anonJoin = {
  type: "object",
  additionalProperties: false,
  properties: {
    timestamp: {
      $comment: "unix timestamp",
      type: "integer",
    },
    type: {
      const: "anon-join",
    },
    commitment: {
      $comment: "Semaphore v4 identity commitment, decimal",
      ...uint256String,
    },
    signature: {
      type: "string",
      pattern: "0x[a-fA-F0-9]+",
    },
  },
  required: ["timestamp", "type", "commitment", "signature"],
};

// NOTE: An anonymous upvote carries no signature and no address. It's
// authorized by a Semaphore proof that its sender is a member of the group.
const anonUpvote = {
  type: "object",
  additionalProperties: false,
  properties: {
    timestamp: {
      $comment: "unix timestamp",
      type: "integer",
    },
    type: {
      const: "anon-upvote",
    },
    href: {
      $comment: "The upvoted story, kiwi:0x<index of its submission>",
      type: "string",
      format: "uri",
      pattern: "^kiwi:0x[a-fA-F0-9]{72}$",
      maxLength: 81,
    },
    depth: {
      $comment: "The Merkle tree depth the proof was generated for",
      type: "integer",
      minimum: 1,
      maximum: 32,
    },
    merkleRoot: uint256String,
    nullifier: uint256String,
    proof: {
      $comment: "Packed Groth16 proof (8 field elements)",
      type: "array",
      minItems: 8,
      maxItems: 8,
      items: uint256String,
    },
  },
  required: [
    "timestamp",
    "type",
    "href",
    "depth",
    "merkleRoot",
    "nullifier",
    "proof",
  ],
};

const upvote = {
  type: "object",
  additionalProperties: false,
  properties: {
    timestamp: {
      $comment: "unix timestamp",
      type: "integer",
    },
    type: {
      const: "amplify",
    },
    title: {
      type: "string",
      // NOTE: We want to have a title with at least a length of 1 in the
      // future, but I think for now this is causing a synchronization bug
      //minLength: 1,
      maxLength: 80,
    },
    href: {
      type: "string",
      format: "uri",
      pattern: "^(https?://|data:text/plain,|kiwi:0x)",
      maxLength: 2048,
    },
    signature: {
      type: "string",
      pattern: "0x[a-fA-F0-9]+",
    },
  },
  required: ["timestamp", "type", "title", "href", "signature"],
};

export const ANON_TYPES = ["anon-join", "anon-upvote"];

export const SCHEMATA = {
  comparison: {
    type: "object",
    additionalProperties: false,
    required: ["missing", "mismatch", "match"],
    properties: {
      missing: {
        ...nodes,
      },
      mismatch: {
        ...nodes,
      },
      match: {
        ...nodes,
      },
    },
  },
  listMessages: {
    type: "object",
    additionalProperties: false,
    properties: {
      from: {
        $comment:
          "The number of entries the request should be offset by. It is inclusive.",
        type: "integer",
        minimum: 0,
      },
      amount: {
        $comment: "The number of entries that the request should contain",
        type: "integer",
        minimum: 0,
        maximum: parseInt(env.HTTP_MESSAGES_MAX_PAGE_SIZE, 10),
      },
      type: {
        $comment:
          "The type of message that we should filter by in the request.",
        type: "string",
        enum: ["amplify", "comment", "anon-join", "anon-upvote"],
      },
    },
    required: ["from", "amount"],
  },
  message: {
    oneOf: [upvote, comment, anonJoin, anonUpvote],
  },
};
