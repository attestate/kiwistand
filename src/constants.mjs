export const EIP712_DOMAIN = {
  name: "replica",
  version: "1",
  chainId: 6666,
};

export const EIP712_TYPES = {
  Message: [
    { name: "text", type: "string" },
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
      text: {
        type: "string",
        maxLength: 5000,
      },
      signature: {
        type: "string",
        pattern: "0x[a-fA-F0-9]+",
      },
    },
  },
};
