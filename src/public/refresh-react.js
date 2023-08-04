async function loadRefreshRuntime() {
   const protocol = window.location.protocol;
   const hostname = window.location.hostname;
   const port = "5173"; // Default vite port

   const url = `${protocol}//${hostname}:${port}/@react-refresh`;

   const RefreshRuntime = await import(url);

   RefreshRuntime.injectIntoGlobalHook(window);
   window.$RefreshReg$ = () => {};
   window.$RefreshSig$ = () => type => type;
   window.__vite_plugin_react_preamble_installed__ = true;
 }

 loadRefreshRuntime();
