//@format
import htm from "htm";
import vhtml from "vhtml";
const html = htm.bind(vhtml);
const pwaline = html`
  <div
    class="ios-pwa-line"
    style="line-height: 1.2; background-color: #f9f9f9; padding: 10px; display: none; align-items: center;
 justify-content: space-between;"
  >
    <div style="display: flex; align-items: center;">
      <div
        style="cursor:
 pointer; padding-right: 10px;"
        onclick="document.querySelector('.ios-pwa-line').style.display='none';
 localStorage.setItem('-kiwi-news-has-visited', 'true');"
      >
        ✕
      </div>
      <img
        src="/pwa_icon.png"
        alt="App Icon"
        style="width: 60px; height: 60px; border-radius:
 14px; margin-right: 10px;"
      />
      <div>
        <div style="color: black; font-size: 18px; font-weight: bold;">
          Kiwi News
        </div>
        <div style="font-size: 14px;">hand-picked web3 alpha</div>
      </div>
    </div>
    <nav-onboarding-modal />
    <div class="nav-onboarding-modal">
      <button
        style="margin-right: 15px; background-color: #007aff; color: white; padding: 6px 15px; border: none; border-radius: 15px;"
      >
        Install
      </button>
    </div>
  </div>
`;
export default pwaline;
