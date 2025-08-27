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
  const devHost = process.env.CUSTOM_HOST_NAME || "localhost:5173";
  const devOrigin =
    (process.env.CUSTOM_PROTOCOL === "https://" ? "https://" : "http://") +
    devHost;
  return {
    optimizeDeps: {
      // Prebundle commonly used deps at startup to avoid on-demand 504s
      include: [
        "@ethersproject/contracts",
        "@ethersproject/providers",
        "@ethersproject/wallet",
        "@ethersproject/units",
        "@tanstack/react-query",
        "@rainbow-me/rainbowkit",
        "wagmi",
        "viem",
        "react",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "react-dom",
        "react-dom/client",
        "pulltorefreshjs",
        "posthog-js",
        "@farcaster/frame-sdk",
      ],
      entries: ["src/main.jsx"],
      // Ensure fresh optimization when server restarts
      force: true,
    },
    build: {
      outDir: "../public",
      manifest: true,
      rollupOptions: {
        input: "src/main.jsx",
        plugins: [],
        output: {
          // Manual chunk splitting to reduce unused JavaScript
          manualChunks: {
            // Split vendor code into separate chunks
            "react-vendor": ["react", "react-dom"],
            "ui-vendor": ["@mui/material", "@emotion/react", "@emotion/styled"],
            "wallet-vendor": ["@rainbow-me/rainbowkit", "wagmi", "viem"],
          },
          // Use smaller chunks
          chunkFileNames: "assets/[name]-[hash].js",
          entryFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash].[ext]",
        },
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
      host: hostname,
      port: parseInt(port),
      cors: true,
      https,
      origin: devOrigin,
    },
    plugins: [react(), nodePolyfills()],
  };
});
