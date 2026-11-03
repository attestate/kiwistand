import test from "ava";
import { Wallet } from "ethers";

import { sign } from "../src/id.mjs";
import {
  create,
  authorization,
  verify,
  build,
  resolve,
  keysOf,
} from "../src/delegations.mjs";
import { EIP712_DELEGATION } from "../src/constants.mjs";

const T = 1800000000;

async function delegation(account, key, authorize = true, signer = account) {
  const message = create({
    account: account.address,
    key: key.address,
    authorization: authorize ? await authorization(key, account.address) : "",
    authorize,
    timestamp: T,
  });
  return await sign(signer, message, EIP712_DELEGATION);
}

test("a delegation is signed by the account and holds the key's signature", async (t) => {
  const account = Wallet.createRandom();
  const key = Wallet.createRandom();
  const stranger = Wallet.createRandom();

  t.is(await verify(await delegation(account, key), ""), account.address);
  t.is(
    await verify(await delegation(account, key, false), ""),
    account.address,
  );

  // Someone else's signature, without an RPC for smart wallets.
  const forged = await delegation(account, key, true, stranger);
  await t.throwsAsync(verify(forged, ""), {
    message: /didn't sign the delegation/,
  });

  // A key's signature for another account can't be reused.
  const reused = await sign(
    stranger,
    { ...(await delegation(account, key)), account: stranger.address },
    EIP712_DELEGATION,
  );
  await t.throwsAsync(verify(reused, ""), { message: /key didn't sign/ });

  const revocation = await delegation(account, key, false);
  const withKey = await sign(
    account,
    {
      ...revocation,
      authorization: (await delegation(account, key)).authorization,
    },
    EIP712_DELEGATION,
  );
  await t.throwsAsync(verify(withKey, ""), { message: /no authorization/ });
});

test("the order decides whom a key's messages count for", (t) => {
  const [alice, bob, carol, old, key] = Array.from(
    { length: 5 },
    () => Wallet.createRandom().address,
  );
  // NOTE: Indexes stand for messages here; `places` gives their place.
  const places = {
    authorize: [1, 1],
    stranger: [1, 2],
    revoke: [1, 3],
    revokeOld: [1, 5],
    redelegate: [2, 0],
  };
  const position = (index) => places[index];
  const rows = [
    { index: "revoke", key, account: alice, authorize: 0 },
    { index: "authorize", key, account: alice, authorize: 1 },
    { index: "stranger", key, account: bob, authorize: 0 },
    { index: "redelegate", key, account: carol, authorize: 1 },
    { index: "revokeOld", key: old, account: alice, authorize: 0 },
  ];
  const delegations = build({ [old]: alice }, rows, position);
  const at = (signer, place) => {
    places.message = place;
    return resolve(delegations, signer, "message");
  };

  // Before its first delegation, after it, after a stranger's revocation.
  t.is(at(key, [0, 7]), alice);
  t.is(at(key, [1, 2]), alice);
  t.is(at(key, [1, 3]), alice);
  // After the revocation: the key itself. Delegated again: the new account.
  t.is(at(key, [1, 4]), key);
  t.is(at(key, [2, 1]), carol);
  // A snapshot key counts for its account until revoked.
  t.is(at(old, [0, 1]), alice);
  t.is(at(old, [1, 6]), old);
  // Pending messages come after every commit.
  t.is(at(key, [Infinity, T]), carol);

  t.deepEqual(Object.fromEntries(Object.entries(delegations)), {
    [key]: carol,
  });
  t.deepEqual(keysOf(delegations, alice).sort(), [old, key].sort());
});
