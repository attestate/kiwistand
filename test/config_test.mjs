// @format
import test from "ava";
import { multiaddr } from "@multiformats/multiaddr";
import { pubsubPeerDiscovery } from "@libp2p/pubsub-peer-discovery";

import { dialable } from "../src/config.mjs";

test("dialable refuses non-public addresses", (t) => {
  for (const addr of [
    "/ip4/127.0.0.1/tcp/53462",
    "/ip4/10.0.0.1/tcp/53462",
    "/ip4/172.16.0.1/tcp/53462",
    "/ip4/192.168.1.1/tcp/53462",
    "/ip4/169.254.169.254/tcp/80",
    "/ip4/100.64.0.1/tcp/53462",
    "/ip4/0.0.0.0/tcp/53462",
    "/ip4/224.0.0.1/tcp/53462",
    "/ip4/255.255.255.255/tcp/53462",
    "/ip6/::1/tcp/53462",
    "/ip6/::/tcp/53462",
    "/ip6/::ffff:127.0.0.1/tcp/53462",
    "/ip6/::ffff:169.254.169.254/tcp/80",
    "/ip6/fd00::1/tcp/53462",
    "/ip6/fe80::1/tcp/53462",
    "/ip6/ff02::1/tcp/53462",
    "/dns4/example.com/tcp/53462",
    "/dns6/localhost/tcp/53462",
  ]) {
    t.false(dialable(multiaddr(addr), false), addr);
  }
});

test("dialable allows public addresses", (t) => {
  for (const addr of [
    "/ip4/91.107.210.214/tcp/53462",
    "/ip4/8.8.8.8/tcp/53462/p2p/QmcgpsyWgH8Y8ajJz1Cu72KnS5uo2Aa2LpzU7kinSupNKC",
    "/ip6/2a01:4f8::1/tcp/53462",
  ]) {
    t.true(dialable(multiaddr(addr), false), addr);
  }
});

test("dialable allows only loopback when asked to", (t) => {
  t.true(dialable(multiaddr("/ip4/127.0.0.1/tcp/53462"), true));
  t.true(dialable(multiaddr("/ip6/::1/tcp/53462"), true));
  t.false(dialable(multiaddr("/ip4/10.0.0.1/tcp/53462"), true));
  t.false(dialable(multiaddr("/ip4/169.254.169.254/tcp/80"), true));
});

// The bootstrap node relies on this to not ingest peer records.
test("listenOnly pubsub-peer-discovery drops received peer records", (t) => {
  const pubsub = { subscribe() {}, addEventListener() {} };
  const service = pubsubPeerDiscovery({ listenOnly: true })({ pubsub });
  let discovered = false;
  service.addEventListener("peer", () => (discovered = true));
  service.afterStart();
  const detail = { topic: "_peer-discovery._p2p._pubsub", data: null };
  service._onMessage({ detail });
  t.false(discovered);
});
