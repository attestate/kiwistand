import { WebHaptics } from "web-haptics";

let instance;

function getInstance() {
  if (typeof window === "undefined") return null;
  if (!instance) {
    try {
      instance = new WebHaptics();
    } catch (err) {
      console.warn("web-haptics initialization failed", err);
      instance = null;
    }
  }
  return instance;
}

export async function triggerHaptic(preset = "medium") {
  const haptics = getInstance();
  if (!haptics?.trigger) return;
  try {
    await haptics.trigger(preset);
  } catch (err) {
    // Swallow errors quietly; vibration support varies by device.
  }
}

export function bindHapticsToElements(selector, preset = "medium") {
  if (typeof window === "undefined") return;
  const elements = document.querySelectorAll(selector);
  if (!elements.length) return;

  elements.forEach((element) => {
    if (element.dataset.hapticsBound === "true") return;
    element.dataset.hapticsBound = "true";

    element.addEventListener(
      "click",
      () => {
        triggerHaptic(preset);
      },
      { capture: true },
    );
  });
}

export function resetHapticBindings(selector) {
  if (typeof window === "undefined") return;
  document.querySelectorAll(selector).forEach((element) => {
    delete element.dataset.hapticsBound;
  });
}

