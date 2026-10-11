// Conditionally load tracking scripts only if not in anon mode
(function() {
  if (typeof localStorage !== 'undefined' && localStorage.getItem('anon-mode') === 'true') {
    // Skip all tracking in anon mode
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
