// Writes src/chainstate/delegations.json, the delegations snapshot: every
// delegation a node has now from OP Mainnet (Delegator2's, from
// historical-delegations.json, and Delegator3's), signers to identities.
// With it in the repo, nodes stop crawling OP Mainnet and delegations are
// protocol messages (src/delegations.mjs). Run it on the production node
// right before the cutover; the genesis commits the hash it prints:
//
//   node scripts/delegations-snapshot.mjs [url]
//
// `url` is the node's GET /api/v1/delegations, by default
// https://news.kiwistand.com:8443/api/v1/delegations.
import { argv } from "process";
import { writeFileSync } from "fs";

import { keccak256 } from "viem";

const url = argv[2] ?? "https://news.kiwistand.com:8443/api/v1/delegations";
const { data } = await (await fetch(url)).json();
const sorted = Object.fromEntries(
  Object.keys(data)
    .sort()
    .map((key) => [key, data[key]]),
);
const content = `${JSON.stringify(sorted, null, 2)}\n`;
const path = new URL("../src/chainstate/delegations.json", import.meta.url);
writeFileSync(path, content);
console.log(`${Object.keys(sorted).length} delegations`);
console.log(`keccak256: ${keccak256(Buffer.from(content))}`);
