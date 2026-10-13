//@format
// The newsletter's curator credit on the web (/newsletter and /weekly):
// "First story from alice — welcome!" or "alice is back after 5 months".
// The email renders the same line in newsletter/emails/_components/Credit.jsx.
import htm from "htm";
import vhtml from "vhtml";

import { hasName } from "../../credit.mjs";

const html = htm.bind(vhtml);

export const styles = `
  .kn-credit { display: block; margin: 0.3rem 0 0 0; padding: 0 0 0 0.5rem; border-left: 3px solid #AFC046; font-size: 0.85rem; line-height: 1.4; color: var(--text-secondary); }
  .kn-credit a { color: var(--text-primary); font-weight: 600; text-decoration: none; }
  .kn-credit a:hover { text-decoration: underline; }
`;

export default function CreditLine(credit, identity) {
  if (!credit || !identity || !hasName(credit.name)) return null;
  const name = html`<a href="/upvotes?address=${identity}">${credit.name}</a>`;
  if (credit.kind === "new") {
    return html`<span class="kn-credit">First story from ${name} — welcome!</span>`;
  }
  if (credit.kind === "returning" && credit.away) {
    return html`<span class="kn-credit">${name} is back after ${credit.away}</span>`;
  }
  return null;
}
