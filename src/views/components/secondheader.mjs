//@format
import { env } from "process";
import htm from "htm";
import vhtml from "vhtml";

const html = htm.bind(vhtml);
const secondheader = (theme, site) => html`
  <td>
    <div style="color: white; padding: 10px 0 5px 10px;">
      <a href="/">
        <button
          style=${`border-radius: 2px; padding: 5px 15px 5px 15px; background-color: transparent; border: 1px solid ${
            site === "top" ? theme.color : "#7f8c8d"
          }; color: ${site === "top" ? theme.color : "#7f8c8d"};`}
        >
          Top
        </button>
      </a>
      <a href="/new">
        <button
          style=${`margin-left: 10px; border-radius: 2px; padding: 5px 15px 5px 15px; background-color: transparent; border: 1px solid ${
            site === "new" ? theme.color : "#7f8c8d"
          }; color: ${site === "new" ? theme.color : "#7f8c8d"};`}
        >
          New
        </button>
      </a>
    </div>
  </td>
`;

export default secondheader;
