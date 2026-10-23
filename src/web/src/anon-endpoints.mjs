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

// NOTE: Reads the answer out of a JSON-RPC response body. Over Tor, a gateway
// or exit can hand back something that isn't a JSON-RPC response at all (null,
// an array, an object without "result"); that is a broken endpoint, not an
// answer, so it throws a plain error and the read falls back or fails like any
// other RPC error instead of a TypeError somewhere downstream. A null result
// is a real answer (e.g. a receipt that doesn't exist yet).
export function rpcResult(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("anon-rpc: endpoint answered with no JSON-RPC response");
  }
  if (body.error) {
    throw Object.assign(new Error(body.error.message ?? "rpc error"), {
      code: body.error.code,
      data: body.error.data,
      rpcResponse: true,
    });
  }
  if (!("result" in body)) {
    throw new Error("anon-rpc: endpoint answered without a result");
  }
  return body.result;
}
