//@format
import test from "ava";
import PeerId from "peer-id";
import { access, unlink } from "fs/promises";
import { constants } from "fs";

import { bootstrap, create, load, store } from "../src/id.mjs";
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

test.serial("if bootstrapping id is working", async t => {
  t.plan(3);
  try {
    await access(idPath, constants.F_OK);
    t.fail();
  } catch (err) {
    t.true(true);
  }
  const peerId = await bootstrap(idPath, config.peerId.options);
  t.true(peerId instanceof PeerId);

  try {
    await access(idPath, constants.F_OK);
    t.pass();
  } catch (err) {
    t.fail();
  }

  t.teardown(teardown);
});

test("if creating an id is possible", async t => {
  const id = await create(config.peerId.options);
  t.true(id instanceof PeerId);
  t.truthy(id);
});

test.serial("if id can be persisted", async t => {
  const id = await create(config.peerId.options);
  await store(idPath, id);

  try {
    await access(idPath, constants.F_OK);
    t.pass();
  } catch (err) {
    t.fail(err.toString());
  }

  t.teardown(teardown);
});

test.serial("loading a non-existent peer id file", async t => {
  await t.throwsAsync(async () => await load(idPath), {
    instanceOf: Error
  });
});

test.serial("if id can be loaded", async t => {
  const id = await create(config.peerId.options);
  await store(idPath, id);
  const peerId = await load(idPath);
  t.true(peerId instanceof PeerId);
  t.is(id.toB58String(), peerId.toB58String());
  t.teardown(teardown);
});
