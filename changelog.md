# Changelog

## Methodology

- We are versioning according to [semver.org](https://semver.org)
- We are currently in the ["Initial development phase"](https://semver.org/#spec-item-4)

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
