import { defineConfig } from "vite";
import fs from "fs";
import react from "@vitejs/plugin-react-swc";
import { nodePolyfills } from "vite-plugin-node-polyfills";

let https = false;
if (
  process.env.CUSTOM_HOST_NAME === "staging.kiwistand.com:5173" &&
  process.env.CUSTOM_PROTOCOL === "https://"
) {
  https = {
    key: fs.readFileSync("../../staging.kiwistand.com/key.pem"),
    cert: fs.readFileSync("../../staging.kiwistand.com/cert.pem"),
    rejectUnauthorized: false,
  };
} else if (process.env.CUSTOM_PROTOCOL === "https://") {
  https = {
    key: fs.readFileSync("../../certificates/key.pem"),
    cert: fs.readFileSync("../../certificates/cert.pem"),
    rejectUnauthorized: false,
  };
}

export default defineConfig(({ mode }) => {
  return {
    build: {
      outDir: "../public",
      manifest: true,
      rollupOptions: {
        input: "src/main.jsx",
        plugins: [],
      },
      // NOTE: vite is broken and so when we set minify in build then it'll not
      // minify in the most extreme way possible using esbuild. Instead, we have
      // to do this by manually defining esbuild as a property in the config.
      // PR that fixes this: https://github.com/vitejs/vite/pull/8754/files#
      //minify: mode === "build" ? "esbuild" : false,
    },
    esbuild: {
      minify: mode === "production",
      minifyIdentifiers: mode === "production",
      minifySyntax: mode === "production",
      minifyWhitespace: mode === "production",
    },
    server: {
      cors: true,
      https,
      origin:
        process.env.CUSTOM_PROTOCOL === "https://"
          ? "https://kazoo.local:5173"
          : "http://kazoo.local:5173",
    },
    plugins: [react(), nodePolyfills()],
  };
});
