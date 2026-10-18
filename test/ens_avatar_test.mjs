import test from "ava";

import { workingAvatar, httpsURL, overlay, _resolve } from "../src/ens.mjs";

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

test("only keeps https avatars", (t) => {
  t.is(httpsURL("https://i.imgur.com/a.png"), "https://i.imgur.com/a.png");
  t.is(httpsURL("javascript:alert(1)"), null);
  t.is(httpsURL(" JavaScript:alert(1)"), null);
  t.is(httpsURL("data:text/html,x"), null);
  t.is(httpsURL("http://i.imgur.com/a.png"), null);
  t.is(httpsURL("httpsx:alert(1)"), null);
  t.is(httpsURL(undefined), null);
});

test("drops a javascript: Farcaster avatar when resolving", async (t) => {
  const address = "0x0000000000000000000000000000000000000002";
  const ensdata = {
    address,
    farcaster: { username: "mallory", pfp_url: "javascript:alert(1)" },
  };
  const original = globalThis.fetch;
  globalThis.fetch = async (url) =>
    String(url).startsWith("https://api.ensdata.net/")
      ? Response.json(ensdata)
      : new Response("{}", { status: 404 });
  try {
    const profile = await _resolve(address, true);
    t.is(profile.farcaster.avatar, "javascript:alert(1)");
    t.is(profile.safeAvatar, null);
  } finally {
    globalThis.fetch = original;
  }
});

test("drops bad avatars from cached profiles", (t) => {
  const address = "0x0000000000000000000000000000000000000001";
  const cached = { address, safeAvatar: "javascript:alert(1)" };
  t.is(overlay(address, cached).safeAvatar, null);
  const good = { address, safeAvatar: "https://i.imgur.com/a.png" };
  t.is(overlay(address, good).safeAvatar, good.safeAvatar);
});
