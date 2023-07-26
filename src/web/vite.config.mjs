import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig(({ mode }) => ({
  build: {
    outDir: "../public",
    manifest: true,
    rollupOptions: {
      input: "src/main.jsx",
      plugins: [],
    },
    minify: mode === "build" ? "esbuild" : false,
  },
  server: {
    cors: true,
    origin: "http://localhost:4000",
  },
  plugins: [react(), nodePolyfills()],
}));
