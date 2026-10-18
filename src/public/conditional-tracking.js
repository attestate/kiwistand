// Conditionally load tracking scripts
(function() {
  // Our own page speed checks (scripts/pagespeed) and Lighthouse aren't
  // visitors.
  // NOTE: Lighthouse's emulated user agent is a plain Chrome one (no
  // "Chrome-Lighthouse" since Lighthouse 10), so its runs only show up as
  // automated through navigator.webdriver, which headless and
  // automation-controlled Chrome (Lighthouse, Playwright, Puppeteer,
  // Selenium) set. Each run is a fresh browser, so every one counted as a new
  // user in Google Analytics: 30 per page speed check after a deploy.
  // posthog-js drops these on its own for the same reason.
  if (
    navigator.webdriver ||
    /KiwiPagespeed|Chrome-Lighthouse|HeadlessChrome/.test(navigator.userAgent)
  ) {
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
  var analyticsLoaded = false;
  function loadAnalytics() {
    if (analyticsLoaded) return;
    analyticsLoaded = true;
    ['pointerdown', 'keydown', 'scroll'].forEach(function (type) {
      window.removeEventListener(type, loadAnalytics, true);
    });

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
  ['pointerdown', 'keydown', 'scroll'].forEach(function (type) {
    window.addEventListener(type, loadAnalytics, { capture: true, passive: true });
  });
  function afterLoad() {
    setTimeout(loadAnalytics, 5000);
  }
  if (document.readyState === 'complete') afterLoad();
  else window.addEventListener('load', afterLoad, { once: true });

  // Load instantpage.js
  var instant = document.createElement('script');
  instant.async = true;
  instant.type = 'module';
  instant.src = 'instantpage.js';
  document.body.appendChild(instant);
})();
