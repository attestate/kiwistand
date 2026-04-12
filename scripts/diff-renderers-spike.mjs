// Print the actual HTML each renderer produces, side by side, so we can see
// where vhtml and preact-render-to-string differ in practice. The shape of
// these differences determines whether a swap is safe for the real views.
import htm from "htm";
import vhtml from "vhtml";
import { h } from "preact";
import { render as renderPreact } from "preact-render-to-string";

const htmlV = htm.bind(vhtml);
const htmlP = htm.bind(h);

// A small but mean template: includes a void element (source), a boolean
// attribute (controls), an attribute that needs escaping (the &), a string
// child that contains characters worth escaping (no literal `<Tag>` text
// because htm parses that as a real element — caller has to escape &lt; in
// content or interpolate it as a string), and an attribute whose value is
// interpolated.
const theme = "var(--background-color0)";
const url = "https://example.com/?a=1&b=2";
const literalText = 'Hello & welcome to <Kiwi>';

const v = htmlV`
  <div class="container">
    <h1 style="color: red;">${literalText}</h1>
    <video controls style="background: black;">
      <source src="${url}" type="video/mp4" />
      Fallback text with "quotes" & ampersands
    </video>
    <a href="${url}" target="_blank">link</a>
  </div>
`;

const p = renderPreact(htmlP`
  <div class="container">
    <h1 style="color: red;">${literalText}</h1>
    <video controls style="background: black;">
      <source src="${url}" type="video/mp4" />
      Fallback text with "quotes" & ampersands
    </video>
    <a href="${url}" target="_blank">link</a>
  </div>
`);

console.log("--- vhtml ---");
console.log(String(v));
console.log("\n--- preact-render-to-string ---");
console.log(p);
console.log("\n--- byte lengths ---");
console.log(`vhtml: ${v.length}   preact-rts: ${p.length}`);
