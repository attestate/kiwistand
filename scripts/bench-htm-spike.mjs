// Microbenchmark: htm-tagged-template vs babel-plugin-htm precompiled output,
// both rendering against vhtml. We can't easily render the real shortcut view
// without booting half the app, so we use a representative template that
// mirrors its shape (deep nesting, mixed static/dynamic attrs, ~40 elements).
import htm from "htm";
import vhtml from "vhtml";

const html = htm.bind(vhtml);

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

const a = bench("htm runtime", renderHtm);
const b = bench("babel-plugin-htm", renderCompiled);
const c = bench("noop (vhtml-free)", renderNoop);

// Confirm functional equivalence so we know we're benching the same work.
const norm = (s) => s.replace(/\s+/g, " ").trim();
console.log(
  `\noutputs identical (whitespace-normalized): ${norm(a) === norm(b)}`,
);
