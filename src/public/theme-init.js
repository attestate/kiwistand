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
})();
