import test from "ava";

import { workingAvatar } from "../src/ens.mjs";

const small = "https://ensdata.net/media/avatar/sileo.eth";
const original = "https://sileo.be/pfp.jpg";
const profile = { avatar_small: small, avatar_url: original, safeAvatar: small };
const respond = (status, type) => async () =>
  new Response("x", { status, headers: { "content-type": type } });

test("keeps ensdata's avatar when it is an image", async (t) => {
  t.is(await workingAvatar(profile, respond(200, "image/png")), small);
});

test("falls back to the original image when ensdata refuses it", async (t) => {
  t.is(await workingAvatar(profile, respond(403, "text/html")), original);
  t.is(await workingAvatar(profile, respond(200, "text/html")), original);
});

test("keeps ensdata's avatar on network trouble", async (t) => {
  const fail = async () => {
    throw new Error("timeout");
  };
  t.is(await workingAvatar(profile, fail), small);
});

test("leaves other avatars alone", async (t) => {
  const never = async () => t.fail("must not fetch");
  const farcaster = { safeAvatar: "https://i.imgur.com/a.png" };
  t.is(await workingAvatar(farcaster, never), farcaster.safeAvatar);
  const ipfs = { ...profile, avatar_url: "ipfs://abc" };
  t.is(await workingAvatar(ipfs, never), small);
});
