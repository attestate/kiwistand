# Changelog

## Methodology

- We are versioning according to [semver.org](https://semver.org)
- We are currently in the ["Initial development phase"](https://semver.org/#spec-item-4)

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
