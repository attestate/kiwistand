//@format
import htm from "htm";
import vhtml from "vhtml";

const html = htm.bind(vhtml);

export default function Trollbox() {
  return html`
    <div class="right-column" style="width:280px;flex-shrink:0;">
      <aside id="trollbox" class="trollbox-panel">
        <div
          style="display:flex;flex-direction:column;height:100%;font-size:13px;min-height:0;"
        >
          <div
            style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid rgba(166,110,78,0.15);font-weight:600;font-size:12px;color:#666;text-transform:uppercase;letter-spacing:0.5px;"
          >
            <span>trollbox</span>
            <span style="font-size:11px;font-weight:400;color:#999;"
              >connecting...</span
            >
          </div>
          <div style="flex:1;overflow-y:auto;padding:8px;">
            <div
              style="color:#999;text-align:center;padding:20px 10px;font-size:12px;"
            >
              No messages yet. Say something!
            </div>
          </div>
          <div style="padding:8px;border-top:1px solid rgba(166,110,78,0.15);">
            <div
              style="text-align:center;color:#999;font-size:12px;padding:4px;"
            >
              Sign in to chat
            </div>
          </div>
        </div>
      </aside>
      <div id="testflight-qr-container"></div>
    </div>
  `;
}
