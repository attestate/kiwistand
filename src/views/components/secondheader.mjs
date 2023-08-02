import { env } from "process";
import htm from "htm";
import vhtml from "vhtml";

const html = htm.bind(vhtml);
const secondheader = (theme, site) => html`
  <td>
    <div
      style="background-color: #e6e6df; min-height: 40px; display: flex; justify-content: space-between; align-items: center; padding: 10px 15px 10px 15px; color: white;"
    >
      <div>
        <a href="/">
          <button
            style=${`font-size: 1.01rem; border-radius: 2px; cursor: pointer; padding: 5px 15px 5px 15px; background-color: transparent; border: 1px solid ${
              site === "top" ? theme.color : "#7f8c8d"
            }; color: ${site === "top" ? theme.color : "#7f8c8d"};`}
          >
            Hot
          </button>
        </a>
        <a href="/new">
          <button
            style=${`font-size: 1.01rem; margin-left: 10px; cursor: pointer; border-radius: 2px; padding: 5px 15px 5px 15px; background-color: transparent; border: 1px solid ${
              site === "new" ? theme.color : "#7f8c8d"
            }; color: ${site === "new" ? theme.color : "#7f8c8d"};`}
          >
            New
          </button>
        </a>
        <a href="/alltime">
          <button
            style=${`font-size: 1.01rem; margin-left: 10px; cursor: pointer; border-radius: 2px; padding: 5px 15px 5px 15px; background-color: transparent; border: 1px solid ${
              site === "alltime" ? theme.color : "#7f8c8d"
            }; color: ${site === "alltime" ? theme.color : "#7f8c8d"};`}
          >
            All-Time
          </button>
        </a>
      </div>
      <nav-learn-more />
    </div>
  </td>
`;

export default secondheader;
