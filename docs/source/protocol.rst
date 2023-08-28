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

Introducing Set Reconciliation
------------------------------

In a peer to peer network, libraries like ChainSafe's `js-libp2p-gossipsub <https://github.com/ChainSafe/js-libp2p-gossipsub>`_ make it trivial to create a mesh network of nodes and share messages in a publish and subscribe pattern. 

So, assuming all nodes have perfect internet connections, using such library we could effortlessly create a peer to peer network where all nodes stay "`live <https://en.wikipedia.org/wiki/Safety_and_liveness_properties>`_" by subscribing to a topic and by adding all messages in order to their database.

And in this "perfect internet connection" scenario, where every node has a perfectly-ordered stream of incoming messages, we would hence assume that all nodes are always reaching the same state.

However, the reality is far from this with nodes regularly losing internet connections, crashing due to bugs and so on. Hence, while we can leverage the above-mentioned gossip subscription mechanism to keep nodes synchronized - when something goes wrong, we want to fall back on a strategy that allows offline nodes to catch up.

Because consider this: If one of our nodes goes offline for just five minutes, then comes back online, it means that it'll never manage to catch up to the network again, as network nodes generally don't re-send old messages.

For that reason, crypto currencies, for example, all implement a widely-used mechanism to synchronize nodes back to the current state when having been offline. We refer to this algorithm as "set reconciliation" and Kiwi News Protocol specifically implements it using a Merkle Patricia Trie.

However, for the sake of explaining the algorithm, we'll now first demonstrate it using a small set and a bitmap to keep track of entities. In a following section, we'll then explain set reconciliation using Merkle trees.

A Naive Set Reconciliation algorithm
____________________________________

First, consider that there is a fixed-length set of messages and a hash function
that we're using to determine the identity of each message (:ref:`set-recon-hash`), where, for example:

- ``hash("A") == 0x0``
- ``hash("B") == 0x1``
- ...

and so on.

.. figure:: _static/set-recon-hash.svg
   :name: set-recon-hash

   Figure 1

Hence, a set consists of messages "A", "B", ... "F" and their hexa-decimal identities ``0x0``, ``0x1``, ... ``0x5``. For the sake of demonstration, we assume that there cannot be any other identities or messages.

Which now makes this a great place to introduce the idea of the set reconciliation algorithm, which is quite literally the attempt of "reconciling" the distributed members of a set. 

In our scenario (:ref:`set-recon-schema`), we have two nodes ("Node A," and "Node B") which each store the incomplete set of messages with our task being to now "reconcile" these members such that each node contains all messages "A" to "F".

.. figure:: _static/set-recon-schema.svg
   :name: set-recon-schema

   Figure 2

In :ref:`set-recon-schema`, we also see the idea of mapping all messages' identities flags in a bitmap. This bitmap works by setting a flag at the respective location in the bitmap such as to indicate a message's existence in the node's database (:ref:`set-recon-bitmap`). 

.. figure:: _static/set-recon-bitmap.svg
   :name: set-recon-bitmap

   Figure 3

Step-by-step walk-through
.........................

Hence, with these primitives in place, we'll now do a step-by-step walk-through the
algorithm, our goal being, to bring both nodes back into synchronization.

In step 1, as outlined already in :ref:`set-recon-schema`:

- "Node A" stores messages "A", "B", "C" and "D", whereas
- "Node B" stores messages "E" and "F".

.. figure:: _static/set-recon-algo.svg
   :name: set-recon-algo

   Figure 4


Steps: 

1. The algorithm starts with one node kicking of the process in step 1 (:ref:`set-recon-algo`) by "Node A" sending over their initial bitmap to "Node B." "Node B" then compares the received bitmap with its own local bitmap and finds that messages "E" and "F" are missing from "Node A"'s database.
2. In step 2, "Node B" therefore sends "E" and "F" to "Node A."
3. And "Node B" then also sends its own Bitmap in step 3 to "Node A," where it essentially does the same comparison to find that messages "A", "B", "C" and "D" are missing from "Node B".
4. So "Node A" now sends the missing messages to "Node B".
5. The process is then likely repeated, but but "Node A" and "Node B" will find that their bitmaps match, and so no further synchronization of messages is deemed necessary.

Now, considering this algorithm's simplicity, it naturally comes with rather significant drawbacks. And going through them in the following paragraphs will help us understand why using bitmaps to synchronize nodes over networks isn't a great idea.

Drawbacks of bitmaps
....................

- Modern hash functions like keccak-256 produce an output between 0 and 2^256 - 1 which would make a bitmap of their size incredbily huge and impractical to share between nodes over a network. In fact, it would be significantly more bandwidth efficient to re-download each node's entire database on each re-synchronization.
- Even for more storage-efficient implementations of bitmaps, for example, bloom filters, their complexity for a large number of messages will grow linearly as for each synchronization a node has to hash and compare their local bloom filter (and hence all its messages) with that of the foreign node's.

Using Merkle Trees for Set Reconciliation
_________________________________________

.. mermaid::

   graph TD
      A_0[A<sub>0</sub><br>0xabc] --> A_1,1[A<sub>1,1</sub><br>0xdef]
      A_0 --> A_1,2[A<sub>1,2</sub><br>0xghi]
      A_1,1 --> A_2,1[A<sub>2,1</sub><br>0xjkl]
      A_1,1 --> A_2,2[A<sub>2,2</sub><br>0xlmn]
      A_1,2 --> A_2,3[A<sub>2,3</sub><br>0xopq]
      A_1,2 --> A_2,4[A<sub>2,4</sub><br>0x123]
      A_2,1 --> A_3,1[A<sub>3,1</sub><br>0x456]
      A_2,1 --> A_3,2[A<sub>3,2</sub><br>0x789]
      A_2,2 --> A_3,3[A<sub>3,3</sub><br>0x890]
      A_2,2 --> A_3,4[A<sub>3,4</sub><br>0x901]
      A_2,3 --> A_3,5[A<sub>3,5</sub><br>0x012]
      A_2,3 --> A_3,6[A<sub>3,6</sub><br>0x234]
      A_2,4 --> A_3,7[A<sub>3,7</sub><br>0x567]
      A_2,4 --> A_3,8[A<sub>3,8</sub><br>0x890]
