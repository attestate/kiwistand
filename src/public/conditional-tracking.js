// Conditionally load tracking scripts only if not in anon mode. Google
// Analytics also stays off after "Opt Out" on the consent banner and while
// anon-rpc is on (window.kiwiTrackingOff, see theme-init.js).
(function() {
  if (typeof localStorage !== 'undefined' && localStorage.getItem('anon-mode') === 'true') {
    // Skip all tracking in anon mode
    return;
  }

  // Our own page speed checks (scripts/pagespeed) and Lighthouse aren't
  // visitors.
  if (/KiwiPagespeed|Chrome-Lighthouse/.test(navigator.userAgent)) {
    return;
  }

  // Skip all tracking in iOS native app
  if (document.documentElement.classList.contains('kiwi-ios-app')) {
    return;
  }

  // NOTE: Google Analytics (~180KB of script) used to load while the page
  // was still starting up, costing about half a second of main-thread time
  // on a phone. It now loads on the first interaction, or 5s after the page
  // has loaded. Visits that leave sooner without touching the page aren't
  // counted. Same rule for PostHog in src/web/src/main.jsx.
  function trackingOff() {
    return Boolean(window.kiwiTrackingOff && window.kiwiTrackingOff());
  }
  var analyticsLoaded = trackingOff();
  // NOTE: Touching "Opt Out", the Settings analytics switch or the anon-rpc
  // switch is no reason to start Google Analytics: the pointerdown comes
  // before the click that turns tracking off.
  var PRIVACY_CONTROLS = '#analytics-consent-container, .private-rpc-setting, .n2-set-analytics';
  function loadAnalytics(event) {
    if (analyticsLoaded) return;
    var target = event && event.target;
    if (target && target.closest && target.closest(PRIVACY_CONTROLS)) return;
    analyticsLoaded = true;
    ['pointerdown', 'keydown', 'scroll'].forEach(function (type) {
      window.removeEventListener(type, loadAnalytics, true);
    });
    // The visitor may have opted out or turned anon-rpc on in the meantime.
    if (trackingOff()) return;

    // Load Google Tag Manager
    var gtag = document.createElement('script');
    gtag.async = true;
    gtag.src = 'https://www.googletagmanager.com/gtag/js?id=G-21BKTD0NKN';
    document.body.appendChild(gtag);

    // Load ga.js
    var ga = document.createElement('script');
    ga.async = true;
    ga.src = 'ga.js';
    document.body.appendChild(ga);
  }
  if (!analyticsLoaded) {
    ['pointerdown', 'keydown', 'scroll'].forEach(function (type) {
      window.addEventListener(type, loadAnalytics, { capture: true, passive: true });
    });
    var afterLoad = function () {
      setTimeout(loadAnalytics, 5000);
    };
    if (document.readyState === 'complete') afterLoad();
    else window.addEventListener('load', afterLoad, { once: true });
  }

  // Load instantpage.js
  var instant = document.createElement('script');
  instant.async = true;
  instant.type = 'module';
  instant.src = 'instantpage.js';
  document.body.appendChild(instant);
})();
