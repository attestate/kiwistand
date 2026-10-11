// @format
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import test from "ava";
import { Wallet } from "ethers";

import { EIP712_DOMAIN } from "../src/constants.mjs";

process.env.CACHE_DIR = mkdtempSync(join(tmpdir(), "profiles-"));
const profiles = await import("../src/profiles.mjs");
const ens = await import("../src/ens.mjs");
const { default: cache } = await import("../src/cache.mjs");

const KEY =
  "0xcebc8882fecbec7fb80d2cf4b312bec018884c2d66667c67a90508214bd8bafc";
const ADDRESS = "0x7dE955EA5C8C40f33755C4da8cAC86Dd7fFA8b98";
const AVATAR =
  "https://imagedelivery.net/C5bPuWCkK_P2Rg7LwXEwPQ/c707d049-e32e-4944-b167-26ae5d803000/public";
const now = () => Math.floor(Date.now() / 1000);

async function sign(wallet, fields) {
  const value = { name: "", bio: "", avatar: "", timestamp: now(), ...fields };
  const signature = await wallet._signTypedData(
    EIP712_DOMAIN,
    profiles.PROFILE_TYPES,
    value,
  );
  return { ...value, signature };
}

test("the spec's test vector verifies to its address", async (t) => {
  const message = {
    name: "kiwi_fan",
    bio: "hello",
    avatar: "",
    timestamp: 1700000000,
    signature:
      "0x43f928f817e5dd5f819d129fbad9294f2b7e321485ee698d77874fd537ea6ede5ba57010ffacb3722c9a0a72bd461e27ed74ad5d1ee460d831b60460bded7d1f1b",
  };
  const identity = await profiles.verify(message, 1700000000 + 10);
  t.is(identity, ADDRESS.toLowerCase());

  const signed = await sign(new Wallet(KEY), {
    name: "kiwi_fan",
    bio: "hello",
    timestamp: 1700000000,
  });
  t.is(signed.signature, message.signature);
});

test("rejects tampered, expired and malformed messages", async (t) => {
  const wallet = Wallet.createRandom();
  const message = await sign(wallet, { name: "alice_t" });
  const tampered = await profiles
    .verify({ ...message, bio: "changed" })
    .catch(() => null);
  t.not(tampered, wallet.address.toLowerCase());

  await t.throwsAsync(() => profiles.verify(message, now() + 6 * 60), {
    message: "Profile expired, sign it again",
  });
  await t.throwsAsync(() => profiles.verify({ ...message, timestamp: "1" }), {
    message: "Invalid profile",
  });
});

test("name rules", (t) => {
  t.notThrows(() => profiles.validName(""));
  t.notThrows(() => profiles.validName("ab"));
  t.notThrows(() => profiles.validName("Kiwi_Fan_2024"));
  t.throws(() => profiles.validName("a"));
  t.throws(() => profiles.validName("a".repeat(21)));
  t.throws(() => profiles.validName("vitalik.eth"));
  t.throws(() => profiles.validName("with space"));
  t.throws(() => profiles.validName("émile"));
  t.throws(() => profiles.validName("Admin"), {
    message: "That name is reserved",
  });
  t.throws(() => profiles.validName("KIWINEWS"), {
    message: "That name is reserved",
  });
});

test("bio rules", (t) => {
  t.notThrows(() => profiles.validBio(""));
  t.notThrows(() => profiles.validBio("line one\nline two"));
  t.notThrows(() => profiles.validBio(`  ${"x".repeat(160)}  `));
  t.notThrows(() => profiles.validBio("🥝".repeat(160)));
  t.throws(() => profiles.validBio("x".repeat(161)));
  t.throws(() => profiles.validBio("tab\there"));
  t.throws(() => profiles.validBio("bell\u0007"));
});

test("avatar rules", (t) => {
  t.notThrows(() => profiles.validAvatar(""));
  t.notThrows(() => profiles.validAvatar(AVATAR));
  t.throws(() => profiles.validAvatar("https://example.com/a.png"));
  t.throws(() =>
    profiles.validAvatar(
      "https://imagedelivery.net/someoneelse/c707d049/public",
    ),
  );
  t.throws(() => profiles.validAvatar(`${AVATAR}?x=1`));
  t.throws(() => profiles.validAvatar(AVATAR.replace("https", "http")));
});

test("names are unique case-insensitively, clearing frees them", async (t) => {
  const alice = Wallet.createRandom();
  const bob = Wallet.createRandom();

  const first = await profiles.update(
    await sign(alice, { name: "Unique_Name", bio: " hi ", avatar: AVATAR }),
  );
  t.is(first.identity, alice.address.toLowerCase());
  t.deepEqual(first.profile, { name: "Unique_Name", bio: "hi", avatar: AVATAR });
  t.is(profiles.byName("unique_name"), alice.address.toLowerCase());

  const taken = await t.throwsAsync(async () =>
    profiles.update(await sign(bob, { name: "unique_NAME" })),
  );
  t.is(taken.message, "That name is taken");
  t.is(taken.status, 409);

  await profiles.update(
    await sign(alice, { name: "", timestamp: now() + 1 }),
  );
  t.is(profiles.byName("unique_name"), undefined);
  t.deepEqual(profiles.get(alice.address), { name: "", bio: "", avatar: "" });

  const second = await profiles.update(await sign(bob, { name: "unique_name" }));
  t.is(second.profile.name, "unique_name");
});

test("rejects replays and older profiles", async (t) => {
  const wallet = Wallet.createRandom();
  const timestamp = now();
  const message = await sign(wallet, { name: "replay_me", timestamp });
  await profiles.update(message);

  const replay = await t.throwsAsync(() => profiles.update(message));
  t.is(replay.status, 409);
  const older = await sign(wallet, { name: "older", timestamp: timestamp - 1 });
  await t.throwsAsync(() => profiles.update(older));
  t.is(profiles.get(wallet.address).name, "replay_me");
});

test("ens overlays the Kiwi profile at read time", async (t) => {
  const wallet = Wallet.createRandom();
  const address = wallet.address.toLowerCase();
  const ensProfile = {
    address,
    ens: "someone.eth",
    displayName: "someone.eth",
    safeAvatar: "https://example.com/a.png",
    avatarChecked: true,
  };
  cache.set(`${ens.ENS_CACHE_PREFIX}${address}`, ensProfile);

  t.is((await ens.resolve(wallet.address)).displayName, "someone.eth");

  await profiles.update(
    await sign(wallet, { name: "kiwi_name", bio: "about me", avatar: AVATAR }),
  );
  for (const profile of [
    await ens.resolve(wallet.address),
    await ens.resolveForBatch(wallet.address),
  ]) {
    t.is(profile.displayName, "kiwi_name");
    t.is(profile.safeAvatar, AVATAR);
    t.is(profile.bio, "about me");
    t.is(profile.ens, "someone.eth");
    t.deepEqual(profile.kiwiProfile, {
      name: "kiwi_name",
      bio: "about me",
      avatar: AVATAR,
    });
  }
  t.is(ensProfile.displayName, "someone.eth", "doesn't change the cache");

  // Only a bio: the ENS name and avatar stay.
  await profiles.update(
    await sign(wallet, { bio: "just a bio", timestamp: now() + 1 }),
  );
  const bioOnly = await ens.resolve(wallet.address);
  t.is(bioOnly.displayName, "someone.eth");
  t.is(bioOnly.safeAvatar, "https://example.com/a.png");
  t.is(bioOnly.bio, "just a bio");
});
