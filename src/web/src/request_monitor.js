(function () {
  // NOTE: This script monitors <img> elements for extremely delayed loading.
  // If an image takes longer than DEFAULT_IMAGE_TIMEOUT to load,
  // its src attribute will be cleared to stop the hanging request.
  // Now uses IntersectionObserver to only apply timeouts to visible images.
  const DEFAULT_IMAGE_TIMEOUT = 10000;

  function setupImageTimeout(img) {
    if (!img.dataset.timeoutSet) {
      img.dataset.timeoutSet = "true";
      const timeoutId = setTimeout(() => {
        if (!img.complete) {
          console.warn("Image took too long to load, removing src:", img.src);
          img.src = "";
        }
      }, DEFAULT_IMAGE_TIMEOUT);
      img.addEventListener("load", () => clearTimeout(timeoutId));
      img.addEventListener("error", () => clearTimeout(timeoutId));
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

  // Process images already in the DOM
  document.querySelectorAll("img").forEach((img) => {
    // Check if the image is already loaded or has an error
    if (img.complete) {
      // No need to observe already loaded images
      return;
    }

    // For images above the fold that are loading immediately
    if (img.getBoundingClientRect().top < window.innerHeight) {
      setupImageTimeout(img);
    } else {
      // For images below the fold, observe them
      observer.observe(img);
    }
  });

  // MutationObserver for new images
  const mutationObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          if (node.tagName === "IMG") {
            if (!node.complete) {
              if (node.getBoundingClientRect().top < window.innerHeight) {
                setupImageTimeout(node);
              } else {
                observer.observe(node);
              }
            }
          } else {
            node.querySelectorAll &&
              node.querySelectorAll("img").forEach((img) => {
                if (!img.complete) {
                  if (img.getBoundingClientRect().top < window.innerHeight) {
                    setupImageTimeout(img);
                  } else {
                    observer.observe(img);
                  }
                }
              });
          }
        }
      });
    });
  });

  mutationObserver.observe(document.body, { childList: true, subtree: true });
})();
