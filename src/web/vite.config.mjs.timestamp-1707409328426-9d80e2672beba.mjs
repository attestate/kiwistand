// vite.config.mjs
import { defineConfig } from "file:///Users/maciek/kiwistand/src/web/node_modules/vite/dist/node/index.js";
import react from "file:///Users/maciek/kiwistand/src/web/node_modules/@vitejs/plugin-react-swc/index.mjs";
import { nodePolyfills } from "file:///Users/maciek/kiwistand/src/web/node_modules/vite-plugin-node-polyfills/dist/index.js";
var vite_config_default = defineConfig(({ mode }) => {
  return {
    build: {
      outDir: "../public",
      manifest: true,
      rollupOptions: {
        input: "src/main.jsx",
        plugins: []
      }
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
      minifyWhitespace: mode === "production"
    },
    server: {
      cors: true,
      origin: "http://localhost:4000"
    },
    plugins: [react(), nodePolyfills()]
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcubWpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL1VzZXJzL21hY2llay9raXdpc3RhbmQvc3JjL3dlYlwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL1VzZXJzL21hY2llay9raXdpc3RhbmQvc3JjL3dlYi92aXRlLmNvbmZpZy5tanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL21hY2llay9raXdpc3RhbmQvc3JjL3dlYi92aXRlLmNvbmZpZy5tanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdC1zd2NcIjtcbmltcG9ydCB7IG5vZGVQb2x5ZmlsbHMgfSBmcm9tIFwidml0ZS1wbHVnaW4tbm9kZS1wb2x5ZmlsbHNcIjtcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfSkgPT4ge1xuICByZXR1cm4ge1xuICAgIGJ1aWxkOiB7XG4gICAgICBvdXREaXI6IFwiLi4vcHVibGljXCIsXG4gICAgICBtYW5pZmVzdDogdHJ1ZSxcbiAgICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgICAgaW5wdXQ6IFwic3JjL21haW4uanN4XCIsXG4gICAgICAgIHBsdWdpbnM6IFtdLFxuICAgICAgfSxcbiAgICAgIC8vIE5PVEU6IHZpdGUgaXMgYnJva2VuIGFuZCBzbyB3aGVuIHdlIHNldCBtaW5pZnkgaW4gYnVpbGQgdGhlbiBpdCdsbCBub3RcbiAgICAgIC8vIG1pbmlmeSBpbiB0aGUgbW9zdCBleHRyZW1lIHdheSBwb3NzaWJsZSB1c2luZyBlc2J1aWxkLiBJbnN0ZWFkLCB3ZSBoYXZlXG4gICAgICAvLyB0byBkbyB0aGlzIGJ5IG1hbnVhbGx5IGRlZmluaW5nIGVzYnVpbGQgYXMgYSBwcm9wZXJ0eSBpbiB0aGUgY29uZmlnLlxuICAgICAgLy8gUFIgdGhhdCBmaXhlcyB0aGlzOiBodHRwczovL2dpdGh1Yi5jb20vdml0ZWpzL3ZpdGUvcHVsbC84NzU0L2ZpbGVzI1xuICAgICAgLy9taW5pZnk6IG1vZGUgPT09IFwiYnVpbGRcIiA/IFwiZXNidWlsZFwiIDogZmFsc2UsXG4gICAgfSxcbiAgICBlc2J1aWxkOiB7XG4gICAgICBtaW5pZnk6IG1vZGUgPT09IFwicHJvZHVjdGlvblwiLFxuICAgICAgbWluaWZ5SWRlbnRpZmllcnM6IG1vZGUgPT09IFwicHJvZHVjdGlvblwiLFxuICAgICAgbWluaWZ5U3ludGF4OiBtb2RlID09PSBcInByb2R1Y3Rpb25cIixcbiAgICAgIG1pbmlmeVdoaXRlc3BhY2U6IG1vZGUgPT09IFwicHJvZHVjdGlvblwiLFxuICAgIH0sXG4gICAgc2VydmVyOiB7XG4gICAgICBjb3JzOiB0cnVlLFxuICAgICAgb3JpZ2luOiBcImh0dHA6Ly9sb2NhbGhvc3Q6NDAwMFwiLFxuICAgIH0sXG4gICAgcGx1Z2luczogW3JlYWN0KCksIG5vZGVQb2x5ZmlsbHMoKV0sXG4gIH07XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBaVIsU0FBUyxvQkFBb0I7QUFDOVMsT0FBTyxXQUFXO0FBQ2xCLFNBQVMscUJBQXFCO0FBRTlCLElBQU8sc0JBQVEsYUFBYSxDQUFDLEVBQUUsS0FBSyxNQUFNO0FBQ3hDLFNBQU87QUFBQSxJQUNMLE9BQU87QUFBQSxNQUNMLFFBQVE7QUFBQSxNQUNSLFVBQVU7QUFBQSxNQUNWLGVBQWU7QUFBQSxRQUNiLE9BQU87QUFBQSxRQUNQLFNBQVMsQ0FBQztBQUFBLE1BQ1o7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFNRjtBQUFBLElBQ0EsU0FBUztBQUFBLE1BQ1AsUUFBUSxTQUFTO0FBQUEsTUFDakIsbUJBQW1CLFNBQVM7QUFBQSxNQUM1QixjQUFjLFNBQVM7QUFBQSxNQUN2QixrQkFBa0IsU0FBUztBQUFBLElBQzdCO0FBQUEsSUFDQSxRQUFRO0FBQUEsTUFDTixNQUFNO0FBQUEsTUFDTixRQUFRO0FBQUEsSUFDVjtBQUFBLElBQ0EsU0FBUyxDQUFDLE1BQU0sR0FBRyxjQUFjLENBQUM7QUFBQSxFQUNwQztBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
