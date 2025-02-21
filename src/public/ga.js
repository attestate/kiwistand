window.dataLayer = window.dataLayer || [];
function gtag() {
  dataLayer.push(arguments);
}
gtag("js", new Date());

const key = "G-21BKTD0NKN"; // Measurement ID for Google Analytics; this tag is used in gtag("config", ...)
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
// By configuring the measurement ID with gtag("config", key),
// all subsequent events automatically use that key.
// Therefore, there is no need to add a "send_to" parameter in trackEvent.
window.trackEvent = function(eventName, params) {
  if (typeof gtag === "function") {
    gtag("event", eventName, params);
  }
};
