//@format
import test from "ava";
import { access, unlink } from "fs/promises";
import { constants } from "fs";
import { createSecp256k1PeerId } from "@libp2p/peer-id-factory";

import { bootstrap, load, store } from "../src/id.mjs";
import config from "../src/config.mjs";
import { appdir } from "../src/utils.mjs";

const idPath = `${appdir()}/test/.keys.json`;

async function teardown(t) {
  try {
    await access(idPath, constants.F_OK);
  } catch {
    return;
  }

  await unlink(idPath);
}

test.serial("if bootstrapping id is working", async (t) => {
  try {
    await access(idPath, constants.F_OK);
    t.fail();
  } catch (err) {
    t.true(true);
  }
  const peerId = await bootstrap(idPath);

  try {
    await access(idPath, constants.F_OK);
    t.pass();
  } catch (err) {
    t.log(err);
    t.fail();
  }

  t.teardown(teardown);
});

test.serial("if id can be persisted", async (t) => {
  const id = await createSecp256k1PeerId();
  await store(idPath, id);

  try {
    await access(idPath, constants.F_OK);
    t.pass();
  } catch (err) {
    t.fail(err.toString());
  }

  t.teardown(teardown);
});

test.serial("loading a non-existent peer id file", async (t) => {
  await t.throwsAsync(async () => await load(idPath), {
    instanceOf: Error,
  });
});

test.serial("if id can be loaded", async (t) => {
  const id = await createSecp256k1PeerId();
  await store(idPath, id);
  const peerId = await load(idPath);
  t.is(id.toString(), peerId.toString());
  t.teardown(teardown);
});
