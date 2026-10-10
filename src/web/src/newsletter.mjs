// Shared client-side newsletter sign-up: posts to the Buttondown proxy and
// tracks the funnel in PostHog. The email address is never sent to PostHog.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const SUBSCRIBED_KEY = "newsletter-subscribed";

function capture(event, props) {
  try {
    window.posthog?.capture?.(event, props);
  } catch (err) {}
}

export function markSubscribed() {
  try {
    localStorage.setItem(SUBSCRIBED_KEY, "true");
  } catch (err) {}
}

// Resolves to the server's JSON on success, throws otherwise (after tracking
// newsletter_subscribe_failed with the HTTP status and error code).
export async function subscribe(email, source) {
  capture("newsletter_submit", { source });
  let response;
  try {
    response = await fetch("/api/v1/newsletter/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, source }),
    });
  } catch (err) {
    capture("newsletter_subscribe_failed", {
      source,
      status: 0,
      code: "network_error",
    });
    throw err;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    capture("newsletter_subscribe_failed", {
      source,
      status: response.status,
      code: data.code || "unknown",
    });
    throw new Error(data.error || `Status ${response.status}`);
  }

  markSubscribed();
  capture("newsletter_subscribed", {
    source,
    already_subscribed: data.status === "already_subscribed",
  });
  return data;
}
