//@format
import test from "ava";
import tls from "tls";
import { X509Certificate } from "crypto";

import { isDistrusted, withoutDistrusted, distrust } from "../src/catrust.mjs";

const cn = (pem) => new X509Certificate(pem).subject.match(/CN=([^\n]+)/)?.[1];
const bundled = tls.rootCertificates;

test("finds exactly the emSign roots in Node's bundle", (t) => {
  const emsign = bundled.filter(isDistrusted).map(cn).sort();
  t.true(emsign.length > 0);
  for (const name of emsign) t.regex(name, /^emSign /);
  t.is(withoutDistrusted(bundled).length, bundled.length - emsign.length);
});

test("keeps every other root and ignores junk", (t) => {
  const other = bundled.find((pem) => /ISRG Root X1/.test(cn(pem) || ""));
  t.truthy(other);
  t.false(isDistrusted(other));
  t.false(isDistrusted("not a certificate"));
});

test("the default CA list no longer has emSign roots", (t) => {
  if (typeof tls.setDefaultCACertificates !== "function") return t.pass();
  distrust();
  t.is(tls.getCACertificates("default").filter(isDistrusted).length, 0);
  t.true(tls.getCACertificates("default").length > 100);
});
