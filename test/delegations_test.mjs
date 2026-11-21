import test from "ava";
import { Wallet } from "ethers";

import { sign, validate, toDigest } from "../src/id.mjs";
import {
  create,
  authorization,
  verify,
  build,
  resolve,
  keysOf,
  timeless,
} from "../src/delegations.mjs";
import { EIP712_DELEGATION } from "../src/constants.mjs";
import enhance from "../src/workers/enhancer.mjs";

const T = 1800000000;

async function delegation(
  identity,
  signer,
  authorize = true,
  by = identity,
  timestamp = T,
) {
  const message = create({
    identity: identity.address,
    signer: signer.address,
    authorization: authorize
      ? await authorization(signer, identity.address, timestamp)
      : "",
    authorize,
    timestamp,
  });
  return await sign(by, message, EIP712_DELEGATION);
}

test("a delegation is signed by the identity and holds the signer's signature", async (t) => {
  const identity = Wallet.createRandom();
  const signer = Wallet.createRandom();
  const stranger = Wallet.createRandom();

  t.is(await verify(await delegation(identity, signer), ""), identity.address);
  t.is(
    await verify(await delegation(identity, signer, false), ""),
    identity.address,
  );

  // Someone else's signature, without an RPC for smart wallets.
  const forged = await delegation(identity, signer, true, stranger);
  await t.throwsAsync(verify(forged, ""), {
    message: /didn't sign the delegation/,
  });

  // A signer's signature for another identity can't be reused.
  const reused = await sign(
    stranger,
    { ...(await delegation(identity, signer)), identity: stranger.address },
    EIP712_DELEGATION,
  );
  await t.throwsAsync(verify(reused, ""), { message: /signer didn't sign/ });

  // An old authorization can't be replayed under a new timestamp, e.g. to
  // claim the signer back after a revocation or after it moved to another
  // identity.
  const old = await delegation(identity, signer);
  const replayed = await sign(
    identity,
    create({
      identity: identity.address,
      signer: signer.address,
      authorization: old.authorization,
      authorize: true,
      timestamp: T + 100,
    }),
    EIP712_DELEGATION,
  );
  await t.throwsAsync(verify(replayed, ""), { message: /signer didn't sign/ });
  t.is(
    await verify(
      await delegation(identity, signer, true, identity, T + 100),
      "",
    ),
    identity.address,
  );

  const revocation = await delegation(identity, signer, false);
  const withAuthorization = await sign(
    identity,
    {
      ...revocation,
      authorization: (await delegation(identity, signer)).authorization,
    },
    EIP712_DELEGATION,
  );
  await t.throwsAsync(verify(withAuthorization, ""), {
    message: /no authorization/,
  });

  // `authorization` is bytes, but always a 65-byte signature, or "0x".
  const { authorization: signature, ...rest } = await delegation(
    identity,
    signer,
  );
  t.is(signature.length, 2 + 65 * 2);
  t.throws(() => validate({ ...rest, authorization: `${signature}00` }));
  t.throws(() => validate({ ...rest, authorization: signature.slice(0, -2) }));
});

// NOTE: POST /api/v1/list and the startup's delegations table read messages
// through the enhancer, which adds a `signer` to every other message.
test("a listed delegation keeps its own identity and signer", async (t) => {
  const identity = Wallet.createRandom();
  const signer = Wallet.createRandom();
  const message = await delegation(identity, signer);
  const listed = await enhance({ node: message });
  t.is(listed.index, toDigest(message).index);
  t.is(listed.identity, identity.address);
  t.is(listed.signer, signer.address);
});

test("timestamps decide whom a signer's messages count for", (t) => {
  const [alice, bob, carol, old, signer] = Array.from(
    { length: 5 },
    () => Wallet.createRandom().address,
  );
  // NOTE: A message's index is its timestamp in hex and its ID.
  const at = (timestamp, byte = "ab") =>
    `${timestamp.toString(16)}${byte.repeat(32)}`;
  // In the order a node took them, which doesn't matter.
  const rows = [
    { index: at(T + 30), signer, identity: alice, authorize: 0 },
    { index: at(T + 10), signer, identity: alice, authorize: 1 },
    { index: at(T + 20), signer, identity: bob, authorize: 0 },
    { index: at(T + 50), signer, identity: carol, authorize: 1 },
    { index: at(T + 40), signer: old, identity: alice, authorize: 0 },
  ];
  // A message the signer's stolen key signed after the revocation, dated
  // before it, that wasn't witnessed in time (src/commits.mjs).
  const stolen = at(T + 25, "cd");
  const late = (index) => index === stolen;
  const delegations = build({ [old]: alice }, rows, late);
  const of = (address, timestamp) =>
    resolve(delegations, address, at(timestamp, "ef"));

  // Before its first delegation, after it, after a stranger's revocation, and
  // dated the same second as the revocation.
  t.is(of(signer, T), alice);
  t.is(of(signer, T + 11), alice);
  t.is(of(signer, T + 25), alice);
  t.is(of(signer, T + 30), alice);
  // Dated after the revocation: the signer itself. Delegated again: the new
  // identity.
  t.is(of(signer, T + 31), signer);
  t.is(of(signer, T + 51), carol);
  // A snapshot signer counts for its identity until revoked.
  t.is(of(old, T), alice);
  t.is(of(old, T + 41), old);
  // The backdated message counts for the signer, not for Alice.
  t.is(resolve(delegations, signer, stolen), signer);

  t.deepEqual(Object.fromEntries(Object.entries(delegations)), {
    [signer]: carol,
  });
  t.deepEqual(keysOf(delegations, alice).sort(), [old, signer].sort());

  // Blind to the commits, the backdated message counts by its timestamp, so
  // whether a node takes a message can't depend on how far it read the
  // commits. Everything else stays the same.
  const blind = timeless(delegations);
  t.is(resolve(blind, signer, stolen), alice);
  t.is(resolve(blind, signer, at(T + 31, "ef")), signer);
  t.is(resolve(delegations, signer, stolen), signer);
  t.deepEqual(Object.fromEntries(Object.entries(blind)), {
    [signer]: carol,
  });
});

// NOTE: A stolen key can sign an authorization for any timestamp, so a
// delegation that wasn't witnessed in time must not count, or the thief
// would take the key's messages and karma from the owner for good.
test("a delegation that wasn't witnessed in time doesn't count", (t) => {
  const [alice, thief, signer, lone] = Array.from(
    { length: 4 },
    () => Wallet.createRandom().address,
  );
  const at = (timestamp, byte = "ab") =>
    `${timestamp.toString(16)}${byte.repeat(32)}`;
  const stolen = at(T + 11, "cd");
  const alone = at(T + 5, "ce");
  const rows = [
    { index: at(T + 10), signer, identity: alice, authorize: 1 },
    // Backdated to just after Alice's delegation, signed after the theft.
    { index: stolen, signer, identity: thief, authorize: 1 },
    { index: at(T + 30), signer, identity: alice, authorize: 0 },
    { index: alone, signer: lone, identity: thief, authorize: 1 },
  ];
  const late = (index) => index === stolen || index === alone;
  const delegations = build({}, rows, late);
  const of = (address, timestamp) =>
    resolve(delegations, address, at(timestamp, "ef"));

  // The key's messages keep counting for Alice, and her revocation works.
  t.is(of(signer, T + 20), alice);
  t.is(of(signer, T), alice);
  t.is(of(signer, T + 31), signer);
  // A key whose only delegation is late signs for itself.
  t.is(of(lone, T + 6), lone);

  // Whether a node takes a message doesn't depend on it: every delegation is
  // still among the keys and, blind to the commits, counts by its timestamp.
  t.true(keysOf(delegations, thief).includes(signer));
  const blind = timeless(delegations);
  t.is(resolve(blind, signer, at(T + 20, "ef")), thief);
  t.is(resolve(blind, lone, at(T + 6, "ef")), thief);
});

// NOTE: `late` asks the database. Delegations are free, so asking it about
// every delegation for every message would let anyone stall a node.
test("whether a delegation is late is asked once per build", (t) => {
  const [alice, signer] = Array.from(
    { length: 2 },
    () => Wallet.createRandom().address,
  );
  const at = (timestamp, byte = "ab") =>
    `${timestamp.toString(16)}${byte.repeat(32)}`;
  const rows = Array.from({ length: 50 }, (_, i) => ({
    index: at(T + 10 + i),
    signer,
    identity: alice,
    authorize: 1,
  }));
  let asked = 0;
  const late = () => {
    asked += 1;
    return false;
  };
  const delegations = build({}, rows, late);
  for (let i = 0; i < 100; i++) {
    t.is(resolve(delegations, signer, at(T + 100 + i, "ef")), alice);
  }
  // 50 delegations once each, plus one question per message.
  t.is(asked, 50 + 100);
});
