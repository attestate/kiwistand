//@format
import test from "ava";
import { Wallet } from "ethers";

import * as profiles from "../src/profiles.mjs";
import { EIP712_DOMAIN, EIP712_MESSAGE } from "../src/constants.mjs";

const DAY = 24 * 60 * 60;
const NOW = 1_800_000_000;
const noEns = async () => null;

async function request(wallet, name, options = {}) {
  const {
    address = wallet.address,
    avatar = "",
    signedAt = NOW,
    type = profiles.AUTH_TYPE,
  } = options;
  const message = {
    title: profiles.AUTH_TITLE,
    href: profiles.buildHref({ address, name: name.toLowerCase(), avatar }),
    type,
    timestamp: signedAt,
  };
  const signature = await wallet._signTypedData(
    EIP712_DOMAIN,
    EIP712_MESSAGE,
    message,
  );
  const body = { name, address, signedAt, signature };
  if (avatar) body.avatar = avatar;
  return body;
}

function save(body, options = {}) {
  return profiles.save(body, { now: NOW, ensLookup: noEns, ...options });
}

async function rejects(t, promise, details, code = 400) {
  const err = await t.throwsAsync(promise, {
    instanceOf: profiles.ProfileError,
  });
  t.is(err.code, code);
  if (details) t.regex(err.details, details);
}

test.beforeEach(() => {
  profiles._setDB(":memory:");
});

test.serial("validateName", (t) => {
  t.is(profiles.validateName("alice"), null);
  t.is(profiles.validateName("a-b-c"), null);
  t.is(profiles.validateName("abc123"), null);
  t.truthy(profiles.validateName("ab"));
  t.truthy(profiles.validateName("a".repeat(21)));
  t.truthy(profiles.validateName("Alice"));
  t.truthy(profiles.validateName("al ice"));
  t.truthy(profiles.validateName("al_ice"));
  t.truthy(profiles.validateName("alice.eth"));
  t.truthy(profiles.validateName("-alice"));
  t.truthy(profiles.validateName("alice-"));
  t.truthy(profiles.validateName("kiwi"));
  t.truthy(profiles.validateName("timdaub"));
});

test.serial("claim, read back, list and remove a name", async (t) => {
  const wallet = Wallet.createRandom();
  const address = wallet.address.toLowerCase();
  const avatar = "https://example.com/a.png";
  const data = await save(await request(wallet, "Alice", { avatar }));
  t.deepEqual(data, { address, name: "alice", avatar });
  t.deepEqual(profiles.get(wallet.address), { address, name: "alice", avatar });
  t.deepEqual(profiles.byName("ALICE"), { address, name: "alice", avatar });

  const [record] = profiles.list(0);
  t.is(record.address, address);
  t.is(record.message.type, "PROFILE");
  t.is(
    record.message.href,
    `kiwi://profile?address=${address}&name=alice&avatar=${encodeURIComponent(avatar)}`,
  );
  t.is(profiles.list(NOW + 1).length, 0);

  // Removal is always allowed, even right after claiming.
  const removed = await save(await request(wallet, "", { signedAt: NOW + 1 }), {
    now: NOW + 1,
  });
  t.is(removed.name, null);
  t.is(profiles.byName("alice"), null);
  t.is(profiles.get(address).name, null);
});

test.serial("invalid and reserved names are rejected", async (t) => {
  const wallet = Wallet.createRandom();
  await rejects(t, save(await request(wallet, "ab")), /3 to 20/);
  await rejects(t, save(await request(wallet, "-abc")), /hyphen/);
  await rejects(t, save(await request(wallet, "a_b_c")), /3 to 20/);
  await rejects(t, save(await request(wallet, "admin")), /reserved/);
  await rejects(t, save(await request(wallet, "KiwiNews")), /reserved/);
  await rejects(
    t,
    save(await request(wallet, "alice", { avatar: "http://x.com/a.png" })),
    /https/,
  );
});

test.serial("names are unique, case-insensitively", async (t) => {
  const alice = Wallet.createRandom();
  const bob = Wallet.createRandom();
  await save(await request(alice, "alice"));
  await rejects(t, save(await request(bob, "ALICE")), /taken/);
  await rejects(t, save(await request(bob, "alice")), /taken/);
  t.is(profiles.byName("alice").address, alice.address.toLowerCase());
});

