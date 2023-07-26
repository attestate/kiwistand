import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import rollupNodePolyFill from "rollup-plugin-node-polyfills";
import commonjs from "@rollup/plugin-commonjs";

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      util: "rollup-plugin-node-polyfills/polyfills/util",
      buffer: "rollup-plugin-node-polyfills/polyfills/buffer-es6",
      process: "rollup-plugin-node-polyfills/polyfills/process-es6",
    },
  },
  build: {
    outDir: "../public",
    manifest: true,
    rollupOptions: {
      input: "src/main.jsx",
    },
    minify: mode === "build" ? "esbuild" : false,
  },
  server: {
    cors: true,
    origin: "http://localhost:4000",
  },
  plugins: [react(), commonjs(), rollupNodePolyFill()],
}));
