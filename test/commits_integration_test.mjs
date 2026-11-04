// The commits on a local Ethereum chain (anvil, from Foundry): node A, the
// sequencer, commits; B catches up from A with set reconciliation, reads
// include()s, verifies, and credits by timestamp; C
// and D catch up from A after A tampered with a committed message and must
// name the commit. Each node is its own process with its own DATA_DIR and
// CACHE_DIR (test/fixtures/commits-node.mjs).
import { spawn, spawnSync, fork } from "child_process";
import { rm, mkdtemp } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

import test from "ava";
import { Wallet } from "ethers";
import {
  createWalletClient,
  createPublicClient,
  http,
  keccak256,
  zeroHash,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";

import { sign, toDigest } from "../src/id.mjs";
import * as delegations from "../src/delegations.mjs";
import { EIP712_MESSAGE, EIP712_DELEGATION } from "../src/constants.mjs";
import inbox from "../contracts/Inbox.json" with { type: "json" };

// anvil's first three accounts
const SEQUENCER_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const OWNER_KEY =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const ANYONE_KEY =
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";
const SNAPSHOT = keccak256(Buffer.from("test snapshot"));

const hasAnvil = !spawnSync("anvil", ["--version"]).error;
if (!hasAnvil) {
  console.log(
    "Skipping the commits integration tests: anvil isn't installed (Foundry, https://getfoundry.sh)",
  );
}

// A fresh anvil and the inbox on it, owned by OWNER_KEY's account with
// SEQUENCER_KEY's as the sequencer.
async function chain(t) {
  const port = 8545 + Math.floor(Math.random() * 1000);
  const rpc = `http://127.0.0.1:${port}`;
  const anvil = spawn("anvil", ["--port", `${port}`, "--silent"]);
  t.teardown(() => anvil.kill());
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const transport = http(rpc);
  const client = createPublicClient({ chain: foundry, transport });
  const wallet = (key) =>
    createWalletClient({
      account: privateKeyToAccount(key),
      chain: foundry,
      transport,
    });
  const sequencer = wallet(SEQUENCER_KEY);
  const owner = wallet(OWNER_KEY);
  const hash = await sequencer.deployContract({
    abi: inbox.abi,
    bytecode: inbox.bytecode,
    args: [owner.account.address, sequencer.account.address],
  });
  const { contractAddress: address } = await client.waitForTransactionReceipt({
    hash,
  });
  // Sends a transaction to the inbox and waits for it.
  const call = async (from, functionName, args) => {
    const hash = await wallet(from).writeContract({
      address,
      abi: inbox.abi,
      functionName,
      args,
    });
    const receipt = await client.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error(`${functionName} failed`);
    return receipt;
  };
  return { rpc, client, address, call, sequencer, owner };
}

async function start(dir, env = {}) {
  const child = fork("test/fixtures/commits-node.mjs", [], {
    env: {
      ...process.env,
      DATA_DIR: join(dir, "data"),
      CACHE_DIR: join(dir, "cache"),
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
const now = () => Math.floor(Date.now() / 1000);
const id = (message) => `0x${toDigest(message).digest}`;

(hasAnvil ? test.serial : test.skip)(
  "commits on Ethereum: nodes verify them, take include()s and report tampering",
  async (t) => {
    // NOTE: kzg-wasm takes about 20 seconds to load for the blob.
    t.timeout(300_000);
    const { rpc, address, call } = await chain(t);
    const dir = await mkdtemp(join(tmpdir(), "kiwi-commits-"));
    const nodes = [];
    t.teardown(async () => {
      nodes.forEach((node) => node.stop());
      await rm(dir, { recursive: true, force: true });
    });
    const env = {
      ETHEREUM_RPC_URL: rpc,
      INBOX_ADDRESS: address,
      INBOX_BLOCK: "0",
    };
    const include = (...messages) =>
      call(ANYONE_KEY, "include", [
        messages.map(
          (message) =>
            `0x${Buffer.from(toDigest(message).canonical).toString("hex")}`,
        ),
      ]);

    // 1. Node A, the sequencer: two stories and the genesis.
    const a = await start(join(dir, "a"), {
      ...env,
      SEQUENCER_PRIVATE_KEY: SEQUENCER_KEY,
    });
    nodes.push(a);
    const alice = Wallet.createRandom();
    const bob = Wallet.createRandom();
    const carol = Wallet.createRandom();
    const signer = Wallet.createRandom();
    const genesis = [
      await story(alice, "https://alice.example", now() - 100),
      await story(bob, "https://bob.example", now() - 90),
    ];
    t.deepEqual(await a.call("add", genesis), []);
    const zero = await a.call("commit");
    t.deepEqual(zero.status.verified, [0, 0]);
    t.deepEqual((await a.call("calldata", zero.hash)).ids, [SNAPSHOT]);
    const time = zero.status.latest.time;

    // 2. Alice delegates to a signer and revokes it. The sequencer takes the
    // signer's story dated before the revocation after it: timestamps
    // decide, not the order.
    const delegation = (identity, key, authorize, timestamp) =>
      delegations.authorization(key, identity.address).then((authorization) =>
        sign(
          identity,
          delegations.create({
            identity: identity.address,
            signer: key.address,
            authorization,
            authorize,
            timestamp,
          }),
          EIP712_DELEGATION,
        ),
      );
    const before = await story(signer, "https://before.example", time + 2);
    const after = await story(signer, "https://after.example", time + 5);
    const batch = [
      await delegation(alice, signer, true, time + 1),
      await delegation(alice, signer, false, time + 4),
      before,
      after,
    ];
    t.deepEqual(await a.call("add", batch), []);
    const one = await a.call("commit");
    t.deepEqual(one.status.verified, [0, 1]);
    const calldata = await a.call("calldata", one.hash);
    t.is(calldata.version, 1);
    t.deepEqual(calldata.ids, batch.map(id));
    t.log("commit 1:", JSON.stringify(calldata, null, 2));

    // 3. B starts empty, catches up from A and verifies. The signer's story
    // dated before the revocation counts for Alice, the one after it for
    // the signer.
    const b = await start(join(dir, "b"), env);
    nodes.push(b);
    await a.call("push", await b.call("addr"));
    let status = await b.call("refresh");
    t.deepEqual(status.verified, [0, 1]);
    t.is(status.failed, null);
    t.deepEqual(await b.call("credited", signer.address), [
      "https://after.example",
    ]);
    t.true(
      (await b.call("credited", alice.address)).includes(
        "https://before.example",
      ),
    );

    // 4. Carol forces a story in with include(): the sequencer takes it in
    // and lists it, B takes it from the calldata (not from A) and verifies.
    const forced = await story(carol, "https://forced.example", now());
    await include(forced);
    const two = await a.call("commit");
    t.deepEqual((await a.call("calldata", two.hash)).ids, [id(forced)]);
    status = await b.call("refresh");
    t.deepEqual(status.verified, [0, 3]);
    t.deepEqual(await b.call("credited", carol.address), [
      "https://forced.example",
    ]);
    t.log("B:", JSON.stringify(status));

    // 5. A censoring sequencer leaves a forced story out of its next commit.
    // B took it from the calldata, so the commit's root differs, and B
    // reports the commit.
    const censored = await story(carol, "https://censored.example", now());
    await include(censored);
    await a.call("refresh");
    await a.call("drop", toDigest(censored).index);
    t.deepEqual(
      await a.call("add", [await story(bob, "https://other.example", now())]),
      [],
    );
    const five = await a.call("commit");
    t.false((await a.call("calldata", five.hash)).ids.includes(id(censored)));
    await a.call("push", await b.call("addr"));
    status = await b.call("refresh");
    t.deepEqual(status.verified, [0, 3]);
    t.deepEqual(
      { k: status.failed.k, status: status.failed.status },
      { k: 5, status: "mismatch" },
    );
    t.is(status.failed.tx, five.hash);
    t.log("B, censored:", JSON.stringify(status));

    // 6. A swaps a committed message for another validly signed one: C
    // misses it in commit 1. With a genesis message gone, D's root of the
    // genesis differs. Both report it and keep syncing.
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

    const next = await story(bob, "https://next.example", now());
    t.deepEqual(await a.call("add", [next]), []);
    await a.call("push", await d.call("addr"));
    t.true(
      (await d.call("credited", bob.address)).includes("https://next.example"),
    );
  },
);

(hasAnvil ? test.serial : test.skip)(
  "the inbox: only the sequencer commits, only the owner changes the sequencer, anyone includes",
  async (t) => {
    t.timeout(60_000);
    const { client, address, call, sequencer, owner } = await chain(t);
    const read = (functionName, args = []) =>
      client.readContract({ address, abi: inbox.abi, functionName, args });
    const commit = [1, zeroHash, [zeroHash]];
    const events = async (receipt) =>
      (
        await client.getContractEvents({
          address,
          abi: inbox.abi,
          eventName: "Commit",
          blockHash: receipt.blockHash,
        })
      ).map(({ args }) => args);

    t.is(await read("owner"), owner.account.address);
    t.is(await read("sequencer"), sequencer.account.address);
    // EIP-173 and ERC-165
    t.true(await read("supportsInterface", ["0x7f5828d0"]));
    t.true(await read("supportsInterface", ["0x01ffc9a7"]));
    t.false(await read("supportsInterface", ["0xffffffff"]));

    await t.throwsAsync(call(ANYONE_KEY, "commit", commit), {
      message: /not the sequencer/,
    });
    t.deepEqual(await events(await call(SEQUENCER_KEY, "commit", commit)), [
      {
        sender: sequencer.account.address,
        sequencer: true,
        root: zeroHash,
        n: 1n,
      },
    ]);
    const anyone = privateKeyToAccount(ANYONE_KEY).address;
    t.deepEqual(
      await events(await call(ANYONE_KEY, "include", [["0x01", "0x02"]])),
      [{ sender: anyone, sequencer: false, root: zeroHash, n: 2n }],
    );
    // The sequencer can include, too, but that's not a commit.
    t.deepEqual(
      await events(await call(SEQUENCER_KEY, "include", [["0x01"]])),
      [
        {
          sender: sequencer.account.address,
          sequencer: false,
          root: zeroHash,
          n: 1n,
        },
      ],
    );

    await t.throwsAsync(call(SEQUENCER_KEY, "setSequencer", [anyone]), {
      message: /not the owner/,
    });
    await call(OWNER_KEY, "setSequencer", [anyone]);
    t.is(await read("sequencer"), anyone);
    await t.throwsAsync(call(SEQUENCER_KEY, "commit", commit), {
      message: /not the sequencer/,
    });
    await call(ANYONE_KEY, "commit", commit);

    await t.throwsAsync(call(ANYONE_KEY, "transferOwnership", [anyone]), {
      message: /not the owner/,
    });
    const receipt = await call(OWNER_KEY, "transferOwnership", [anyone]);
    const [transferred] = await client.getContractEvents({
      address,
      abi: inbox.abi,
      eventName: "OwnershipTransferred",
      blockHash: receipt.blockHash,
    });
    t.deepEqual(transferred.args, {
      previousOwner: owner.account.address,
      newOwner: anyone,
    });
    t.is(await read("owner"), anyone);
    await t.throwsAsync(call(OWNER_KEY, "setSequencer", [anyone]), {
      message: /not the owner/,
    });
  },
);
