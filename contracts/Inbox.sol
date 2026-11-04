// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.8.28;

// Kiwi News' inbox on Ethereum mainnet. Once an hour, the sequencer commits
// the IDs of the protocol's messages it witnessed here, with the messages in
// the transaction's blob for a few weeks; anyone can put messages here in
// calldata with include(). Both emit Commit, which is how nodes find them
// (eth_getLogs); the calldata is the record. Nodes check the commits
// themselves, so the contract stores only its owner (EIP-173) and the
// sequencer. See docs/src/pages/protocol.mdx and src/commits.mjs.
contract Inbox {
  address public owner;
  address public sequencer;

  // `sequencer` is true for commit(), false for include(). `root` is the
  // commit's root, 0 for include(); `n` the number of IDs or messages.
  event Commit(address sender, bool sequencer, bytes32 root, uint256 n);
  event OwnershipTransferred(
    address indexed previousOwner,
    address indexed newOwner
  );

  constructor(address _owner, address _sequencer) {
    owner = _owner;
    sequencer = _sequencer;
    emit OwnershipTransferred(address(0), _owner);
  }

  modifier onlyOwner() {
    require(msg.sender == owner, "Inbox: not the owner");
    _;
  }

  function transferOwnership(address newOwner) external onlyOwner {
    emit OwnershipTransferred(owner, newOwner);
    owner = newOwner;
  }

  // Rotates the sequencer's key without a new inbox.
  function setSequencer(address _sequencer) external onlyOwner {
    sequencer = _sequencer;
  }

  // ERC-165, for EIP-173's interface.
  function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
    return interfaceId == 0x7f5828d0 || interfaceId == 0x01ffc9a7;
  }

  // `root` is the trie root over every valid message listed so far, by all
  // commits and include()s up to this one, plus the genesis set; `ids` the
  // IDs of the messages the sequencer took since its last commit, in order.
  // The genesis, the sequencer's first commit, covers every message up to
  // its block and lists one ID: the delegations snapshot's hash.
  function commit(
    uint8 version,
    bytes32 root,
    bytes32[] calldata ids
  ) external {
    require(msg.sender == sequencer, "Inbox: not the sequencer");
    emit Commit(msg.sender, true, root, ids.length);
  }

  // Signed messages, encoded as the trie stores them.
  function include(bytes[] calldata messages) external {
    emit Commit(msg.sender, false, bytes32(0), messages.length);
  }
}
