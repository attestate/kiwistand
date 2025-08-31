# Changelog

## Methodology

- We are versioning according to [semver.org](https://semver.org)
- We are currently in the ["Initial development phase"](https://semver.org/#spec-item-4)

## 0.10.1

- Fix `npm run reconcile`

## 0.10.0

(breaking) To make Kiwi News compatible with smart wallets and EIP-4337, we've
made some breaking changes to the
[delegator2](https://github.com/attestate/delegator2/blob/main/sdk/changelog.md#060)
contract. 

Instead of relying on `transaction.from`, it now emits `msg.sender`
from within the contract, hence allowing paymasters etc. to call `etch` in the
name of the Kiwi Pass controlling address. 

This however means that we have, for the time being, added all other signers as
a plain text file to the code base, meaning that the old delegator2 contract at
0x08b7ECFac2c5754ABafb789c84F8fa37c9f088B0 will not count anymore when
delegating upvoting/commenting power to a new address. Instead all apps will
have to start using the new contract:
0x418910fef46896eb0bfe38f656e2f7df3eca7198. For a proper upgrade path where
signers can both be revoked and used from both delegator2 contracts we'll have
to combine their logs. It's not clear to me whether all of this work would be
worth it or whether it would be simpler to just call the delegator2@0.5.1
period its own epoch, add all its messages to a merkle tree and then just
consider them valid if they appear as a member. For this release, I did the
simplest possible thing because I felt as if this work wouldn't pay off to do
properly as we're still not really making money with Kiwi.

Anyways, as the above change will interact with what messages nodes are
considering valid, we've bumped the version to 0.10.0 and we've also
upgraded our version identifiers in libp2p. We highly recommend all node
operators to upgrade.

### How to upgrade your existing node?

1. Run `npm i` then run `cd src/web && npm i -f`
1. In your `DATA_DIR`, rename `list-delegations-load-2` (to back it up)
2. Run `npm run sync`. It will run very briefly (this is fine)
3. That's it, you should be good to go

## 0.9.0

1. (breaking) Add token tracking to allow to precisely determine during
  reconciliation if someone was eligible to post during a period. For more
  details of what this feature consists of, read the changelogs of the
  dependencies:
  - [@attestate/crawler-call-block-logs@0.5.0](https://github.com/attestate/crawler-call-block-logs/blob/main/changelog.md#050)
  - [@attestate/delegator2@0.5.0 and 0.5.1](https://github.com/attestate/delegator2/blob/main/sdk/changelog.md#051)

Essentially with this release we're laying the groundwork for our later 1 pass
= 1 upvote change. For more details, see [this
document](https://hackmd.io/@TimDaub/B1MAvNL1kl).

If you're running a node in version 0.9.0 it is required to re-sync the node
using `npm run sync`. For this, in your `DATA_DIR`, delete the
`op-call-block-logs` folder, then run `npm run sync` until you catch up again
with the OP mainnet chain tip. This is necessary as we have to load each chain
interactions respective `tokenId` into the mints database.

2. (breaking) For those who are running a kiwistand node in `npm run reconcile`
  mode, we've fixed a bug that could have allowed an upvote to be stored twice.
  If you've done this, please delete the `data.mdb` and `lock.mdb` file from
  your `DATA_DIR` and re-reconcile with the network from scratch.

3. We're including many other changes in this release, none of which are
   supposed to be breaking. Most changes are related to the product and the
   front end.

This release doesn't include any breaking changes to the protocol itself, which
is why we've also not bumped the protocol version identifiers. It, however,
contains the above breaking changes for anyone currently running a node, which
is why this release is a minor patch version increase.

## 0.8.0

- (breaking) Double it-length-prefixed length
- Fixes in reconciliation algorithm

**Caution:** If you're running a node and you must preserve its reconciliation
data, it is best get in touch with us directly via Telegram. If you can afford
to just delete the reconciliation data and start over, we suggest you do this.

## 0.7.0

- (breaking) Fixed a bug in the constraints metadata db. Details:
  https://github.com/attestate/kiwistand/commit/37ba938a811b39ec6e88887eaa278d393b72ff6b
  **Caution:** If you're running a node, read this carefully and potentially
  get in touch!
- Hardcode mainnet mints to preserve mainnet timestamps of minting
- Optimism mint crawler records timestamps of mints
- Mints can now be tracked separately
- Many frontend updates

## 0.6.0

- Upgrade all libp2p version identifiers
- Move all eligible-defining NFTs to `oeth:0x66747bdc903d17c586fa09ee5d6b54cc85bbea45`
- Deprecate `RPC_HTTP_HOST`
- Fix bugs with indexing logs. attestate/crawler `order` function was ordering
  logs based on blockIndex and transactionIndex, but logIndex was necessary
  too.
  - We've essentially created two new indexing strategies
    ("list-delegations-2", and "op-call-block-logs").
- store.posts now tolerates finding "in-eligible" messages
- Added docs that explain how Kiwi News Protocol's set reconciliation works
- Use a DFS to traverse the tree for posts (thank you to @freeatnet!)

## 0.5.0

- Deactivate revocations temporarily until we're properly implementing them in
  the set reconciliation algorithm. [Details](https://github.com/attestate/kiwistand/commit/71899f89d53809e9d17929c70d0935b08c3e21dc#diff-a769d9b90a5ba7d598420c1d02fc67325bd17e2d193747d5033fa52ee1e7d28eR15-R30).
- Upgrade all protocol major versions.

## 0.4.0

- Require new environment variable `OPTIMISM_RPC_HTTP_HOST`
- Website: Minor stylistic changes
- Protocol:
  - All semantic version identifiers have been upgraded as a major version to
    avoid name collisions with nodes running older versions of this software.
- API
  - POST /api/v1/list endpoint now adds two new properties to a message
    `identity` and `signer`.
  - POST /api/v1/messages now accepts messages signed from a delegate address.
- Docs
  - Document difference in ports between API and frontend

## 0.3.0

- Environment Variables
  - Rename `TIMESTAMP_TOLERANCE_SECS` to `MAX_TIMESTAMP_DELTA_SECS`
  - Separate `HTTP_PORT` (for website) and `API_PORT` (for node API)
  - Remove all `TODAYS_EDITOR_...` variables
- Add Sphinx docs
- Many changes to the frontend (won't list details)
- Separated website frontend from node API frontend. They now run on differnet
  ports.
- The allowlist registry now guarantees returning a set of unique Ethereum
  addresses.
- The level's remote comparisons are now validated at the receiving node with a
  JSON schema.
- For the frontend (mainly), ecrecover can now cache recovering signatures.
- Logging of errors in the reconciliation algorithm has been improved.
- The "leaves" function can now be called with a "startDatetime" parameter to
  speed up database queries.
- Database migration
  - This release contains an incompatible database migration from earlier
    releases! If you actually need to migrate from 0.2.0 to 0.3.0, contact
    @timdaub!
  - LMDB now uses "ordered-binary" key encoding to enable range based key
    queries.
  - Our message hashing and identity generation was broken and so messages
    weren't canonically hashed. This had to be addressed in a database
    migration and by fixing the canonicalization. Again, if you really must
    migrate your data, make sure to contact us beforehand!
  - We enabled "useNodePruning" in ethereumjs/trie (this gets rid of deleted
    nodes).
- Protocols
  - Upgrade "leaves" protocol to v3.0.0
  - Improve PMT traversal algorithm that had a bug when branching factor was
    too big (vendored in WalkController from ethereumjs/trie).
  - Improved atomic committments of data entry within set reconciliation. Made
    both metadb and trie transactional.

## 0.2.0

- We discovered a critical issue in the v0.1.0 code base that lead to digests
  of messages in the ordering algorithm to be non-canonical [1] (thanks
  @freeatnet).
- We're fixing this using npm:canonicalize that implements
  [RFC8785](https://datatracker.ietf.org/doc/html/rfc8785) for canonical JSON.
- Since we already had nodes in the network with existing data we shipped our
  first migration too. It checks for the digest algorithm, and applies a
  migration accordingly. **We strongly recommend doing a backup of the
  `DATA_DIR` before applying the v0.2.0 update.**
- To avoid synchronizations between v0.1.0 nodes and v0.2.0 nodes, we upgraded
  all protocol and pubsub identifiers and versions too to avoid corrupting data
  bases.

1: https://github.com/attestate/kiwistand/commit/debb66ab676053a82b9aab789f68049a5c9a4528

## 0.1.0

- Initial release of Kiwi News run until 2023-05-06
