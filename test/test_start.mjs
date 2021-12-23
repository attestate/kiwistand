// @format
import test from "ava";
import esmock from "esmock";
import process from "process";

import { start } from "../src/index.mjs";

test.serial(
  "run as bootstrap node but without correct default port",
  async t => {
    await t.throwsAsync(async () => {
      await esmock("../src/config.mjs", {
        process: {
          ...process,
          env: {
            ...process.env,
            BIND_ADDRESS_V4: "127.0.0.1",
            PORT: "1234",
            USE_EPHEMERAL_ID: "false",
            IS_BOOTSTRAP_NODE: "true"
          }
        }
      });
    });
  }
);

test.serial("run as bootstrap node", async t => {
  const config = await esmock("../src/config.mjs", {
    process: {
      ...process,
      env: {
        ...process.env,
        BIND_ADDRESS_V4: "127.0.0.1",
        PORT: "53462",
        USE_EPHEMERAL_ID: "false",
        IS_BOOTSTRAP_NODE: "true"
      }
    }
  });
  delete config["default"];
  const node = await start(config);
  await node.stop();
  t.pass();
});

test.serial("run a default node that gets bootstrapped", async t => {
  const config = (await import("../src/config.mjs")).default;
  const node = await import("../src/index.mjs");

  let publicNode;
  const handlers = {
    "peer:discovery": peer => {
      publicNode = peer;
    }
  };
  const n1 = await node.start(config, handlers);
  t.truthy(publicNode);
  t.true(
    config.config.peerDiscovery.bootstrap.list[0].includes(
      publicNode.toB58String()
    )
  );

  await n1.stop();
});

test.serial("if nodes can be bootstrapped", async t => {
  t.plan(2);
  const config1 = await esmock("../src/config.mjs", {
    process: {
      ...process,
      env: {
        ...process.env,
        PORT: "53462",
        BIND_ADDRESS_V4: "127.0.0.1",
        IS_BOOTSTRAP_NODE: "true",
        USE_EPHEMERAL_ID: "false"
      }
    }
  });
  delete config1["default"];
  delete config1["esmockKey"];
  const node1 = await start(config1);

  const config2 = await esmock("../src/config.mjs", {
    process: {
      ...process,
      env: {
        ...process.env,
        BIND_ADDRESS_V4: "127.0.0.1",
        IS_BOOTSTRAP_NODE: "false",
        USE_EPHEMERAL_ID: "true",
        PORT: "0"
      }
    }
  });
  delete config2["default"];

  let discovery;
  const handlers2 = {
    "peer:discovery": peer => {
      discovery = peer;
    }
  };
  const node2 = await start(config2, handlers2);
  t.truthy(discovery);
  t.true(
    config2.config.peerDiscovery.bootstrap.list[0].includes(
      discovery.toB58String()
    )
  );
  await node1.stop();
  await node2.stop();
});