test.serial("a name owned by someone else on ENS is rejected", async (t) => {
  const wallet = Wallet.createRandom();
  const other = Wallet.createRandom();
  await rejects(
    t,
    save(await request(wallet, "vitalik"), {
      ensLookup: async () => other.address,
    }),
    /vitalik\.eth/,
  );
  // Own ENS name, unresolvable, or a failing lookup are all fine.
  await save(await request(wallet, "vitalik"), {
    ensLookup: async () => wallet.address,
  });
  const third = Wallet.createRandom();
  await save(await request(third, "carol"), {
    ensLookup: async () => {
      throw new Error("RPC down");
    },
  });
  t.is(profiles.byName("carol").address, third.address.toLowerCase());
});

test.serial("one name change per 30 days", async (t) => {
  const wallet = Wallet.createRandom();
  await save(await request(wallet, "alice"));

  const later = NOW + 10 * DAY;
  await rejects(
    t,
    save(await request(wallet, "alice2", { signedAt: later }), { now: later }),
    /30 days/,
  );
  // Updating only the avatar isn't a name change.
  const avatar = "https://example.com/b.png";
  const data = await save(
    await request(wallet, "alice", { signedAt: later, avatar }),
    { now: later },
  );
  t.is(data.avatar, avatar);

  // Removing and then picking another name doesn't skip the cooldown...
  await save(await request(wallet, "", { signedAt: later }), { now: later });
  await rejects(
    t,
    save(await request(wallet, "alice2", { signedAt: later }), { now: later }),
    /30 days/,
  );
  // ...but taking back the last name is fine.
  await save(await request(wallet, "alice", { signedAt: later }), {
    now: later,
  });

  const muchLater = NOW + 31 * DAY;
  const changed = await save(
    await request(wallet, "alice2", { signedAt: muchLater }),
    { now: muchLater },
  );
  t.is(changed.name, "alice2");
});

test.serial("released names are held for 30 days", async (t) => {
  const alice = Wallet.createRandom();
  const bob = Wallet.createRandom();
  await save(await request(alice, "alice"));
  const release = NOW + DAY;
  await save(await request(alice, "", { signedAt: release }), {
    now: release,
  });

  const during = release + 29 * DAY;
  await rejects(
    t,
    save(await request(bob, "alice", { signedAt: during }), { now: during }),
    /hold/,
  );
  // The previous owner can take it back during the hold.
  await save(await request(alice, "alice", { signedAt: during }), {
    now: during,
  });
  await save(await request(alice, "", { signedAt: during }), { now: during });

  const after = during + 31 * DAY;
  const data = await save(await request(bob, "alice", { signedAt: after }), {
    now: after,
  });
  t.is(data.address, bob.address.toLowerCase());
});

test.serial("signature and identity mismatches are rejected", async (t) => {
  const alice = Wallet.createRandom();
  const mallory = Wallet.createRandom();

  // Mallory signs a request for Alice's address.
  await rejects(
    t,
    save(await request(mallory, "alice", { address: alice.address })),
    /mismatch/,
    401,
  );

  // A tampered body doesn't match what was signed.
  const body = await request(alice, "alice");
  await rejects(t, save({ ...body, name: "alice2" }), /mismatch/, 401);
  await rejects(t, save({ ...body, signature: "0x1234" }), /signature/i, 401);

  // A message of another type isn't accepted.
  await rejects(
    t,
    save(await request(alice, "alice", { type: "amplify" })),
    /mismatch/,
    401,
  );

  // Timestamps must be within 5 minutes.
  await rejects(
    t,
    save(await request(alice, "alice", { signedAt: NOW - 301 })),
    /timestamp/,
    401,
  );
  await rejects(
    t,
    save(await request(alice, "alice", { signedAt: NOW + 301 })),
    /timestamp/,
    401,
  );
  t.is(profiles.get(alice.address), null);
});

test.serial("a delegated key can set its identity's name", async (t) => {
  const identity = Wallet.createRandom();
  const key = Wallet.createRandom();
  const delegations = { [key.address]: identity.address };

  const body = await request(key, "alice", { address: identity.address });
  await rejects(t, save(body), /mismatch/, 401);
  const data = await save(body, { delegations });
  t.is(data.address, identity.address.toLowerCase());

  // But not anyone else's.
  const other = Wallet.createRandom();
  await rejects(
    t,
    save(await request(key, "bob", { address: other.address }), {
      delegations,
    }),
    /mismatch/,
    401,
  );
});
