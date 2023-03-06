import { open } from "lmdb";

export default class LMDB {
  constructor(path) {
    this.path = path;
    this.database = open({
      compression: true,
      // TODO: Potentially, we should rename this.
      name: "@ethereumjs/trie",
      path,
    });
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
    return new LMDB(this.path);
  }
}
