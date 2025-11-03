// @format
import { env } from "process";

import { keccak256 } from "ethereum-cryptography/keccak.js";

export const PROTOCOL = {
  pubsub: {
    prefix: "kiwi",
    topics: {
      roots: {
        id: "roots",
        version: "10.0.0",
      },
      messages: {
        id: "messages",
        version: "10.0.0",
      },
    },
  },
  protocols: {
    leaves: {
      id: "leaves",
      version: "13.0.0",
    },
    levels: {
      id: "levels",
      version: "13.0.0",
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
      pattern: "^https?://",
      maxLength: 2048,
    },
    signature: {
      type: "string",
      pattern: "0x[a-fA-F0-9]+",
    },
  },
  required: ["timestamp", "type", "title", "href", "signature"],
};

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
        enum: ["amplify", "comment"],
      },
    },
    required: ["from", "amount"],
  },
  message: {
    oneOf: [upvote, comment],
  },
};
