import { env } from "process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  build: {
    outDir: "../public",
    rollupOptions: {
      input: "src/main.jsx",
      output: {
        format: "iife",
        entryFileNames: "bundle.js",
      },
    },
    chunkSizeWarningLimit: 0,
    minify: env.NODE_ENV === "production" ? "terser" : false,
  },
  plugins: [react()],
});
