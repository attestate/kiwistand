// Theme initialization - must run before CSS render
(function() {
  // Check if ?anon query parameter is present
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('anon') !== null) {
    localStorage.setItem('anon-mode', 'true');
  }

  const anonMode = localStorage.getItem('anon-mode') === 'true';
  if (anonMode) {
    document.documentElement.setAttribute('data-theme', 'anon');
  }
})();
