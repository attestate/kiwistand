import test from "ava";
import { Wallet } from "ethers";

import { create } from "../src/web/src/delegation.mjs";
import { verify } from "../src/delegations.mjs";

test("the website's delegation is one the node takes", async (t) => {
  const key = Wallet.createRandom();
  const wallet = Wallet.createRandom();
  const { message, signature } = await create(key, wallet, wallet.address);
  t.is(message.key, key.address);
  t.is(await verify({ ...message, signature }, ""), wallet.address);
});
