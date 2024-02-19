import { env } from "process";
import htm from "htm";
import vhtml from "vhtml";

const html = htm.bind(vhtml);

const secondheader = (theme, site) => html`
  <td>
    <div
      style="color: black; font-size: 1rem; font-weight: bold; display: flex; justify-content:
 space-evenly; background-color: #e6e6df;"
    >
      <a
        href="/"
        style="display: flex; padding: 0 0 0.1rem 0; flex: 1; text-decoration: none; color: inherit;"
      >
        <div
          class="filter-tab"
          style="width: 100%; height: 100%; display: flex; justify-content: center; justify-conten
 center;"
        >
          <div
            style="${site === "top" || site === "new" || site === "best"
              ? "border-bottom: 3px solid black; padding: 0.75rem 1.5rem 0.3rem 1.5rem;"
              : "padding-top: 0.75rem;"}"
          >
            All
          </div>
        </div>
      </a>
      <a
        href="/comments"
        style="padding: 0 0 0.1rem 0; flex: 1; text-decoration: none; color: inherit;"
      >
        <div
          class="filter-tab"
          style="width: 100%; height: 100%; display: flex; justify-content: center; justify-conten
 center;"
        >
          <div
            style="${site === "comments"
              ? "border-bottom: 3px solid black; padding: 0.75rem 1.5rem 0.3rem 1.5rem;"
              : "padding-top: 0.65rem"}"
          >
            Comments
          </div>
        </div>
      </a>
    </div>

    <div
      style="margin-top: -2px; padding: 0 1rem 0 1rem; background-color: #e6e6df;"
    >
      <hr style="margin: 0; border-top: 0; border-bottom: 1px solid #7f8c8d;" />
    </div>
  </td>
`;

export default secondheader;
