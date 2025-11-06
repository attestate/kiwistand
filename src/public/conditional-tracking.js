// Conditionally load tracking scripts only if not in anon mode
(function() {
  if (typeof localStorage !== 'undefined' && localStorage.getItem('anon-mode') === 'true') {
    // Skip all tracking in anon mode
    return;
  }

  // Load Google Tag Manager
  var gtag = document.createElement('script');
  gtag.defer = true;
  gtag.src = 'https://www.googletagmanager.com/gtag/js?id=G-21BKTD0NKN';
  document.body.appendChild(gtag);

  // Load ga.js
  var ga = document.createElement('script');
  ga.defer = true;
  ga.src = 'ga.js';
  document.body.appendChild(ga);

  // Load instantpage.js
  var instant = document.createElement('script');
  instant.async = true;
  instant.type = 'module';
  instant.src = 'instantpage.js';
  document.body.appendChild(instant);
})();
