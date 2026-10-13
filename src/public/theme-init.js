// Theme initialization - must run before CSS render
(function() {
  // Check if ?anon query parameter is present
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('anon') !== null) {
    localStorage.setItem('anon-mode', 'true');

    // Remove the ?anon parameter from URL
    urlParams.delete('anon');
    const newUrl = urlParams.toString()
      ? `${window.location.pathname}?${urlParams.toString()}`
      : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  }

  // NOTE: Whether this browser may be tracked (Google Analytics, PostHog,
  // the /impression, /outbound and /share beacons). Off after "Opt Out" on the
  // consent banner, in anon mode, and while anon-rpc is on. Same rule as
  // trackingAllowed in src/web/src/tracking.mjs; read on every call, so
  // turning anon-rpc on takes effect without a reload.
  window.kiwiTrackingOff = function () {
    try {
      return (
        localStorage.getItem('anon-mode') === 'true' ||
        localStorage.getItem('kiwi-private-rpc') === 'true' ||
        localStorage.getItem('kiwi-analytics-consent') === 'false'
      );
    } catch (err) {
      return false;
    }
  };

  const anonMode = localStorage.getItem('anon-mode') === 'true';
  if (anonMode) {
    document.documentElement.setAttribute('data-theme', 'anon');
  }

  // NOTE: Lets CSS reserve the right space for what the app renders for
  // people without a Kiwi key (e.g. a "connect to comment" card instead of
  // the comment box), so the page doesn't jump when it mounts. Same check as
  // getLocalAccount in src/web/src/session.mjs.
  const hasKey = Object.keys(localStorage).some(function (key) {
    return /^-kiwi-news-0x[a-fA-F0-9]{40}-key$/.test(key);
  });
  if (!anonMode && !hasKey) {
    document.documentElement.setAttribute('data-signed-out', '');
  }

  // NOTE: The "Kiwi News for iPhone" TestFlight card (testflight-card.mjs) is for iPhone
  // Safari visitors, not inside a Farcaster mini app (an iframe) or a home
  // screen web app. Hidden for good after "x", and for 30 days after a tap.
  try {
    const iPhone = /iPhone|iPod/.test(navigator.userAgent);
    const embedded = window.self !== window.top || window.navigator.standalone;
    const dismissed = localStorage.getItem('kiwi-tf-card-dismissed');
    const tapped = Number(localStorage.getItem('kiwi-tf-card-tapped')) || 0;
    const recentlyTapped = Date.now() - tapped < 30 * 24 * 60 * 60 * 1000;
    if (iPhone && !embedded && !dismissed && !recentlyTapped) {
      document.documentElement.setAttribute('data-tf-card', '');
    }
  } catch (err) {}
})();
