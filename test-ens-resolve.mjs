#!/usr/bin/env node

import { resolve } from "./src/ens.mjs";

const testAddress = "0xee324c588ceF1BF1c1360883E4318834af66366d";

console.log(`Testing _resolve for address: ${testAddress}`);
console.log("Starting resolution...\n");

try {
  const forceFetch = true;
  const result = await resolve(testAddress, forceFetch);
  console.log("Resolution completed successfully!");
  console.log("\nResult:", JSON.stringify(result, null, 2));
} catch (error) {
  console.error("Error resolving address:", error.message);
  console.error("Stack trace:", error.stack);
  process.exit(1);
}
