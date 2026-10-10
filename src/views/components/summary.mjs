// @format
import htm from "htm";
import vhtml from "vhtml";

const html = htm.bind(vhtml);

// The AI summary of a story's linked article, as a row of the story table.
// NOTE: Collapsed by default in a native <details> (no JS needed). The text is
// still in the HTML, so search engines and agents read it.
export default function Summary(summary) {
  if (!summary) return null;
  return html`<tr>
    <td style="padding: 0 0 16px 0;">
      <details class="story-summary">
        <summary>AI summary of the linked article</summary>
        <p>${summary}</p>
      </details>
    </td>
  </tr>`;
}
