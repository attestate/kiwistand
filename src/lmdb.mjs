import { open } from "lmdb";

// TODO: Implementation misses a "keys" function, see:
// https://github.com/ethereumjs/ethereumjs-monorepo/pull/2696
export default class LMDB {
  constructor(options) {
    this.path = options.path;
    this.database = open({
      compression: true,
      name: "@ethereumjs/trie",
      // TODO: When we have transitioned to "ordered-binary", then we should
      // make this the default here too. "ordered-binary" allows us to make
      // range queries that e.g. start at a certain date.
      encoding: "cbor",
      keyEncoding: "ordered-binary",
      ...options,
    });
    this.options = options;
  }

  async get(key) {
    return this.database.get(key);
  }

  async put(key, val) {
    await this.database.put(key, val);
  }

  async del(key) {
    await this.database.remove(key);
  }

  async batch(opStack) {
    for (const op of opStack) {
      if (op.type === "put") {
        await this.put(op.key, op.value);
      }

      if (op.type === "del") {
        await this.del(op.key);
      }
    }
  }

  copy() {
    return new LMDB(this.options);
  }
}
