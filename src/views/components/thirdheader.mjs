import { env } from "process";
import htm from "htm";
import vhtml from "vhtml";

const html = htm.bind(vhtml);

const qr = html`<svg
  style="width: 120px; margin: 25px;"
  xmlns="http://www.w3.org/2000/svg"
  version="1.1"
  viewBox="0 0 33 33"
  stroke="none"
>
  <rect width="100%" height="100%" fill="#000000" />
  <path
    d="M0,0h1v1h-1z M1,0h1v1h-1z M2,0h1v1h-1z M3,0h1v1h-1z M4,0h1v1h-1z M5,0h1v1h-1z M6,0h1v1h-1z M9,0h1v1h-1z M14,0h1v1h-1z M18,0h1v1h-1z M19,0h1v1h-1z M20,0h1v1h-1z M21,0h1v1h-1z M23,0h1v1h-1z M26,0h1v1h-1z M27,0h1v1h-1z M28,0h1v1h-1z M29,0h1v1h-1z M30,0h1v1h-1z M31,0h1v1h-1z M32,0h1v1h-1z M0,1h1v1h-1z M6,1h1v1h-1z M8,1h1v1h-1z M9,1h1v1h-1z M11,1h1v1h-1z M12,1h1v1h-1z M13,1h1v1h-1z M15,1h1v1h-1z M16,1h1v1h-1z M18,1h1v1h-1z M26,1h1v1h-1z M32,1h1v1h-1z M0,2h1v1h-1z M2,2h1v1h-1z M3,2h1v1h-1z M4,2h1v1h-1z M6,2h1v1h-1z M9,2h1v1h-1z M10,2h1v1h-1z M11,2h1v1h-1z M14,2h1v1h-1z M20,2h1v1h-1z M21,2h1v1h-1z M22,2h1v1h-1z M24,2h1v1h-1z M26,2h1v1h-1z M28,2h1v1h-1z M29,2h1v1h-1z M30,2h1v1h-1z M32,2h1v1h-1z M0,3h1v1h-1z M2,3h1v1h-1z M3,3h1v1h-1z M4,3h1v1h-1z M6,3h1v1h-1z M8,3h1v1h-1z M9,3h1v1h-1z M11,3h1v1h-1z M12,3h1v1h-1z M13,3h1v1h-1z M15,3h1v1h-1z M16,3h1v1h-1z M17,3h1v1h-1z M20,3h1v1h-1z M26,3h1v1h-1z M28,3h1v1h-1z M29,3h1v1h-1z M30,3h1v1h-1z M32,3h1v1h-1z M0,4h1v1h-1z M2,4h1v1h-1z M3,4h1v1h-1z M4,4h1v1h-1z M6,4h1v1h-1z M10,4h1v1h-1z M12,4h1v1h-1z M14,4h1v1h-1z M18,4h1v1h-1z M19,4h1v1h-1z M21,4h1v1h-1z M22,4h1v1h-1z M23,4h1v1h-1z M24,4h1v1h-1z M26,4h1v1h-1z M28,4h1v1h-1z M29,4h1v1h-1z M30,4h1v1h-1z M32,4h1v1h-1z M0,5h1v1h-1z M6,5h1v1h-1z M8,5h1v1h-1z M10,5h1v1h-1z M12,5h1v1h-1z M13,5h1v1h-1z M15,5h1v1h-1z M16,5h1v1h-1z M17,5h1v1h-1z M20,5h1v1h-1z M21,5h1v1h-1z M24,5h1v1h-1z M26,5h1v1h-1z M32,5h1v1h-1z M0,6h1v1h-1z M1,6h1v1h-1z M2,6h1v1h-1z M3,6h1v1h-1z M4,6h1v1h-1z M5,6h1v1h-1z M6,6h1v1h-1z M8,6h1v1h-1z M10,6h1v1h-1z M12,6h1v1h-1z M14,6h1v1h-1z M16,6h1v1h-1z M18,6h1v1h-1z M20,6h1v1h-1z M22,6h1v1h-1z M24,6h1v1h-1z M26,6h1v1h-1z M27,6h1v1h-1z M28,6h1v1h-1z M29,6h1v1h-1z M30,6h1v1h-1z M31,6h1v1h-1z M32,6h1v1h-1z M12,7h1v1h-1z M14,7h1v1h-1z M15,7h1v1h-1z M16,7h1v1h-1z M18,7h1v1h-1z M19,7h1v1h-1z M21,7h1v1h-1z M22,7h1v1h-1z M23,7h1v1h-1z M0,8h1v1h-1z M1,8h1v1h-1z M2,8h1v1h-1z M3,8h1v1h-1z M4,8h1v1h-1z M6,8h1v1h-1z M7,8h1v1h-1z M8,8h1v1h-1z M9,8h1v1h-1z M10,8h1v1h-1z M13,8h1v1h-1z M16,8h1v1h-1z M17,8h1v1h-1z M18,8h1v1h-1z M20,8h1v1h-1z M24,8h1v1h-1z M25,8h1v1h-1z M27,8h1v1h-1z M29,8h1v1h-1z M31,8h1v1h-1z M2,9h1v1h-1z M3,9h1v1h-1z M7,9h1v1h-1z M9,9h1v1h-1z M11,9h1v1h-1z M12,9h1v1h-1z M14,9h1v1h-1z M19,9h1v1h-1z M21,9h1v1h-1z M22,9h1v1h-1z M25,9h1v1h-1z M26,9h1v1h-1z M27,9h1v1h-1z M30,9h1v1h-1z M31,9h1v1h-1z M32,9h1v1h-1z M1,10h1v1h-1z M6,10h1v1h-1z M7,10h1v1h-1z M9,10h1v1h-1z M12,10h1v1h-1z M15,10h1v1h-1z M16,10h1v1h-1z M17,10h1v1h-1z M24,10h1v1h-1z M25,10h1v1h-1z M27,10h1v1h-1z M28,10h1v1h-1z M31,10h1v1h-1z M0,11h1v1h-1z M2,11h1v1h-1z M3,11h1v1h-1z M4,11h1v1h-1z M5,11h1v1h-1z M7,11h1v1h-1z M9,11h1v1h-1z M10,11h1v1h-1z M12,11h1v1h-1z M15,11h1v1h-1z M16,11h1v1h-1z M18,11h1v1h-1z M21,11h1v1h-1z M22,11h1v1h-1z M23,11h1v1h-1z M24,11h1v1h-1z M27,11h1v1h-1z M29,11h1v1h-1z M30,11h1v1h-1z M31,11h1v1h-1z M0,12h1v1h-1z M1,12h1v1h-1z M4,12h1v1h-1z M5,12h1v1h-1z M6,12h1v1h-1z M8,12h1v1h-1z M9,12h1v1h-1z M13,12h1v1h-1z M15,12h1v1h-1z M17,12h1v1h-1z M18,12h1v1h-1z M19,12h1v1h-1z M20,12h1v1h-1z M24,12h1v1h-1z M25,12h1v1h-1z M28,12h1v1h-1z M31,12h1v1h-1z M0,13h1v1h-1z M3,13h1v1h-1z M8,13h1v1h-1z M9,13h1v1h-1z M10,13h1v1h-1z M11,13h1v1h-1z M12,13h1v1h-1z M14,13h1v1h-1z M16,13h1v1h-1z M19,13h1v1h-1z M21,13h1v1h-1z M22,13h1v1h-1z M26,13h1v1h-1z M27,13h1v1h-1z M29,13h1v1h-1z M30,13h1v1h-1z M32,13h1v1h-1z M0,14h1v1h-1z M1,14h1v1h-1z M2,14h1v1h-1z M3,14h1v1h-1z M6,14h1v1h-1z M7,14h1v1h-1z M8,14h1v1h-1z M9,14h1v1h-1z M12,14h1v1h-1z M15,14h1v1h-1z M16,14h1v1h-1z M17,14h1v1h-1z M22,14h1v1h-1z M28,14h1v1h-1z M29,14h1v1h-1z M30,14h1v1h-1z M31,14h1v1h-1z M0,15h1v1h-1z M2,15h1v1h-1z M8,15h1v1h-1z M10,15h1v1h-1z M12,15h1v1h-1z M15,15h1v1h-1z M16,15h1v1h-1z M18,15h1v1h-1z M21,15h1v1h-1z M24,15h1v1h-1z M25,15h1v1h-1z M26,15h1v1h-1z M27,15h1v1h-1z M29,15h1v1h-1z M30,15h1v1h-1z M0,16h1v1h-1z M1,16h1v1h-1z M3,16h1v1h-1z M4,16h1v1h-1z M6,16h1v1h-1z M7,16h1v1h-1z M10,16h1v1h-1z M13,16h1v1h-1z M15,16h1v1h-1z M16,16h1v1h-1z M17,16h1v1h-1z M18,16h1v1h-1z M19,16h1v1h-1z M20,16h1v1h-1z M28,16h1v1h-1z M29,16h1v1h-1z M32,16h1v1h-1z M2,17h1v1h-1z M9,17h1v1h-1z M11,17h1v1h-1z M12,17h1v1h-1z M14,17h1v1h-1z M16,17h1v1h-1z M19,17h1v1h-1z M21,17h1v1h-1z M22,17h1v1h-1z M23,17h1v1h-1z M24,17h1v1h-1z M25,17h1v1h-1z M26,17h1v1h-1z M27,17h1v1h-1z M29,17h1v1h-1z M30,17h1v1h-1z M32,17h1v1h-1z M4,18h1v1h-1z M5,18h1v1h-1z M6,18h1v1h-1z M8,18h1v1h-1z M9,18h1v1h-1z M10,18h1v1h-1z M12,18h1v1h-1z M15,18h1v1h-1z M17,18h1v1h-1z M18,18h1v1h-1z M20,18h1v1h-1z M21,18h1v1h-1z M24,18h1v1h-1z M25,18h1v1h-1z M29,18h1v1h-1z M30,18h1v1h-1z M31,18h1v1h-1z M0,19h1v1h-1z M3,19h1v1h-1z M8,19h1v1h-1z M9,19h1v1h-1z M10,19h1v1h-1z M12,19h1v1h-1z M15,19h1v1h-1z M16,19h1v1h-1z M21,19h1v1h-1z M23,19h1v1h-1z M25,19h1v1h-1z M29,19h1v1h-1z M30,19h1v1h-1z M4,20h1v1h-1z M6,20h1v1h-1z M7,20h1v1h-1z M8,20h1v1h-1z M10,20h1v1h-1z M13,20h1v1h-1z M17,20h1v1h-1z M18,20h1v1h-1z M20,20h1v1h-1z M24,20h1v1h-1z M27,20h1v1h-1z M28,20h1v1h-1z M31,20h1v1h-1z M0,21h1v1h-1z M1,21h1v1h-1z M2,21h1v1h-1z M3,21h1v1h-1z M4,21h1v1h-1z M5,21h1v1h-1z M8,21h1v1h-1z M9,21h1v1h-1z M11,21h1v1h-1z M12,21h1v1h-1z M14,21h1v1h-1z M16,21h1v1h-1z M19,21h1v1h-1z M22,21h1v1h-1z M25,21h1v1h-1z M26,21h1v1h-1z M29,21h1v1h-1z M31,21h1v1h-1z M32,21h1v1h-1z M0,22h1v1h-1z M2,22h1v1h-1z M3,22h1v1h-1z M6,22h1v1h-1z M7,22h1v1h-1z M10,22h1v1h-1z M12,22h1v1h-1z M15,22h1v1h-1z M16,22h1v1h-1z M17,22h1v1h-1z M20,22h1v1h-1z M21,22h1v1h-1z M26,22h1v1h-1z M29,22h1v1h-1z M30,22h1v1h-1z M31,22h1v1h-1z M0,23h1v1h-1z M2,23h1v1h-1z M4,23h1v1h-1z M5,23h1v1h-1z M7,23h1v1h-1z M8,23h1v1h-1z M12,23h1v1h-1z M15,23h1v1h-1z M18,23h1v1h-1z M19,23h1v1h-1z M21,23h1v1h-1z M30,23h1v1h-1z M31,23h1v1h-1z M0,24h1v1h-1z M4,24h1v1h-1z M6,24h1v1h-1z M7,24h1v1h-1z M8,24h1v1h-1z M10,24h1v1h-1z M13,24h1v1h-1z M15,24h1v1h-1z M17,24h1v1h-1z M18,24h1v1h-1z M20,24h1v1h-1z M24,24h1v1h-1z M25,24h1v1h-1z M26,24h1v1h-1z M27,24h1v1h-1z M28,24h1v1h-1z M29,24h1v1h-1z M31,24h1v1h-1z M8,25h1v1h-1z M11,25h1v1h-1z M12,25h1v1h-1z M14,25h1v1h-1z M16,25h1v1h-1z M19,25h1v1h-1z M22,25h1v1h-1z M24,25h1v1h-1z M28,25h1v1h-1z M32,25h1v1h-1z M0,26h1v1h-1z M1,26h1v1h-1z M2,26h1v1h-1z M3,26h1v1h-1z M4,26h1v1h-1z M5,26h1v1h-1z M6,26h1v1h-1z M8,26h1v1h-1z M12,26h1v1h-1z M15,26h1v1h-1z M17,26h1v1h-1z M21,26h1v1h-1z M23,26h1v1h-1z M24,26h1v1h-1z M26,26h1v1h-1z M28,26h1v1h-1z M31,26h1v1h-1z M0,27h1v1h-1z M6,27h1v1h-1z M12,27h1v1h-1z M16,27h1v1h-1z M18,27h1v1h-1z M20,27h1v1h-1z M21,27h1v1h-1z M23,27h1v1h-1z M24,27h1v1h-1z M28,27h1v1h-1z M30,27h1v1h-1z M32,27h1v1h-1z M0,28h1v1h-1z M2,28h1v1h-1z M3,28h1v1h-1z M4,28h1v1h-1z M6,28h1v1h-1z M8,28h1v1h-1z M10,28h1v1h-1z M13,28h1v1h-1z M15,28h1v1h-1z M16,28h1v1h-1z M17,28h1v1h-1z M20,28h1v1h-1z M24,28h1v1h-1z M25,28h1v1h-1z M26,28h1v1h-1z M27,28h1v1h-1z M28,28h1v1h-1z M29,28h1v1h-1z M32,28h1v1h-1z M0,29h1v1h-1z M2,29h1v1h-1z M3,29h1v1h-1z M4,29h1v1h-1z M6,29h1v1h-1z M8,29h1v1h-1z M10,29h1v1h-1z M11,29h1v1h-1z M12,29h1v1h-1z M14,29h1v1h-1z M16,29h1v1h-1z M18,29h1v1h-1z M19,29h1v1h-1z M21,29h1v1h-1z M22,29h1v1h-1z M23,29h1v1h-1z M27,29h1v1h-1z M28,29h1v1h-1z M30,29h1v1h-1z M0,30h1v1h-1z M2,30h1v1h-1z M3,30h1v1h-1z M4,30h1v1h-1z M6,30h1v1h-1z M8,30h1v1h-1z M12,30h1v1h-1z M15,30h1v1h-1z M16,30h1v1h-1z M20,30h1v1h-1z M24,30h1v1h-1z M25,30h1v1h-1z M26,30h1v1h-1z M30,30h1v1h-1z M31,30h1v1h-1z M0,31h1v1h-1z M6,31h1v1h-1z M8,31h1v1h-1z M9,31h1v1h-1z M12,31h1v1h-1z M16,31h1v1h-1z M18,31h1v1h-1z M20,31h1v1h-1z M21,31h1v1h-1z M22,31h1v1h-1z M26,31h1v1h-1z M27,31h1v1h-1z M29,31h1v1h-1z M30,31h1v1h-1z M0,32h1v1h-1z M1,32h1v1h-1z M2,32h1v1h-1z M3,32h1v1h-1z M4,32h1v1h-1z M5,32h1v1h-1z M6,32h1v1h-1z M8,32h1v1h-1z M13,32h1v1h-1z M16,32h1v1h-1z M17,32h1v1h-1z M18,32h1v1h-1z M21,32h1v1h-1z M22,32h1v1h-1z M23,32h1v1h-1z M24,32h1v1h-1z M27,32h1v1h-1z M28,32h1v1h-1z M29,32h1v1h-1z M31,32h1v1h-1z"
    fill="#FFFFFF"
  />
</svg>`;

