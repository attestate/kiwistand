// @anon-rpc/browser-harness@0.3.2 dist/iframe-boot.js, unchanged: the boot
// code of the Private RPC iframe (anon-rpc-iframe.html, see
// src/web/src/anon-transport.mjs). Replace it when the package is updated.
"use strict";
(() => {
  // src/iframe/iframe-boot.ts
  (() => {
    parent.postMessage({ kind: "iframe-ready" }, "*");
    const onInit = (ev) => {
      if (ev.source !== parent || ev.data?.kind !== "init") return;
      removeEventListener("message", onInit);
      const port = ev.ports[0];
      const runtimeSource = ev.data.runtimeSource;
      const bundleBytes = ev.data.bundleBytes;
      const blob = new Blob([runtimeSource], { type: "text/javascript" });
      const worker = new Worker(URL.createObjectURL(blob));
      worker.postMessage({ kind: "init", port, bundleBytes, config: ev.data.config }, [port]);
      worker.addEventListener("error", (e) => {
        parent.postMessage({ kind: "worker-error", message: e.message }, "*");
      });
    };
    addEventListener("message", onInit);
  })();
})();
