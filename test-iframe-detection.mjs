import { metadata } from "./src/parser.mjs";

const testUrl = "https://teia.art/";

console.log("Testing iframe detection for:", testUrl);

try {
  const result = await metadata(testUrl);
  console.log("\nResult:");
  console.log("canIframe:", result.canIframe);
  console.log("domain:", result.domain);
  console.log("ogTitle:", result.ogTitle);
} catch (error) {
  console.error("Error:", error.message);
}

process.exit(0);