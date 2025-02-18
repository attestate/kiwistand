(function () {
  // NOTE: This script monitors <img> elements for extremely delayed loading.
  // If an image takes longer than DEFAULT_IMAGE_TIMEOUT to load,
  // its src attribute will be cleared to stop the hanging request.
  const DEFAULT_IMAGE_TIMEOUT = 10000;

  function handleImage(img) {
    if (!img.dataset.timeoutSet) {
      img.dataset.timeoutSet = "true";
      const timeoutId = setTimeout(() => {
        if (!img.complete) {
          console.warn("Image took too long to load, removing src:", img);
          img.src = "";
        }
      }, DEFAULT_IMAGE_TIMEOUT);
      img.addEventListener("load", () => clearTimeout(timeoutId));
      img.addEventListener("error", () => clearTimeout(timeoutId));
    }
  }

  // Process images already in the DOM
  document.querySelectorAll("img").forEach(handleImage);

  // Use a MutationObserver to monitor for new image elements added to the DOM
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          if (node.tagName === "IMG") {
            handleImage(node);
          } else {
            node.querySelectorAll &&
              node.querySelectorAll("img").forEach(handleImage);
          }
        }
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
