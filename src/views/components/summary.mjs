// @format
import htm from "htm";
import vhtml from "vhtml";

const html = htm.bind(vhtml);

// The AI summary of a story's linked article, as a row of the story table.
export default function Summary(summary) {
  if (!summary) return null;
  return html`<tr>
    <td style="padding: 0 0 20px 0;">
      <section style="margin: 0 11px;">
        <h2
          style="font-size: 10pt; font-weight: 500; margin: 0 0 6px 0; color: var(--text-secondary);"
        >
          Summary
        </h2>
        <p
          style="margin: 0; font-size: 1rem; line-height: 1.45; color: var(--text-primary); overflow-wrap: break-word;"
        >
          ${summary}
        </p>
        <p
          style="margin: 6px 0 0 0; font-size: 9pt; color: var(--text-tertiary);"
        >
          AI summary of the linked article
        </p>
      </section>
    </td>
  </tr>`;
}
