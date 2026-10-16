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

  // NOTE: Your own profile page (/upvotes?address=<you>) shows "Edit
  // profile", "Saved stories" and the settings gear (views/upvotes.mjs).
  // The page is cached for everyone, so this marks it before the first
  // paint, from this browser's Kiwi key (same key names as above); pages.css
  // then shows them right away instead of when EditProfile.jsx mounts.
  try {
    if (!anonMode && hasKey && location.pathname === '/upvotes') {
      const address = (urlParams.get('address') || '').toLowerCase();
      const own = Object.keys(localStorage).some(function (key) {
        const match = key.match(/^-kiwi-news-(0x[a-fA-F0-9]{40})-key$/);
        return match && match[1].toLowerCase() === address;
      });
      if (own) document.documentElement.setAttribute('data-own-profile', '');
    }
  } catch (err) {}

  // NOTE: The newsletter sign-up cards (newsletter-card.mjs) are server
  // rendered for everyone; NewsletterFeedCard.jsx removes them once the
  // bundle loads for readers who subscribed, dismissed them or browse in anon
  // mode (same keys as shouldHideCard there). Marking that here, before the
  // first paint, lets news.css hide them right away, so a dismissed card
  // doesn't flash and the right column doesn't jump. ?newsletter=test shows
  // them again (shouldHideCard clears the keys).
  try {
    const test = urlParams.get('newsletter') === 'test';
    const hideNewsletter =
      anonMode ||
      !!localStorage.getItem('newsletter-subscribed') ||
      !!localStorage.getItem('newsletter-card-dismissed');
    if (hideNewsletter && !test) {
      document.documentElement.setAttribute('data-nl-hidden', '');
    }
  } catch (err) {}

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
