HTTP API
===========================

This documentation outlines the HTTP API for the Kiwistand P2P node.

Overview
--------

The API provides methods for interacting with the Kiwistand P2P node, including
adding messages and listing messages.

JSON Schemas
------------

**Pagination**

.. code-block:: javascript

  {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "from": {
        "type": "integer",
        "minimum": 0
      },
      "amount": {
        "type": "integer",
        "minimum": 0,
        "maximum": HTTP_MESSAGES_MAX_PAGE_SIZE
      }
    },
    "required": ["from", "amount"]
  }

**Message**

.. code-block:: javascript

  {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "timestamp": {
        "type": "integer"
      },
      "type": {
        "type": "string",
        "enum": ["amplify"]
      },
      "title": {
        "type": "string",
        "maxLength": 80
      },
      "href": {
        "type": "string",
        "format": "uri",
        "pattern": "^https?://",
        "maxLength": 2048
      },
      "signature": {
        "type": "string",
        "pattern": "0x[a-fA-F0-9]+"
      }
    },
    "required": ["timestamp", "type", "title", "href", "signature"]
  }

Endpoints
---------

**POST /list**

Lists messages with the given pagination parameters.

Request body:

- ``from`` (integer): The number of entries the request should be offset by. It
  is inclusive.
- ``amount`` (integer): The number of entries that the request should contain.
  Must be between 0 and HTTP_MESSAGES_MAX_PAGE_SIZE.

**POST /messages**

Adds a message to the Kiwistand P2P node.

Request body:

- ``timestamp`` (integer): Unix timestamp. Must be bigger than
  MIN_TIMESTAMP_SECS (1672527600).
- ``type`` (string): Message type. Currently, only "amplify" is supported.
- ``title`` (string): Message title. Max length is 80 characters.
- ``href`` (string): Message link. Must be a valid URI with a max length of
  2048 characters.
- ``signature`` (string): Message signature. Must match the pattern
  "0x[a-fA-F0-9]+".

Constraints for store.add
-------------------------

1. Every message must comply with the message JSON schema.
2. The timestamp must be bigger than MIN_TIMESTAMP_SECS (1672527600).
3. The timestamp must be accurate according to the amount of seconds defined in
   HTTP_MESSAGES_MAX_PAGE_SIZE (50).
4. The sender's address must be in the allowlist, which consists of all NFT
   minters of the contract on Ethereum mainnet at address
   0xebb15487787cbf8ae2ffe1a6cca5a50e63003786. Refer to Etherscan or the
   "collect" page on zora.co for more information.
5. When running ecrecover on the signature, it must reproduce an address on the
   allowlist. EIP712 is used as the signing method
   (https://eips.ethereum.org/EIPS/eip-712).
6. For every link, a combination of address, link, and "amplify" type can only
   exist once. This means that every user can only upvote a link once.
