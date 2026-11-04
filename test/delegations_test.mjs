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
} from "../src/delegations.mjs";
import { EIP712_DELEGATION } from "../src/constants.mjs";
import enhance from "../src/workers/enhancer.mjs";

const T = 1800000000;

async function delegation(identity, signer, authorize = true, by = identity) {
  const message = create({
    identity: identity.address,
    signer: signer.address,
    authorization: authorize
      ? await authorization(signer, identity.address)
      : "",
    authorize,
    timestamp: T,
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
  const delegations = build({ [old]: alice }, rows);
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

  t.deepEqual(Object.fromEntries(Object.entries(delegations)), {
    [signer]: carol,
  });
  t.deepEqual(keysOf(delegations, alice).sort(), [old, signer].sort());
});
