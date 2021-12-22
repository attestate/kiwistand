// @format
import test from "ava";
import esmock from "esmock";
import { once } from "events";
import { env } from "process";

test("if nodes can be bootstrapped", async t => {
  const config1 = await esmock("../src/config.mjs", {
    process: {
      env: {
        ...env,
        IS_BOOTSTRAP_NODE: "true"
      }
    }
  });
  t.true(config1.peerId.isBootstrap);
  t.false(config1.peerId.isEphemeral);
  const bootstrapNode = await esmock(
    "../src/index.mjs",
    {},
    {
      "../src/config.mjs": config1
    }
  );
  const node1 = await bootstrapNode.start();

  const config2 = await esmock("../src/config.mjs", {
    process: {
      env: {
        ...env,
        IS_BOOTSTRAP_NODE: "false",
        USE_EPHEMERAL_ID: "true",
        PORT: 0
      }
    }
  });
  t.false(config2.peerId.isBootstrap);
  t.true(config2.peerId.isEphemeral);

  const followerNode = await esmock(
    "../src/index.mjs",
    {},
    {
      "../src/config.mjs": config2
    }
  );

  const handlers = {
    "peer:discovery": peer => {
      t.true(
        config2.peerDiscovery.bootstrap.list[0].includes(peer.toB58String())
      );
    }
  };
  const node2 = await followerNode.start(handlers);
});
