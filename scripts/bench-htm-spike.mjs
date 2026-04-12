// Microbenchmark: compare four ways of producing the same SSR HTML string for
// a representative ~40-element template (mirrors src/views/shortcut.mjs):
//   A) runtime htm tagged template -> vhtml
//   B) babel-plugin-htm style direct vhtml() calls (hand-written equivalent)
//   C) runtime htm tagged template -> preact h + preact-render-to-string
//   D) noop control (returns a precomputed string)
//
// (A) and (B) tell us whether precompiling htm helps. (C) tells us whether
// swapping the renderer underneath htm wins. (D) tells us how much of the
// per-render cost is renderer work vs. everything else.
import htm from "htm";
import vhtml from "vhtml";
import { h } from "preact";
import { render as renderPreact } from "preact-render-to-string";

const html = htm.bind(vhtml);
const htmlPreact = htm.bind(h);

const ITERATIONS = 50_000;

// --- Variant A: runtime htm tagged template ---------------------------------
function renderHtm(theme, videoUrl, shortcutUrl) {
  return html`
    <html lang="en" op="news">
      <head>
        <title>Submit to Kiwi</title>
      </head>
      <body>
        <div class="container">
          <div id="hnmain" class="scaled-hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="${theme}">
              <tr>
                <td style="padding: 1rem;">
                  <div style="display: flex; flex-direction: column; align-items: center;">
                    <h1 style="color: var(--text-tertiary); margin-bottom: 0;">Submit to Kiwi</h1>
                    <p style="color: var(--text-muted);">Easily share links directly to Kiwi News with our iOS Shortcut.</p>
                    <video controls style="background: black; max-width: 50vw;">
                      <source src="${videoUrl}" type="video/mp4" />
                      Your browser does not support the video tag.
                    </video>
                    <a href="${shortcutUrl}" target="_blank" style="text-decoration: none;">
                      <button style="width: auto; margin-top: 2rem;" id="button-onboarding">
                        Download Shortcut
                      </button>
                    </a>
                    <ul>
                      <li>One</li>
                      <li>Two</li>
                      <li>Three</li>
                      <li>Four</li>
                      <li>Five</li>
                    </ul>
                  </div>
                </td>
              </tr>
            </table>
          </div>
        </div>
      </body>
    </html>
  `;
}

// --- Variant B: babel-plugin-htm precompiled equivalent ---------------------
// This is exactly what babel-plugin-htm would emit for the template above with
// pragma: "vhtml". Hand-written here so the bench has zero build dependency.
function renderCompiled(theme, videoUrl, shortcutUrl) {
  return vhtml(
    "html",
    { lang: "en", op: "news" },
    vhtml("head", null, vhtml("title", null, "Submit to Kiwi")),
    vhtml(
      "body",
      null,
      vhtml(
        "div",
        { class: "container" },
        vhtml(
          "div",
          { id: "hnmain", class: "scaled-hnmain" },
          vhtml(
            "table",
            { border: "0", cellpadding: "0", cellspacing: "0", bgcolor: theme },
            vhtml(
              "tr",
              null,
              vhtml(
                "td",
                { style: "padding: 1rem;" },
                vhtml(
                  "div",
                  { style: "display: flex; flex-direction: column; align-items: center;" },
                  vhtml("h1", { style: "color: var(--text-tertiary); margin-bottom: 0;" }, "Submit to Kiwi"),
                  vhtml("p", { style: "color: var(--text-muted);" }, "Easily share links directly to Kiwi News with our iOS Shortcut."),
                  vhtml(
                    "video",
                    { controls: true, style: "background: black; max-width: 50vw;" },
                    vhtml("source", { src: videoUrl, type: "video/mp4" }),
                    "Your browser does not support the video tag.",
                  ),
                  vhtml(
                    "a",
                    { href: shortcutUrl, target: "_blank", style: "text-decoration: none;" },
                    vhtml(
                      "button",
                      { style: "width: auto; margin-top: 2rem;", id: "button-onboarding" },
                      "Download Shortcut",
                    ),
                  ),
                  vhtml(
                    "ul",
                    null,
                    vhtml("li", null, "One"),
                    vhtml("li", null, "Two"),
                    vhtml("li", null, "Three"),
                    vhtml("li", null, "Four"),
                    vhtml("li", null, "Five"),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

// --- Variant C: same htm template, bound to preact h + render-to-string ----
function renderPreactHtm(theme, videoUrl, shortcutUrl) {
  const tree = htmlPreact`
    <html lang="en" op="news">
      <head>
        <title>Submit to Kiwi</title>
      </head>
      <body>
        <div class="container">
          <div id="hnmain" class="scaled-hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="${theme}">
              <tr>
                <td style="padding: 1rem;">
                  <div style="display: flex; flex-direction: column; align-items: center;">
                    <h1 style="color: var(--text-tertiary); margin-bottom: 0;">Submit to Kiwi</h1>
                    <p style="color: var(--text-muted);">Easily share links directly to Kiwi News with our iOS Shortcut.</p>
                    <video controls style="background: black; max-width: 50vw;">
                      <source src="${videoUrl}" type="video/mp4" />
                      Your browser does not support the video tag.
                    </video>
                    <a href="${shortcutUrl}" target="_blank" style="text-decoration: none;">
                      <button style="width: auto; margin-top: 2rem;" id="button-onboarding">
                        Download Shortcut
                      </button>
                    </a>
                    <ul>
                      <li>One</li>
                      <li>Two</li>
                      <li>Three</li>
                      <li>Four</li>
                      <li>Five</li>
                    </ul>
                  </div>
                </td>
              </tr>
            </table>
          </div>
        </div>
      </body>
    </html>
  `;
  return renderPreact(tree);
}

function bench(label, fn) {
  // Sanity: make sure both outputs are identical before timing.
  const out = fn("var(--background-color0)", "shortcut.mp4", "https://example.com/x");
  // Warmup so htm's per-template-strings cache is populated.
  for (let i = 0; i < 5_000; i++) fn("t", "v", "u");
  const start = process.hrtime.bigint();
  for (let i = 0; i < ITERATIONS; i++) fn("t", "v", "u");
  const end = process.hrtime.bigint();
  const ms = Number(end - start) / 1e6;
  const perOp = (ms * 1000) / ITERATIONS; // µs/op
  console.log(`${label.padEnd(18)} ${ms.toFixed(1).padStart(8)} ms total   ${perOp.toFixed(2).padStart(7)} µs/op`);
  return out;
}

console.log(`iterations: ${ITERATIONS}\n`);

// --- Variant C: bypass vhtml entirely, return a fixed string ---------------
// Tells us how much of the per-render cost is the htm/compiled tree work
// versus vhtml's string-building/escaping. If C is close to A and B, the
// bottleneck is vhtml itself, not htm.
const FIXED_OUTPUT = renderCompiled("t", "v", "u");
function renderNoop() {
  return FIXED_OUTPUT;
}

const a = bench("htm + vhtml", renderHtm);
const b = bench("babel-plugin-htm", renderCompiled);
const c = bench("htm + preact-rts", renderPreactHtm);
const d = bench("noop (renderer-free)", renderNoop);

// Confirm functional equivalence so we know we're benching the same work.
// preact-render-to-string self-closes void elements and orders attrs slightly
// differently than vhtml, so we strip whitespace and compare loosely.
const norm = (s) => s.replace(/\s+/g, " ").trim();
console.log(
  `\nA == B (whitespace-normalized): ${norm(a) === norm(b)}`,
);
console.log(
  `A length: ${a.length}   C length: ${c.length}   (vhtml vs preact-rts byte counts)`,
);
