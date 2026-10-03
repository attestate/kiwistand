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

// NOTE: On iOS, web-haptics vibrates by programmatically clicking a hidden
// <label for="web-haptics-…">Haptic feedback</label> several times. PostHog's
// autocapture recorded those clicks as rage clicks ("Haptic feedback" was
// the top rage-click element on / and /new), so we exclude the label and its
// input from autocapture.
function excludeFromAnalytics(haptics) {
  try {
    haptics.ensureDOM?.();
    document
      .querySelectorAll('label[for^="web-haptics-"], input[id^="web-haptics-"]')
      .forEach((element) => element.classList.add("ph-no-capture"));
  } catch (err) {}
}

export async function triggerHaptic(preset = "medium") {
  const haptics = getInstance();
  if (!haptics?.trigger) return;
  excludeFromAnalytics(haptics);
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