const donate = html`
  <div style="background-color: black; color: white; display: flex;">
    <div class="donate-desktop">${qr}</div>
    <div style="margin: 0 25px -5px 10px;">
      <p style="font-weight: bold;">Hey reader, take care of your kiwi</p>
      <p>
        Kiwi is a self-funded project. We are investing our money to grow it. If
        you like reading our site, please consider <b>donating</b> or
        <span> </span>
        <a
          style="color: #7bc1ff; text-decoration: underline; font-weight: bold;"
          href="/welcome?referral=0xD89F78F542B520BF228Bc75C021F9397b9F2c4A9"
          >buying our NFT.</a
        >
      </p>
      <a
        href="ethereum:0xee324c588ceF1BF1c1360883E4318834af66366d?value=3330000000000000"
      >
        <button
          class="donate-mobile"
          id="button-onboarding"
          style="margin: 10px 0 0 0; color: black; background-color: limegreen;"
        >
          Donate
        </button>
      </a>
      <p class="donate-desktop" style="font-family: monospace;">
        0xee324c588ceF1BF1c1360883E4318834af66366d (timdaub.eth)
      </p>
      <p
        class="donate-desktop"
        style="font-size: 0.9rem; display: flex; gap: 25px;"
      >
        <a
          class="donate-desktop"
          style="text-decoration: underline; color: #7bc1ff; font-weight: bold;"
          href="https://etherscan.io/address/0xee324c588ceF1BF1c1360883E4318834af66366d"
          target="_blank"
          >ETH mainnet</a
        >
        <span> </span>
        <a
          class="donate-desktop"
          style="text-decoration: underline; color: #ff0420; font-weight:bold;"
          href="https://optimistic.etherscan.io/address/0xee324c588ceF1BF1c1360883E4318834af66366d"
          target="_blank"
          >Optimism</a
        >
        <span> </span>
        <a
          class="donate-desktop"
          style="text-decoration: underline; color: #0052ff; font-weight:bold;"
          href="https://basescan.org/address/0xee324c588ceF1BF1c1360883E4318834af66366d"
          target="_blank"
          >Base</a
        >
      </p>
    </div>
  </div>
`;

const secondheader = (theme, site, identity) => html`
  <td>
    ${!identity ? donate : ""}
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
              ? "border-bottom: 3px solid limegreen; padding: 0.75rem 1.5rem 0.3rem 1.5rem;"
              : "padding-top: 0.75rem;"}"
          >
            All
          </div>
        </div>
      </a>
      <a
        href="/nfts"
        style="padding: 0 0 0.1rem 0; flex: 1; text-decoration: none; color: inherit;"
      >
        <div
          class="filter-tab"
          style="width: 100%; height: 100%; display: flex; justify-content: center; justify-conten
 center;"
        >
          <div
            style="${site === "nfts"
              ? "border-bottom: 3px solid limegreen; padding: 0.75rem 1.5rem 0.3rem 1.5rem;"
              : "padding-top: 0.65rem"}"
          >
            NFTs
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
