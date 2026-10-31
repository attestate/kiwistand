// The wordmark links to Kiwi News (/), as on every other page of
// news.kiwistand.com. Vocs links its logo to the docs home through its
// client router and has no option for it, so point the logo links at / and
// take plain clicks before the router does. Modified and middle clicks open
// / through the href.
//
// Vocs renders the head's tags twice (in <head> and in <body>), so this file
// runs twice; the flag keeps it to one set of listeners.
(() => {
  const root = document.documentElement;
  if (root.hasAttribute("data-kn-wordmark")) return;
  root.setAttribute("data-kn-wordmark", "");

  const LOGO_LINKS = "[data-v-gutter-logo] a, a[data-v-logo-link]";

  const retarget = (event) => {
    const link = event.target instanceof Element && event.target.closest(LOGO_LINKS);
    if (!link) return null;
    link.setAttribute("href", "/");
    return link;
  };

  for (const type of ["pointerover", "pointerdown", "focusin"]) {
    document.addEventListener(type, retarget, true);
  }

  document.addEventListener(
    "click",
    (event) => {
      const link = retarget(event);
      if (!link) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      event.stopPropagation();
      window.location.assign("/");
    },
    true,
  );
})();
