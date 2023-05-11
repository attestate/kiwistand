import { open } from "lmdb";

export default class LMDB {
  constructor(path, encoding = "cbor") {
    this.path = path;
    this.database = open({
      compression: true,
      // TODO: Rename
      name: "@ethereumjs/trie",
      encoding,
      path,
    });
  }

  async keys() {
    return this.database.getKeys();
  }

  async get(key) {
    return this.database.get(key);
  }

  async put(key, val) {
    await this.database.put(key, val);
  }

  async del(key) {
    console.log("deleting");
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
