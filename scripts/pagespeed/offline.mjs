// Keeps the server that local.mjs starts off the internet, so the pages it
// renders depend only on the fixture and not on ENS APIs, link previews,
// moderation sheets, RPCs or peers being up (or slow). Loaded into every
// server process with NODE_OPTIONS=--import, it refuses every outgoing TCP
// connection that isn't to this machine. Callers see ECONNREFUSED, as when a
// host is down, which the server already handles.
import net from "net";

const local = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0", "::"]);
const connect = net.Socket.prototype.connect;

net.Socket.prototype.connect = function (...args) {
  let options = args[0];
  if (Array.isArray(options)) options = options[0];
  let host;
  if (options && typeof options === "object") {
    if (options.path) return connect.apply(this, args);
    host = options.host;
  } else if (typeof options === "string" && !/^\d+$/.test(options)) {
    // A unix socket path.
    return connect.apply(this, args);
  } else {
    host = typeof args[1] === "string" ? args[1] : undefined;
  }
  if (!host || local.has(host)) return connect.apply(this, args);

  const err = new Error(`connect ECONNREFUSED ${host} (pagespeed offline mode)`);
  err.code = "ECONNREFUSED";
  err.syscall = "connect";
  err.address = host;
  process.nextTick(() => this.destroy(err));
  return this;
};

// Services a page can't render without get a canned answer instead: what
// they answer in production for the pages check.mjs loads.
const stubs = {
  // /search without a query lists nothing.
  "knsearch.x4901.xyz": () => Response.json({ status: "success", data: [] }),
};
const fetch = globalThis.fetch;
globalThis.fetch = function (input, init) {
  let host;
  try {
    host = new URL(typeof input === "string" ? input : input.url).hostname;
  } catch {}
  if (host && stubs[host]) return Promise.resolve(stubs[host](input, init));
  return fetch.call(this, input, init);
};
