// vite.config.mjs
import { defineConfig } from "file:///Users/maciek/kiwistand/src/web/node_modules/vite/dist/node/index.js";
import react from "file:///Users/maciek/kiwistand/src/web/node_modules/@vitejs/plugin-react-swc/index.mjs";
import { nodePolyfills } from "file:///Users/maciek/kiwistand/src/web/node_modules/vite-plugin-node-polyfills/dist/index.js";
var vite_config_default = defineConfig(({ mode }) => ({
  build: {
    outDir: "../public",
    manifest: true,
    rollupOptions: {
      input: "src/main.jsx",
      plugins: []
    },
    minify: mode === "build" ? "esbuild" : false
  },
  server: {
    cors: true,
    origin: "http://localhost:4000"
  },
  plugins: [react(), nodePolyfills()]
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcubWpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL1VzZXJzL21hY2llay9raXdpc3RhbmQvc3JjL3dlYlwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL1VzZXJzL21hY2llay9raXdpc3RhbmQvc3JjL3dlYi92aXRlLmNvbmZpZy5tanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL21hY2llay9raXdpc3RhbmQvc3JjL3dlYi92aXRlLmNvbmZpZy5tanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdC1zd2NcIjtcbmltcG9ydCB7IG5vZGVQb2x5ZmlsbHMgfSBmcm9tIFwidml0ZS1wbHVnaW4tbm9kZS1wb2x5ZmlsbHNcIjtcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfSkgPT4gKHtcbiAgYnVpbGQ6IHtcbiAgICBvdXREaXI6IFwiLi4vcHVibGljXCIsXG4gICAgbWFuaWZlc3Q6IHRydWUsXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgaW5wdXQ6IFwic3JjL21haW4uanN4XCIsXG4gICAgICBwbHVnaW5zOiBbXSxcbiAgICB9LFxuICAgIG1pbmlmeTogbW9kZSA9PT0gXCJidWlsZFwiID8gXCJlc2J1aWxkXCIgOiBmYWxzZSxcbiAgfSxcbiAgc2VydmVyOiB7XG4gICAgY29yczogdHJ1ZSxcbiAgICBvcmlnaW46IFwiaHR0cDovL2xvY2FsaG9zdDo0MDAwXCIsXG4gIH0sXG4gIHBsdWdpbnM6IFtyZWFjdCgpLCBub2RlUG9seWZpbGxzKCldLFxufSkpO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFpUixTQUFTLG9CQUFvQjtBQUM5UyxPQUFPLFdBQVc7QUFDbEIsU0FBUyxxQkFBcUI7QUFFOUIsSUFBTyxzQkFBUSxhQUFhLENBQUMsRUFBRSxLQUFLLE9BQU87QUFBQSxFQUN6QyxPQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsSUFDUixVQUFVO0FBQUEsSUFDVixlQUFlO0FBQUEsTUFDYixPQUFPO0FBQUEsTUFDUCxTQUFTLENBQUM7QUFBQSxJQUNaO0FBQUEsSUFDQSxRQUFRLFNBQVMsVUFBVSxZQUFZO0FBQUEsRUFDekM7QUFBQSxFQUNBLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLFFBQVE7QUFBQSxFQUNWO0FBQUEsRUFDQSxTQUFTLENBQUMsTUFBTSxHQUFHLGNBQWMsQ0FBQztBQUNwQyxFQUFFOyIsCiAgIm5hbWVzIjogW10KfQo=
