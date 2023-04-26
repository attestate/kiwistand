// @format
import { env } from "process";

import { keccak256 } from "ethereum-cryptography/keccak.js";

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

export const EIP712_TYPES = {
  Message: [
    { name: "title", type: "string" },
    { name: "href", type: "string" },
    { name: "type", type: "string" },
    { name: "timestamp", type: "uint256" },
  ],
};

export const SCHEMATA = {
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
      timestamp: {
        $comment: "unix timestamp",
        type: "integer",
      },
      type: {
        type: "string",
        enum: ["amplify"],
      },
      title: {
        type: "string",
        minLength: 1,
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
