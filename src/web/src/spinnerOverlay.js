const OVERLAY_ID = "spinner-overlay";
let initialized = false;

function ensureOverlayElement() {
  let overlay = document.getElementById(OVERLAY_ID);
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.style.display = "none";
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.background = "var(--bg-spinner)";
    overlay.style.zIndex = "9999";
    overlay.style.display = "none";
    overlay.style.justifyContent = "center";
    overlay.style.alignItems = "center";
    overlay.setAttribute("aria-hidden", "true");
    overlay.setAttribute("aria-busy", "false");
    document.body.appendChild(overlay);
  }
  return overlay;
}

export function initSpinnerOverlay() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  ensureOverlayElement();

  const hideOnHistory = () => hideSpinnerOverlay();

  window.addEventListener("pageshow", hideOnHistory, true);
  window.addEventListener("popstate", hideOnHistory, true);
  window.addEventListener("focus", hideOnHistory, true);
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      hideSpinnerOverlay();
    }
  });
  window.addEventListener("pagehide", hideOnHistory, true);
}

export function showSpinnerOverlay({ resetContent = true } = {}) {
  const overlay = ensureOverlayElement();
  if (resetContent) {
    overlay.innerHTML = "";
  }
  overlay.style.display = "flex";
  overlay.setAttribute("aria-hidden", "false");
  overlay.setAttribute("aria-busy", "true");
  overlay.dataset.active = "true";
  return overlay;
}

export function hideSpinnerOverlay() {
  const overlay = document.getElementById(OVERLAY_ID);
  if (!overlay) return;
  overlay.style.display = "none";
  overlay.setAttribute("aria-hidden", "true");
  overlay.setAttribute("aria-busy", "false");
  overlay.dataset.active = "false";
  overlay.innerHTML = "";
}

export function isSpinnerOverlayActive() {
  const overlay = document.getElementById(OVERLAY_ID);
  return overlay?.dataset.active === "true";
}

// Expose helpers globally so server-rendered onclick handlers can access them once React hydrates.
if (typeof window !== "undefined") {
  window.showSpinnerOverlay = showSpinnerOverlay;
  window.hideSpinnerOverlay = hideSpinnerOverlay;
}
