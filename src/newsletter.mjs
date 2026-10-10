// @format

// Helpers for the Buttondown proxy at POST /api/v1/newsletter/subscribe.

// Where a sign-up came from, sent to Buttondown as a tag. Anything not listed
// here is dropped, so clients can't create arbitrary tags.
export const SOURCE_TAGS = [
  "modal",
  "feed",
  "sidebar",
  "story",
  "landing",
  "bell",
  "upvote",
  "weekly",
];

// Older client names for the same places.
const SOURCE_ALIASES = {
  feed_card: "feed",
  scroll_modal: "modal",
};

export function sourceTag(source) {
  if (typeof source !== "string") return null;
  const value = source.trim().toLowerCase();
  const tag = SOURCE_ALIASES[value] || value;
  return SOURCE_TAGS.includes(tag) ? tag : null;
}

// Buttondown answers a failed POST /v1/subscribers with a JSON body like
// { "code": "email_already_exists", "detail": "..." } (older versions sent
// an array of messages). Only an error that actually says the address is
// already on the list counts as "already subscribed"; every other 4xx (an
// invalid or blocked address, a bad request) is a real failure.
export function parseButtondownError(status, text) {
  let code = "";
  let detail = "";
  try {
    const body = JSON.parse(text);
    if (Array.isArray(body)) {
      detail = body.join(" ");
    } else if (body && typeof body === "object") {
      code = typeof body.code === "string" ? body.code : "";
      if (typeof body.detail === "string") {
        detail = body.detail;
      } else if (body.detail != null) {
        detail = JSON.stringify(body.detail);
      } else {
        detail = Object.values(body)
          .flat()
          .filter((v) => typeof v === "string")
          .join(" ");
      }
    }
  } catch (err) {
    detail = typeof text === "string" ? text : "";
  }

  const haystack = `${code} ${detail}`.toLowerCase();
  const alreadySubscribed = status === 409 || haystack.includes("already");
  return { code, detail, alreadySubscribed };
}
