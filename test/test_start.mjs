// @format
import test from "ava";
import esmock from "esmock";
import process from "process";

import { start } from "../src/index.mjs";

test("run as bootstrap node", async t => {
  const config = await esmock("../src/config.mjs", {
    process: {
      ...process,
      env: {
        ...process.env,
        BIND_ADDRESS_V4: "127.0.0.1",
        PORT: 0,
        USE_EPHEMERAL_ID: "false",
        IS_BOOTSTRAP_NODE: "true"
      }
    }
  });
  delete config["default"];
  await start(config);
  t.pass();
});

test("run a default node", async t => {
  const config = (await import("../src/config.mjs")).default;
  const node = await import("../src/index.mjs");
  await node.start(config);
  t.pass();
});

test("if nodes can be bootstrapped", async t => {
  const config1 = await esmock("../src/config.mjs", {
    process: {
      ...process,
      env: {
        ...process.env,
        IS_BOOTSTRAP_NODE: "true",
        USE_EPHEMERAL_ID: "false"
      }
    }
  });
  delete config1["default"];
  t.true(config1.peerId.isBootstrap);
  t.false(config1.peerId.isEphemeral);
  const node1 = await start(config1);

  const config2 = await esmock("../src/config.mjs", {
    process: {
      ...process,
      env: {
        ...process.env,
        IS_BOOTSTRAP_NODE: "false",
        USE_EPHEMERAL_ID: "true",
        PORT: 0
      }
    }
  });
  delete config2["default"];
  t.false(config2.peerId.isBootstrap);
  t.true(config2.peerId.isEphemeral);

  const handlers2 = {
    "peer:discovery": peer => {
      t.true(
        config2.peerDiscovery.bootstrap.list[0].includes(peer.toB58String())
      );
    }
  };
  const node2 = await start(config2, handlers2);
});
