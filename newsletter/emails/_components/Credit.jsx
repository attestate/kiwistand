import React from "react";

import { light, font } from "./kit.jsx";

// The welcome line under a story's byline ("🥝 First story from alice.
// Welcome!"), in the design's light-lime box. It renders `story.credit`
// ({ kind: "new" | "returning", name, away }) when the digest provides it
// (PR #247 computes it in src/digest.mjs); without it nothing is shown.
// NOTE: In _components so react-email doesn't export it as a template.
export default function Credit({ story = {} }) {
  const { credit } = story;
  if (!credit || typeof credit.name !== "string" || !credit.name.trim()) return null;
  if (credit.kind !== "new" && credit.kind !== "returning") return null;
  if (credit.kind === "returning" && !credit.away) return null;

  const name = credit.name.trim();
  const text =
    credit.kind === "new"
      ? `First story from ${name}. Welcome!`
      : `${name} is back after ${credit.away}. Welcome back!`;

  return (
    <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" border="0" style={{ borderCollapse: "separate" }}>
      <tbody>
        <tr>
          <td className="k-welcome k-credit" bgcolor={light.welcome} style={{ backgroundColor: light.welcome, borderRadius: "4px", padding: "6px 10px" }}>
            <table role="presentation" cellPadding="0" cellSpacing="0" border="0" style={{ borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td valign="top" style={{ verticalAlign: "top", fontSize: "13px", lineHeight: "18px", paddingRight: "6px" }}>🥝</td>
                  <td className="k-text" style={{ fontFamily: font, fontSize: "13px", lineHeight: "18px", color: light.text }}>{text}</td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
