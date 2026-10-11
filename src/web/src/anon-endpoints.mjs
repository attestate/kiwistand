// @format
// NOTE: Which public RPCs Private RPC reads go to, over Tor. Some providers
// block Tor exits (mainnet.optimism.io answers 403 through Cloudflare), so
// each chain has a list and a read moves on to the next endpoint when one
// refuses. Kept apart from anon-transport.mjs so it can be tested without the
// anon-rpc harness.
export const ANON_RPC_URLS = {
  10: [
    "https://optimism-rpc.publicnode.com",
    "https://optimism.drpc.org",
    "https://1rpc.io/op",
    "https://mainnet.optimism.io",
  ],
  1: [
    "https://ethereum-rpc.publicnode.com",
    "https://eth.drpc.org",
    "https://1rpc.io/eth",
  ],
};

// NOTE: Statuses that mean "this endpoint won't serve us", not "your request
// is wrong": blocked (401/403), rate limited (429) or broken (5xx).
export const isRefusal = (status) =>
  status === 401 || status === 403 || status === 429 || status >= 500;

// Sends one request, starting at the endpoint that last worked for this chain
// (state.preferred) and trying the others in order when one refuses or the
// connection fails. Returns the first non-refused response.
export async function fetchWithFailover(fetchFn, urls, init, state = {}) {
  if (!urls?.length) throw new Error("anon-rpc: no endpoints");
  const start = urls.includes(state.preferred) ? urls.indexOf(state.preferred) : 0;
  const failures = [];
  for (let i = 0; i < urls.length; i++) {
    const url = urls[(start + i) % urls.length];
    let res;
    try {
      res = await fetchFn(url, init);
    } catch (err) {
      failures.push(`${new URL(url).host}: ${err.message}`);
      continue;
    }
    if (isRefusal(res.status)) {
      failures.push(`${new URL(url).host}: HTTP ${res.status}`);
      continue;
    }
    state.preferred = url;
    return res;
  }
  throw new Error(`anon-rpc: every endpoint refused (${failures.join(", ")})`);
}
