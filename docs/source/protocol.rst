Protocol
========

This document describes the Kiwi News Protocol (short: "KNP").


Overview
--------

Kiwi News is built on an open, permissionless and decentralized peer to peer
protocol which facilitates:

- asynchronously verifiable distribution of all user-generated content using a `Patricia Merkle trie <https://ethereum.org/en/developers/docs/data-structures-and-encoding/patricia-merkle-trie/>`_.
- an NFT-based, sybil-resistant mechanism to let Ethereum addresses post and upvote content in the name of their ENS domain.

Decentralizing content using a PMT
__________________________________

KNP creates a total order over all user-generated messages. It sorts these messages into a Merkle Patricia trie. The trie's root is then gossiped to a p2p mesh network where two nodes with different root hashes start a synchronization process.

NFT-based sybil-resistance
__________________________

Kiwi News Protocol implements sybil-resistance by causing costs during a user's
sign-up. Technically, any user can send signed EIP-712 messages to a Kiwi node, however,
all messages are signed and a node will only consider messages valid where the message's signer is an Ethereum address who had previously minted the "Hyperkiwification" NFT at `eth:0xebb15487787cbf8ae2ffe1a6cca5a50e63003786 <https://etherscan.io/address/0xebb15487787cbf8ae2ffe1a6cca5a50e63003786>`_.

