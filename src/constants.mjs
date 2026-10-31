// @format
import { env } from "process";

import { keccak256 } from "ethereum-cryptography/keccak.js";

import { PHOSPHOR_ICONS } from "./phosphor-icons.mjs";

export const PROTOCOL = {
  pubsub: {
    prefix: "kiwi",
    topics: {
      roots: {
        id: "roots",
        version: "13.0.0",
      },
      messages: {
        id: "messages",
        version: "13.0.0",
      },
    },
  },
  protocols: {
    leaves: {
      id: "leaves",
      version: "16.0.0",
    },
    levels: {
      id: "levels",
      version: "16.0.0",
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

// A post to a community: an amplify that names the community it goes to. It
// keeps the type name "Message" but has a fifth field, so its type hash
// differs from the 4-field Message and a signature can't move between them.
export const EIP712_COMMUNITY_MESSAGE = {
  Message: [
    ...EIP712_MESSAGE.Message,
    { name: "community", type: "string" },
  ],
};

// A community, written by its owner (the identity that signs it). Signing a
// Community again under the same name updates it; see src/communities.mjs.
export const EIP712_COMMUNITY = {
  Community: [
    { name: "type", type: "string" },
    { name: "name", type: "string" },
    { name: "about", type: "string" },
    { name: "rules", type: "string[]" },
    { name: "icon", type: "string" },
    { name: "color", type: "string" },
    { name: "timestamp", type: "uint256" },
  ],
};

// The designer's community palette. Clients map each name to its light and
// dark shades.
export const COMMUNITY_COLORS = [
  "violet",
  "teal",
  "coral",
  "blue",
  "amber",
  "rose",
  "slate",
  "brown",
];

// Words of letters and digits, separated by single spaces or hyphens, so the
// name key (lowercase, spaces as hyphens) is unambiguous: "Agent Builders"
// has the key "agent-builders".
export const COMMUNITY_NAME_PATTERN = "^[A-Za-z0-9]+([ -][A-Za-z0-9]+)*$";
export const COMMUNITY_NAME_MAX_LENGTH = 24;
// A community's ID: "<owner address>/<name key>".
export const COMMUNITY_ID_PATTERN =
  "^0x[a-fA-F0-9]{40}/[a-z0-9]+(-[a-z0-9]+)*$";
// No control characters (line breaks included) in a community's texts.
const SINGLE_LINE = "^[^\\u0000-\\u001F\\u007F]*$";

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
      pattern: "^(https?://|data:text/plain,|kiwi:0x)",
      maxLength: 2048,
    },
    community: {
      $comment:
        "The community a post goes to, as '<owner address>/<name key>'. Without it, the post goes to Kiwi News. Signed with EIP712_COMMUNITY_MESSAGE.",
      type: "string",
      pattern: COMMUNITY_ID_PATTERN,
      maxLength: 42 + 1 + COMMUNITY_NAME_MAX_LENGTH,
    },
    signature: {
      type: "string",
      pattern: "0x[a-fA-F0-9]+",
    },
  },
  required: ["timestamp", "type", "title", "href", "signature"],
};

const community = {
  type: "object",
  additionalProperties: false,
  properties: {
    timestamp: {
      $comment: "unix timestamp",
      type: "integer",
    },
    type: {
      const: "community",
    },
    name: {
      type: "string",
      minLength: 1,
      maxLength: COMMUNITY_NAME_MAX_LENGTH,
      pattern: COMMUNITY_NAME_PATTERN,
    },
    about: {
      type: "string",
      maxLength: 100,
      pattern: SINGLE_LINE,
    },
    rules: {
      type: "array",
      maxItems: 5,
      items: {
        type: "string",
        minLength: 1,
        maxLength: 140,
        pattern: SINGLE_LINE,
      },
    },
    icon: {
      $comment: "A Phosphor Icons 2.1.1 name, see src/phosphor-icons.mjs",
      type: "string",
      enum: PHOSPHOR_ICONS,
    },
    color: {
      type: "string",
      enum: COMMUNITY_COLORS,
    },
    signature: {
      type: "string",
      pattern: "0x[a-fA-F0-9]+",
    },
  },
  required: [
    "timestamp",
    "type",
    "name",
    "about",
    "rules",
    "icon",
    "color",
    "signature",
  ],
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
        enum: ["amplify", "comment", "community"],
      },
    },
    required: ["from", "amount"],
  },
  message: {
    oneOf: [upvote, comment, community],
  },
};
