import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { nodePolyfills } from "vite-plugin-node-polyfills";

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
      origin: "http://localhost:4000",
    },
    plugins: [react(), nodePolyfills()],
  };
});
