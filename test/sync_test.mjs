// @format
import test from "ava";
import { pipe } from "it-pipe";
import { pushable } from "it-pushable";
import { toString } from "uint8arrays/to-string";
import { fromString } from "uint8arrays/from-string";
import * as lp from "it-length-prefixed";
import all from "it-all";

import { compareLevels, fromWire, toWire } from "../src/sync.mjs";

test("compare levels of node lists", (t) => {
  const levelA = [
    {
      hash: Buffer.from("00", "hex"),
    },
    {
      hash: Buffer.from("01", "hex"),
    },
  ];
  const levelB = [
    {
      hash: Buffer.from("00", "hex"),
    },
    {
      hash: Buffer.from("01", "hex"),
    },
    {
      hash: Buffer.from("03", "hex"),
    },
  ];
  const results = compareLevels(levelA, levelB);
  t.deepEqual(results, [true, true, false]);
});

test("serializing into wire", async (t) => {
  t.plan(1);
  const message = { hello: "world" };
  const sink = async (source) => {
    const messages = await all(source);
    const sMessages = await pipe(messages, lp.decode(), async (source) => {
      const [msg] = await all(source);
      const sActual = toString(msg.subarray());
      const actual = JSON.parse(sActual);
      t.deepEqual(actual, message);
    });
  };

  await toWire(message, sink);
});

test("serializing from wire", async (t) => {
  t.plan(1);
  const message = { hello: "world" };
  const source = pushable();

  const sMessage = JSON.stringify(message);
  const buf = fromString(sMessage);
  const stream = await pipe([buf], lp.encode());

  const actual = await fromWire(stream);
  t.deepEqual(actual, [message]);
});
