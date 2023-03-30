export const EIP712_DOMAIN = {
  name: "replica",
  version: "1",
  chainId: 6666,
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
  },
};
