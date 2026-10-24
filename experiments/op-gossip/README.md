# op-gossip (experiment)

Can a Kiwi node learn about new delegations (Delegator3 on OP mainnet) without
paying for an RPC? This listens to the OP Stack sequencer's block gossip, the
same p2p network op-node uses, and checks each block's logs bloom.

- **Blocks come from the p2p network.** The script finds op-node peers with
  discv5, subscribes to `/optimism/10/3/blocks` and accepts a block only if
  the sequencer signed it (`unsafeBlockSigner` 0xAAAA…c4A2, read from
  SystemConfig on L1).
- **The logs bloom says which blocks may hold a `Delegate` event.** A bloom
  never misses a log, including logs from internal calls (smart wallets,
  ERC-4337). It sometimes flags a block that has none: about 0.25% of blocks,
  so roughly 100 blocks a day.
- **Only flagged blocks are looked up over RPC,** with one `eth_getLogs` by
  block hash on the free public endpoint (`RPC`, default
  https://mainnet.optimism.io). Today's crawler instead asks for the head every
  5 s, about 17,000 calls a day.
- **Direct `etch` calls are also decoded from calldata,** so most delegations
  are known without any RPC at all.

## Run it on a server

The server needs Node 20+ and outbound TCP and UDP (any port). It doesn't
need any open inbound port.

```sh
git clone --depth 1 -b claude/op-gossip-experiment https://github.com/attestate/kiwistand op-gossip
cd op-gossip/experiments/op-gossip
npm ci
npm test
pm2 start listen.mjs --name op-gossip   # or: nohup node listen.mjs > run.log &
```

Every minute it prints a status line, with peers, mesh, blocks, gaps and
rpc counts. After a few minutes, `blocks` should grow by about 30 a minute.
Events go to `events.jsonl` (about 10 MB a day).

After a day or so:

```sh
node verify.mjs
```

It fetches every `Delegate` log in the covered block range over RPC and checks
that each sits in a block we received and flagged. It also reports missed
blocks, reorgs, gossip latency and RPC calls a day.

Settings (env): `RPC`, `UDP_PORT` (discv5, default 9200), `MAX_PEERS`
(default 30), `OUT`.

## Tests

`op.test.mjs` decodes real OP mainnet blocks that `fixture/main.go` encodes
and signs with the OP Stack's own Go code (op-service/eth SSZ, op-service/signer
V1 block signature), so the parsing matches what op-node publishes.

`node bloomrate.mjs 2000` measures the bloom's false alarms on recent blocks.

## Not covered yet

- **Downtime:** blocks gossiped while the node is offline are missed. A real
  integration would fill gaps with one `eth_getLogs` over the missed range, or
  with op-node's `payload_by_number` req/resp protocol.
- **Unsafe blocks:** these are sequencer-signed but not yet derived from L1;
  the current crawler reads the same unsafe head. A sequencer reorg is logged
  as `reorg`.
