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

A message is one of three objects, each with ``"additionalProperties": false``.
The schemas are ``upvote``, ``comment`` and ``community`` in
`src/constants.mjs <https://github.com/attestate/kiwistand/blob/main/src/constants.mjs>`_.

.. code-block:: javascript

  // amplify: a submission or an upvote
  {
    "timestamp": 1700000000,
    "type": "amplify",
    "title": "...",            // up to 80 characters
    "href": "https://...",     // https?://, data:text/plain, or kiwi:0x; up to 2048 characters
    "community": "0x.../ai",   // optional: posts to a community (protocol 13.0.0)
    "signature": "0x..."
  }

  // comment
  {
    "timestamp": 1700000000,
    "type": "comment",
    "title": "...",            // the comment, up to 10,000 characters
    "href": "kiwi:0x...",      // the story's index (72 hex characters)
    "signature": "0x..."
  }

  // community (protocol 13.0.0)
  {
    "timestamp": 1700000000,
    "type": "community",
    "name": "Agent Builders",  // up to 24 characters: words of letters and digits
    "about": "...",            // up to 100 characters, one line
    "rules": ["..."],          // up to 5, each 1 to 140 characters, one line
    "icon": "robot",           // a Phosphor Icons 2.1.1 name
    "color": "violet",         // violet, teal, coral, blue, amber, rose, slate or brown
    "signature": "0x..."
  }

See :ref:`communities` for what a community is and which EIP-712 type each
message is signed with.

API Versioning
--------------

As of the current version, all API endpoints are prefixed with `/api/v1`. This
is part of our move towards better API versioning.

Endpoints
---------

**GET /api/v1/delegations**

Retrieves an object of valid delegations in the form of ``to:from``, where
``from`` is the user's "identity" (the address messages are attributed to),
whereas ``to`` can be any delegated Ethereum address.

The rules of what we consider a valid delegation are documented in the
`delegator2 repository <https://github.com/attestate/delegator2>`_.

Please note that it may take some time for the indexer to pick up a new
delegation (usually around 1-2 minutes).

**POST /api/v1/list**

Lists messages with the given pagination parameters.

Request body:

- ``from`` (integer): The number of entries the request should be offset by. It
  is inclusive.
- ``amount`` (integer): The number of entries that the request should contain.
  Must be between 0 and HTTP_MESSAGES_MAX_PAGE_SIZE, as defined in the `.env
  file <https://github.com/attestate/kiwistand/blob/main/.env-copy>`_.
- ``type`` (enum: ``["amplify", "comment", "community"]``, defaults to:
  "amplify" if the parameter is omitted): The type of the message.

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
  * ``identity`` (string): The Ethereum address the message is attributed to:
    the signer itself, or the address that delegated to the signer.

.. note::

    The list endpoint returns messages slightly different then when you sent
    them to the network, as ``signer`` and ``identity`` represent the
    delegation mapping between custody key and temporary signing key.


**POST /api/v1/messages**

Adds a message to the Kiwistand P2P node.

Request body:

- ``timestamp`` (integer): Unix timestamp. Must be bigger than
  MIN_TIMESTAMP_SECS (1672527600), as defined in the `.env file <https://github.com/attestate/kiwistand/blob/main/.env-copy>`_.
- ``type`` (string): ``"amplify"``, ``"comment"`` or ``"community"``.
- The other fields of that type, see :ref:`message-schema`.
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
7. A comment's story must exist and be older than the comment.
8. An amplify with ``community`` must name a community the node has, in a
   version older than the post (see :ref:`communities`).
