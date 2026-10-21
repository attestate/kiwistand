// @format
// NOTE: Imported first by the entry points (launch.mjs, load-balancer.mjs),
// before any TLS connection is made, because Node applies a changed CA list
// only to new connections.
//
// In October 2026 the private keys of eight eMudhra intermediate CAs leaked
// (six TLS ones under "emSign ECC Root CA - G3"). Browsers blocked them, but
// Node checks neither revocation nor those blocklists and still ships the
// emSign roots, so a forged certificate for any host (Neynar, RPC providers,
// link previews) would be accepted. Kiwi never needs an emSign-issued
// certificate, so all emSign/eMudhra roots are dropped. This becomes a no-op
// once Node stops bundling them. Needs Node 22.19+ (tls.setDefaultCACertificates);
// older versions skip it.
import tls from "tls";
import { X509Certificate } from "crypto";

import log from "./logger.mjs";

const DISTRUSTED = /\b(emSign|eMudhra)\b/i;

export function isDistrusted(pem) {
  try {
    const cert = new X509Certificate(pem);
    return DISTRUSTED.test(`${cert.subject}\n${cert.issuer}`);
  } catch (err) {
    return false;
  }
}

export function withoutDistrusted(pems) {
  return pems.filter((pem) => !isDistrusted(pem));
}

export function distrust() {
  if (
    typeof tls.getCACertificates !== "function" ||
    typeof tls.setDefaultCACertificates !== "function"
  ) {
    log(
      `catrust: Node ${process.version} can't change its CA list; emSign roots stay trusted`,
    );
    return 0;
  }
  const all = tls.getCACertificates("default");
  const kept = withoutDistrusted(all);
  const dropped = all.length - kept.length;
  if (dropped > 0) tls.setDefaultCACertificates(kept);
  return dropped;
}

try {
  const dropped = distrust();
  if (dropped > 0) log(`catrust: dropped ${dropped} emSign/eMudhra root(s)`);
} catch (err) {
  log(`catrust: couldn't change the CA list: ${err.message}`);
}
