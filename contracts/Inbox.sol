// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.8.28;

// Kiwi News' inbox on Ethereum mainnet. Once a day, the sequencer commits the
// order of the protocol's messages here: the calldata is the record, the
// event is how nodes find it (eth_getLogs), and the transaction's blob
// carries the messages themselves for a few weeks. Nodes check a commit's
// chain and root themselves, so the contract stores nothing. See
// docs/src/pages/protocol.mdx and src/commits.mjs.
contract Inbox {
  address public immutable sequencer;

  event Commit(uint256 k, bytes32 root, uint256 n);

  constructor(address _sequencer) {
    sequencer = _sequencer;
  }

  // Commit k: `prev` is the hash of commit k-1's calldata (for commit 0, the
  // hash of the delegations snapshot), `root` the trie root over every
  // message committed through k, and `ids` the IDs of the n messages since
  // commit k-1, in the order the sequencer took them. Commit 0 lists no IDs:
  // it is every message up to its block.
  function commit(
    uint8 version,
    uint256 k,
    bytes32 prev,
    bytes32 root,
    uint256 n,
    bytes32[] calldata ids
  ) external {
    require(msg.sender == sequencer, "Inbox: not the sequencer");
    emit Commit(k, root, n);
  }
}
