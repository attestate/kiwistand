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
})();
