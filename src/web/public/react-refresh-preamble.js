// React Fast Refresh preamble for Vite dev server
// Served by Vite (public/), so imports resolve against the Vite origin
import RefreshRuntime from "/@react-refresh";

RefreshRuntime.injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => (type) => type;
window.__vite_plugin_react_preamble_installed__ = true;

