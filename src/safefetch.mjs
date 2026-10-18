// Fetch for URLs that come from users, e.g. a story's href.
//
// request-filtering-agent refuses connections to private, loopback,
// link-local and cloud-metadata addresses (checked after DNS resolution, so
// rebinding doesn't get around it). Passing the agent as a function makes
// node-fetch ask for it again on every redirect hop, so a public URL that
// 302s to http://169.254.169.254/ is refused too.
//
// NOTE: This must be node-fetch. The global (undici) fetch silently ignores
// `agent`, which would leave the guard inert.
import nodeFetch from "node-fetch";
import { useAgent } from "request-filtering-agent";

const MAX_REDIRECTS = 5;

export const filteringAgent = (parsedURL) => useAgent(parsedURL.href);

export function safeFetch(url, options = {}) {
  return nodeFetch(url, {
    redirect: "follow",
    follow: MAX_REDIRECTS,
    ...options,
    agent: filteringAgent,
  });
}

// Stops reading a response body we don't need, for both node-fetch (Node
// stream) and WHATWG (ReadableStream) responses.
export function discardBody(response) {
  const body = response?.body;
  if (!body) return;
  if (typeof body.cancel === "function") body.cancel().catch(() => {});
  else if (typeof body.destroy === "function") body.destroy();
}
