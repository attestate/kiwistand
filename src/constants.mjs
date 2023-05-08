// @format
import { env } from "process";

import { keccak256 } from "ethereum-cryptography/keccak.js";

export const PROTOCOL = {
  pubsub: {
    prefix: "kiwi",
    topics: {
      roots: {
        id: "roots",
        version: "0.0.1",
      },
      messages: {
        id: "messages",
        version: "0.0.1",
      },
    },
  },
  protocols: {
    leaves: {
      id: "leaves",
      version: "2.0.0",
    },
    levels: {
      id: "levels",
      version: "2.0.0",
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

export const EIP712_DELEGATION = {
  Delegation: [
    { name: "delegate", type: "address" },
    { name: "type", type: "string" },
    { name: "timestamp", type: "uint256" },
  ],
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
  required: ["key", "hash", "node"],
  properties: {
    level: { type: "integer" },
    key: { type: "string" },
    hash: { type: "string" },
    node: { type: "string" },
  },
};

const nodes = {
  type: "array",
  items: {
    ...node,
  },
};

const timestamp = {
  $comment:
    "unix timestamp that must be more recent than 2023 (or whatever the value of MIN_TIMESTAMP_SECS is).",
  type: "integer",
  minimum: parseInt(env.MIN_TIMESTAMP_SECS, 10),
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
  delegation: {
    type: "object",
    additionalProperties: false,
    required: ["delegate", "type", "timestamp", "signature"],
    properties: {
      delegate: {
        $comment:
          "An Ethereum address that the signer is delegating their privileges to",
        type: "string",
        pattern: "0x[a-fA-F0-9]{40}",
      },
      type: {
        $comment:
          "Delegates can be 'appointed' and 'revoked'. A priorly-appointed delegate can only be 'revoked' by the appointer address",
        type: "string",
        enum: ["appoint", "revoke"],
      },
      timestamp,
      signature: {
        type: "string",
        pattern: "0x[a-fA-F0-9]+",
      },
    },
  },
  pagination: {
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
    },
    required: ["from", "amount"],
  },
  message: {
    type: "object",
    additionalProperties: false,
    properties: {
      timestamp,
      type: {
        type: "string",
        enum: ["amplify"],
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
  },
};
