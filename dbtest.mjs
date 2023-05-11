import LMDB from "./src/lmdb.mjs";
import * as store from "./src/store.mjs";

const db = new LMDB("./anon");
const key =
  "6450d276bb89451a744e0a9e3d186a4ef58d4ca27da0104c219a5b17777f5999a32e4d3e";
console.log(await db.get(key));
console.log(await db.get(Buffer.from(key, "hex")));

const trie = await store.create();
console.log(await trie.get(key));
console.log(await trie.get(Buffer.from(key, "hex")));
