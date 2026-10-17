(function () {
  // NOTE: This script monitors <img> elements for extremely delayed loading.
  // If an image takes longer than DEFAULT_IMAGE_TIMEOUT to load,
  // its src attribute will be cleared to stop the hanging request.
  // The clock only runs for images the visitor can see: every image goes
  // through the IntersectionObserver, which (unlike a "top < innerHeight"
  // check) knows when an image sits off to the side of a horizontal
  // scroller. The top stories carousel lazy-loads its cards, so the cards
  // to the right never started loading, timed out after 10 s and came up
  // empty when the visitor scrolled to them (half of the session replays
  // logged "Image took too long to load").
  const DEFAULT_IMAGE_TIMEOUT = 10000;

  function expire(img) {
    if (img.complete) return;
    // NOTE: A background tab loads images (and runs timers) on its own
    // schedule; give the image another full timeout once it's shown again.
    if (document.hidden) {
      document.addEventListener("visibilitychange", () => arm(img), {
        once: true,
      });
      return;
    }
    console.warn("Image took too long to load, removing src:", img.src);
    img.src = "";
  }

  function arm(img) {
    const timeoutId = setTimeout(() => expire(img), DEFAULT_IMAGE_TIMEOUT);
    img.addEventListener("load", () => clearTimeout(timeoutId), { once: true });
    img.addEventListener("error", () => clearTimeout(timeoutId), {
      once: true,
    });
  }

  function setupImageTimeout(img) {
    if (!img.dataset.timeoutSet) {
      img.dataset.timeoutSet = "true";
      arm(img);
    }
  }

  // Use IntersectionObserver to only monitor visible images
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        // Only set timeout for images that are now visible
        setupImageTimeout(entry.target);
        // Stop observing once we've handled this image
        observer.unobserve(entry.target);
      }
    });
  });

  function watch(img) {
    // No need to observe already loaded (or failed) images
    if (!img.complete) observer.observe(img);
  }

  // Process images already in the DOM
  document.querySelectorAll("img").forEach(watch);

  // MutationObserver for new images
  const mutationObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          if (node.tagName === "IMG") {
            watch(node);
          } else {
            node.querySelectorAll && node.querySelectorAll("img").forEach(watch);
          }
        }
      });
    });
  });

  mutationObserver.observe(document.body, { childList: true, subtree: true });
})();
