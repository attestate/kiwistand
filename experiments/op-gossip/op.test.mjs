// @format
// Fixtures: real OP mainnet blocks encoded and signed by the OP Stack's own
// Go code (../fixture/main.go), signed with a throwaway key.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";

import { hexToBytes } from "viem";

import * as op from "./op.mjs";

const fixtures = JSON.parse(readFileSync("fixtures.json", "utf8"));
const [withDelegation, without] = fixtures;

async function read(fixture) {
  const data = op.uncompress(hexToBytes(`0x${fixture.gossip}`));
  const signature = data.subarray(0, 65);
  const payload = data.subarray(65);
  return {
    signer: await op.signer(signature, payload),
    hash: op.signingHash(payload),
    block: op.decodePayload(fixture.version, payload),
  };
}

test("decodes the SSZ envelope like op-node", async () => {
  for (const fixture of fixtures) {
    const { block } = await read(fixture);
    assert.equal(block.number, fixture.number);
    assert.equal(block.hash, fixture.hash.toLowerCase());
    assert.equal(block.txs.length, fixture.txs);
  }
});

test("recovers the block signer like op-node", async () => {
  for (const fixture of fixtures) {
    const { signer, hash } = await read(fixture);
    assert.equal(hash, fixture.signingHash.toLowerCase());
    assert.equal(signer, fixture.signer.toLowerCase());
  }
});

test("the logs bloom flags the block with a delegation only", async () => {
  assert.equal(op.mayHoldDelegation((await read(withDelegation)).block.logsBloom), true);
  assert.equal(op.mayHoldDelegation((await read(without)).block.logsBloom), false);
});

test("decodes the direct etch call from calldata", async () => {
  const calls = await op.directCalls((await read(withDelegation)).block.txs);
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].hash,
    "0xa089e8833aedb5ba627895a5452fbafb845e13ee614593c51ae8623b14d32de3",
  );
  assert.equal(calls[0].data.length, 3);
  assert.equal((await op.directCalls((await read(without)).block.txs)).length, 0);
});

test("a tampered payload doesn't verify", async () => {
  const data = op.uncompress(hexToBytes(`0x${withDelegation.gossip}`));
  data[65 + 100] ^= 1;
  const signer = await op.signer(data.subarray(0, 65), data.subarray(65));
  assert.notEqual(signer, withDelegation.signer.toLowerCase());
});

test("message ids are 20 bytes and depend on the topic", () => {
  const data = hexToBytes(`0x${withDelegation.gossip}`);
  const a = op.msgId("/optimism/10/3/blocks", data);
  const b = op.msgId("/optimism/10/2/blocks", data);
  assert.equal(a.length, 20);
  assert.notDeepEqual(a, b);
});
