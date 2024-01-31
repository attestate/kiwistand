window.dataLayer = window.dataLayer || [];
function gtag() {
  dataLayer.push(arguments);
}
gtag("js", new Date());

const key = "G-21BKTD0NKN";
gtag("config", key);

const isPWA = window.matchMedia("(display-mode: standalone)").matches;
const schema = /^-kiwi-news-(0x[a-fA-F0-9]{40})-key$/;
const usesDelegation = Object.keys(localStorage).some((key) =>
  schema.test(key),
);

gtag("config", key, {
  pwa_mode: isPWA ? "Standalone" : "Not Standalone",
  uses_delegation: usesDelegation ? "Delegation" : "Wallet Connection",
});
