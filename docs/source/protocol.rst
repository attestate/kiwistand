Protocol
========

This document specifies the Kiwi News Protocol.

.. note::

   This document is a work-in-progress. For now, the canonical protocol description is the implementation of the attestate/kiwistand client.

Message ID generation
---------------------

What is a Message
.................

- A message is every JSON object that complies with the :ref:`Message JSON schema <message-schema>`.
- Every message must be signed by an address that has minted the NFT or has been delegated posting power by an NFT minter address.
- A message must have a UNIX ``timestamp`` greater or equal than 1672527600 (2022-12-31T23:00:00+00:00).
- A message must have a UNIX ``timestamp`` lesser than 60 seconds into the future.


Process
.......

1. "Canonicalize" the Message by expressing the object the format of `RFC 8785 JSON Canonicalization Scheme (JCS) <https://datatracker.ietf.org/doc/html/rfc8785>`_.
2. Encode the message to CBOR (using `cbor-x <https://github.com/kriszyp/cbor-x>`_).
3. Hash the message using keccak-256 and express it as hexa-decimal number (without a "0x" prefix.
4. Prefix the message hash with a hexa-decimal UNIX timestamp

Considerations
..............

- The identifier must be of fixed length.
- The identifier must be lexographically orderable as to order all messages ascendingly from "left to right" when inserting them in the Merkle Patricia Trie.


Rationale
.........

- We use "canonicalize" and "cbor-x" because of subsequent historical decisions and because they both refer to complex but canonical RFCs that we hope are good enough to allow someone to re-implment the Kiwi News Protocol in another programming language.
- We use "canonicalize" because "cbor-x" isn't canonicalizing a JSON object by itself.
- We use keccak-256 to be compatible with the Ethereum ecosystem.
- We prefix the message hash with a hexa-decimal UNIX timestamp to create a lexographic total order.
- We're not left-padding the UNIX timestamp as it will only require an additional digit on November 20, 2286.

Reference Implementation
........................

- `@attestate/kiwistand/src/id.mjs:toDigest <https://github.com/attestate/kiwistand/blob/90f3de80dafdfa8dc82dd0cddebbda821b5adf01/src/id.mjs#L57>`_.
