// The order on a local Ethereum chain (anvil, from Foundry): node A, the
// sequencer, commits; B catches up from A with set reconciliation and
// verifies; C and D catch up from A after A tampered with a committed
// message and must name the commit. Each node is its own process with its
// own DATA_DIR and CACHE_DIR (test/fixtures/commits-node.mjs).
import { spawn, spawnSync, fork } from "child_process";
import { rm, mkdtemp } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

import test from "ava";
import { Wallet } from "ethers";
import { createWalletClient, createPublicClient, http, keccak256 } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";

import { sign, toDigest } from "../src/id.mjs";
import * as delegations from "../src/delegations.mjs";
import { EIP712_MESSAGE, EIP712_DELEGATION } from "../src/constants.mjs";
import inbox from "../contracts/Inbox.json" with { type: "json" };

// anvil's first account
const SEQUENCER_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const PORT = 8545 + Math.floor(Math.random() * 1000);
const RPC = `http://127.0.0.1:${PORT}`;
const SNAPSHOT = keccak256(Buffer.from("test snapshot"));

const hasAnvil = !spawnSync("anvil", ["--version"]).error;
if (!hasAnvil) {
  console.log(
    "Skipping the commits integration test: anvil isn't installed (Foundry, https://getfoundry.sh)",
  );
}

async function start(dir, env = {}) {
  const child = fork("test/fixtures/commits-node.mjs", [], {
    env: {
      ...process.env,
      DATA_DIR: join(dir, "data"),
      CACHE_DIR: join(dir, "cache"),
      ETHEREUM_RPC_URL: RPC,
      TEST_SNAPSHOT_HASH: SNAPSHOT,
      DEBUG: "",
      ...env,
    },
    execArgv: ["--no-warnings"],
    stdio: ["ignore", "ignore", "inherit", "ipc"],
  });
  const pending = new Map();
  let id = 0;
  await new Promise((resolve) => child.once("message", resolve));
  child.on("message", ({ id, result, error }) => {
    const { resolve, reject } = pending.get(id);
    pending.delete(id);
    error ? reject(new Error(error)) : resolve(result);
  });
  const call = (command, ...args) =>
    new Promise((resolve, reject) => {
      pending.set(++id, { resolve, reject });
      child.send({ id, command, args });
    });
  return { call, stop: () => child.kill() };
}

const story = (signer, href, timestamp) =>
  sign(
    signer,
    { title: href, href, type: "amplify", timestamp },
    EIP712_MESSAGE,
  );

(hasAnvil ? test.serial : test.skip)(
  "commits on Ethereum: a node verifies the order, and a tampered one is caught",
  async (t) => {
    // NOTE: kzg-wasm takes about 20 seconds to load for the blob.
    t.timeout(180_000);
    const anvil = spawn("anvil", ["--port", `${PORT}`, "--silent"]);
    const dir = await mkdtemp(join(tmpdir(), "kiwi-commits-"));
    const nodes = [];
    t.teardown(async () => {
      nodes.forEach((node) => node.stop());
      anvil.kill();
      await rm(dir, { recursive: true, force: true });
    });
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // 1. Deploy the inbox.
    const account = privateKeyToAccount(SEQUENCER_KEY);
    const transport = http(RPC);
    const wallet = createWalletClient({ account, chain: foundry, transport });
    const client = createPublicClient({ chain: foundry, transport });
    const hash = await wallet.deployContract({
      abi: inbox.abi,
      bytecode: inbox.bytecode,
      args: [account.address],
    });
    const { contractAddress } = await client.waitForTransactionReceipt({
      hash,
    });
    const env = {
      INBOX_ADDRESS: contractAddress,
      SEQUENCER_ADDRESS: account.address,
      INBOX_BLOCK: "0",
    };

    // 2. Node A, the sequencer: two stories, the genesis, then a delegation,
    // a story by the signer, its revocation and one more story by the
    // signer.
    const a = await start(join(dir, "a"), {
      ...env,
      SEQUENCER_PRIVATE_KEY: SEQUENCER_KEY,
    });
    nodes.push(a);
    const alice = Wallet.createRandom();
    const signer = Wallet.createRandom();
    const now = Math.floor(Date.now() / 1000);
    const genesis = [
      await story(alice, "https://alice.example", now - 100),
      await story(Wallet.createRandom(), "https://bob.example", now - 90),
    ];
    t.deepEqual(await a.call("add", genesis), []);
    const zero = await a.call("commit");
    t.deepEqual(zero.status.verified, [0, 0]);
    const time = zero.status.latest.time;

    const delegation = (authorize, timestamp) =>
      delegations.authorization(signer, alice.address).then((authorization) =>
        sign(
          alice,
          delegations.create({
            identity: alice.address,
            signer: signer.address,
            authorization,
            authorize,
            timestamp,
          }),
          EIP712_DELEGATION,
        ),
      );
    const before = await story(signer, "https://before.example", time + 2);
    // NOTE: Signed before the revocation, but the sequencer takes it after:
    // the order decides, not the timestamp.
    const after = await story(signer, "https://after.example", time + 3);
    const batch = [
      await delegation(true, time + 1),
      before,
      await delegation(false, time + 4),
      after,
    ];
    t.deepEqual(await a.call("add", batch), []);
    const one = await a.call("commit");
    t.deepEqual(one.status.verified, [0, 1]);
    const calldata = await a.call("calldata", one.hash);
    t.is(calldata.k, 1);
    t.is(calldata.prev.length, 66);
    t.deepEqual(
      calldata.ids,
      batch.map((message) => `0x${toDigest(message).digest}`),
    );
    t.log("commit 1:", JSON.stringify(calldata, null, 2));

    // 3. B starts empty, catches up from A and verifies against the chain.
    const b = await start(join(dir, "b"), env);
    nodes.push(b);
    await a.call("push", await b.call("addr"));
    const verified = await b.call("refresh");
    t.deepEqual(verified.verified, [0, 1]);
    t.is(verified.failed, null);
    t.log("B:", JSON.stringify(verified));

    // 5. The signer's story before the revocation counts for Alice, the one
    // after it for the signer.
    t.deepEqual(await b.call("credited", signer.address), [
      "https://after.example",
    ]);
    t.true(
      (await b.call("credited", alice.address)).includes(
        "https://before.example",
      ),
    );

    // 4. A swaps a committed message for another validly signed one: C
    // misses it in commit 1. With a genesis message gone, D's root of
    // commit 0 differs.
    const fake = await story(signer, "https://fake.example", time + 2);
    await a.call("swap", toDigest(before).index, fake);
    const c = await start(join(dir, "c"), env);
    nodes.push(c);
    await a.call("push", await c.call("addr"));
    const missing = await c.call("refresh");
    t.is(missing.failed.k, 1);
    t.is(missing.failed.status, "missing");
    t.true(missing.failed.reason.includes(toDigest(before).digest));
    t.log("C:", JSON.stringify(missing));

    await a.call("swap", toDigest(genesis[1]).index, fake);
    const d = await start(join(dir, "d"), env);
    nodes.push(d);
    await a.call("push", await d.call("addr"));
    const mismatch = await d.call("refresh");
    t.is(mismatch.failed.k, 0);
    t.is(mismatch.failed.status, "mismatch");
    t.log("D:", JSON.stringify(mismatch));
  },
);
