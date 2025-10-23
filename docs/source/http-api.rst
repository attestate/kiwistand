HTTP API
========

This documentation outlines the HTTP API for the Kiwistand P2P node.

Overview
--------

The API provides methods for interacting with the Kiwistand P2P node, including
adding messages and listing messages.

Ports
-----

Kiwistand used to ship with running both the frontend and the node REST API on
the same port (``HTTP_PORT``). To more easily code-split the node code and
frontend code, we're now, however, running the node's REST API on ``API_PORT``.
For news.kiwistand.com it is at 8443.

JSON Schemas
------------

Pagination
..........

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

.. _message-schema:

Message
.......


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

API Versioning
--------------

As of the current version, all API endpoints are prefixed with `/api/v1`. This
is part of our move towards better API versioning.

Endpoints
---------

**GET /api/v1/delegations**

Retrieves an object of valid delegations in the form of ``to:from``, where
``from`` must be the user's "identity," meaning the wallet they minted the NFT
with, whereas ``to`` can be any delegated Ethereum address.

The rules of what we consider a valid delegation are documented in the
`delegator2 repository <https://github.com/attestate/delegator2>`_.

Please note that it may take some time for the indexer to pick up a new mint
(usually around 1-2 minutes).

**POST /api/v1/list**

Lists messages with the given pagination parameters.

Request body:

- ``from`` (integer): The number of entries the request should be offset by. It
  is inclusive.
- ``amount`` (integer): The number of entries that the request should contain.
  Must be between 0 and HTTP_MESSAGES_MAX_PAGE_SIZE, as defined in the `.env
  file <https://github.com/attestate/kiwistand/blob/main/.env-copy>`_.
- ``type`` (enum: ``["amplify", "comment"]``, defaults to: "amplify" if the
  parameter is omitted): The type of the message.

Response body

- ``status`` (string): The status of the request. Possible values are "success"
  or "error".
- ``code`` (integer): The HTTP status code.
- ``message`` (string): A brief description of the response.
- ``details`` (string): A more detailed description of the response.
- ``data`` (array): An array of objects, each representing a post. Each post
  object has the following properties:

  * ``href`` (string): The URL of the post.
  * ``signature`` (string): The signature of the post.
  * ``timestamp`` (integer): The timestamp of the post.
  * ``title`` (string): The title of the post.
  * ``type`` (string): The type of the post.
  * ``signer`` (string): The Ethereum address that signed the message. Can be a
    delegated address or the address that represents the user's identity.
  * ``identity`` (string): The Ethereum address of the identity (the wallet
    with which the user minted the NFT).

.. note::

    The list endpoint returns messages slightly different then when you sent
    them to the network, as ``signer`` and ``identity`` represent the
    delegation mapping between custody key and temporary signing key.


**POST /api/v1/messages**

Adds a message to the Kiwistand P2P node.

Request body:

- ``timestamp`` (integer): Unix timestamp. Must be bigger than
  MIN_TIMESTAMP_SECS (1672527600), as defined in the `.env file <https://github.com/attestate/kiwistand/blob/main/.env-copy>`_.
- ``type`` (string): Message type. Currently, only "amplify" is supported.
- ``title`` (string): Message title. Max length is 80 characters.
- ``href`` (string): Message link. Must be a valid URI with a max length of
  2048 characters.
- ``signature`` (string): Message signature. Must match the pattern
  "0x[a-fA-F0-9]+".

Acceptance Criteria for Messages
--------------------------------

1. Every message must comply with the message JSON schema.
2. The timestamp must be bigger than MIN_TIMESTAMP_SECS (1672527600), as
   defined in the `.env file <https://github.com/attestate/kiwistand/blob/main/.env-copy>`_.
3. The timestamp must be accurate according to the amount of seconds defined in
   HTTP_MESSAGES_MAX_PAGE_SIZE (50), as defined in the `.env file <https://github.com/attestate/kiwistand/blob/main/.env-copy>`_.
4. The message signer's address must be a valid Ethereum address.
5. When running ecrecover on the signature, it must reproduce a valid Ethereum
   address. EIP712 is used as the signing method
   (https://eips.ethereum.org/EIPS/eip-712).
6. For every link, a combination of address, link, and "amplify" type can only
   exist once. This means that every user can only upvote a link once.
