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
- Every message must carry a valid EIP-712 signature. Any address can sign for itself; a message signed by a delegated key is attributed to the address that delegated to it. (Before 0.12.0, the signer also had to hold the Kiwi Pass NFT.)
- A message must have a UNIX ``timestamp`` greater or equal than 1672527600 (2022-12-31T23:00:00+00:00).
- A message must have a UNIX ``timestamp`` lesser than 60 seconds into the future.


Message types
.............

Messages are signed with EIP-712 in the domain ``{name: "kiwinews", version: "1.0.0", salt: keccak256("kiwinews domain separator salt")}``. There are four kinds:

- **amplify**: a submission or an upvote. The first amplify of a link is its submission; later ones are upvotes. Signed as ``Message(string title,string href,string type,uint256 timestamp)``.
- **amplify with** ``community`` (since protocol 13.0.0): a submission to a community, see :ref:`communities`. Signed as ``Message(string title,string href,string type,uint256 timestamp,string community)``. The fifth field gives it its own type hash, so a signature can't move between the two.
- **comment**: ``href`` is ``kiwi:0x<index of the story>``. Signed as the 4-field ``Message``.
- **community** (since protocol 13.0.0): a user community, written by its owner, see :ref:`communities`. Signed as ``Community(string type,string name,string about,string[] rules,string icon,string color,uint256 timestamp)``.

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

- We use "canonicalize" and "cbor-x" because of subsequent historical decisions and because they both refer to complex but canonical RFCs that we hope are good enough to allow someone to re-implement the Kiwi News Protocol in another programming language.
- We use "canonicalize" because "cbor-x" isn't canonicalizing a JSON object by itself.
- We use keccak-256 to be compatible with the Ethereum ecosystem.
- We prefix the message hash with a hexa-decimal UNIX timestamp to create a lexographic total order.
- We're not left-padding the UNIX timestamp as it will only require an additional digit on November 20, 2286.

Reference Implementation
........................

- `@attestate/kiwistand/src/id.mjs:toDigest <https://github.com/attestate/kiwistand/blob/90f3de80dafdfa8dc82dd0cddebbda821b5adf01/src/id.mjs#L57>`_.


.. _communities:

Communities
-----------

Since protocol 13.0.0, anyone can run a community. A community belongs to the identity that signs its ``Community`` message (the signer, or the account that delegated to the signer) and lives in that identity's namespace, so two people can both run a community called "AI". Creating one needs no consensus: nobody but the owner can write to an owner's namespace.

Fields
......

- ``type``: ``"community"``.
- ``name``: 1 to 24 characters, words of letters and digits separated by single spaces or hyphens.
- ``about``: up to 100 characters on one line.
- ``rules``: up to 5 house rules of 1 to 140 characters, each on one line.
- ``icon``: a `Phosphor Icons <https://phosphoricons.com>`_ 2.1.1 name, as listed in ``src/phosphor-icons.mjs``. Clients draw the icon from their own copy of the set.
- ``color``: any hex colour, ``#RRGGBB``. The protocol has no opinion on it: clients may offer a palette and decide how to show other colours, e.g. in dark mode.
- ``timestamp``: as for every message.

Adding icons is a protocol change, as nodes with the older list reject the new names.

IDs and updates
...............

- A name's key is the name in lowercase with spaces as hyphens: "Agent Builders" has the key ``agent-builders``.
- A community's ID is ``<owner address>/<name key>``, e.g. ``0x0f6a79a579658e401e0b81c6dde1f2cd51d97176/agent-builders``.
- Signing a ``Community`` under a name key you already use updates that community. Every version stays in the trie. Readers show the newest one: the greatest timestamp, and of equal timestamps the greatest message ID.
- There's no deleting or transferring a community, and no membership or moderation on the protocol. Whoever loses the owning account can't change the community anymore.

Posting to a community
......................

- A post to a community is an amplify with ``community`` set to the community's ID. The address part may be in any case.
- A node accepts it only if it has a version of that community older than the post, as a comment's story must be older than the comment. Otherwise the node drops it. When the community arrives later, set reconciliation offers the post again.
- If the link already is a story, the post counts as an upvote of that story, wherever the story lives.
- Upvotes and comments don't name a community. A story stays in the community of its first submission.

Reference implementation
........................

- ``src/communities.mjs``, ``src/constants.mjs`` (``EIP712_COMMUNITY``, ``EIP712_COMMUNITY_MESSAGE``, the ``community`` schema) and ``src/store.mjs`` (``_add``).
