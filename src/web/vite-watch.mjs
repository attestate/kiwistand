import { build } from "vite";
import chokidar from "chokidar";

import config from "./vite.config.mjs";

async function buildVite() {
  try {
    await build(config);
    console.log("Build completed");
  } catch (error) {
    console.error("Build failed:", error.message);
  }
}

buildVite();

const watcher = chokidar.watch("src", {
  ignored: /(^|[/\\])\../, // Ignore dotfiles
  persistent: true,
});

watcher.on("change", () => {
  console.log("File change detected, rebuilding...");
  buildVite();
});
