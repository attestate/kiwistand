//@format
import { env } from "process";
import htm from "htm";
import vhtml from "vhtml";

const html = htm.bind(vhtml);
const header = (theme) => html`
<td bgcolor="${theme.color}">
    <nav-onboarding-modal />
    <table
        style="padding:10px 15px 10px 15px;"
        width="100%"
        cellspacing="0"
        cellpadding="0"
        border="0"
    >
        <tbody>
            <tr>
                <td style="line-height:12pt; height:10px;">
                    <div style="display: flex; flex-direction: column; align-items: center; position: relative;">
                        <div style="text-align: center;">
                            <div style="color: black; font-size: x-large; margin-bottom: 4px;"><b>Kiwi News</b></div>
                            <div style="color: black; font-size: small; margin-bottom: 6px;"><span>handpicked web3 alpha</span></div>
                        </div>
                        <div style="display: flex; width: 100%; justify-content: space-between; align-items: center;">
                            <div
                                class="sidebar-toggle"
                                style="padding: 7px; cursor: pointer; display: flex; align-items: center; justify-content: start;"
                            >
                                <svg
                                    style="padding-top: 2px;"
                                    viewBox="0 0 100 80"
                                    width="20"
                                    height="20"
                                >
                                    <rect width="100" height="10"></rect>
                                    <rect y="30" width="100" height="10"></rect>
                                    <rect y="60" width="100" height="10"></rect>
                                </svg>
                                <span style="color: black; margin-left: 10px;">Menu</span>
                            </div>
                            <div
                                style="padding: 7px; display: flex; justify-content: flex-end; width: 100px;"
                            >
                                <div id="connectButton"></div>
                            </div>
                        </div>
                        <b class="hnname" style="font-size: x-large; text-align: center; position: absolute; top: 75%; transform: translateY(-50%);">
                            <span>${theme.emoji}</span>
                        </b>
                    </div>
                </td>
            </tr>
        </tbody>
    </table>
</td>`;
export default header;
