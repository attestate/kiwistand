//@format
import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import RightColumn from "./components/right-column.mjs";
import { custom } from "./components/head.mjs";
import { ms } from "./components/icons.mjs";

const html = htm.bind(vhtml);

// The desktop right column's "Your reading list" box.
const ReadingListBox = () => html`
  <div class="kn-side-box kn-reading-box">
    <span class="kn-eyebrow">Your reading list</span>
    <ul class="kn-reading-tips">
      <li>${ms("bookmark-simple", 16)}<span>Save any story with the bookmark under it.</span></li>
      <li>${ms("lock-simple", 16)}<span>Only you can see this list.</span></li>
      <li>${ms("device-mobile", 16)}<span>It syncs with the Kiwi News iOS app.</span></li>
    </ul>
  </div>
`;

// NOTE: What SavedStories.jsx shows first, rendered here so the page looks
// complete at first paint and nothing moves when it mounts: its loading
// state (count line and skeleton rows) for browsers with a Kiwi key, its
// "Log in" prompt for the others. theme-init.js sets data-signed-out before
// the first paint and news.css shows the matching one. Keep the markup in
// sync with SavedStories.jsx.
const SavedPlaceholder = () => html`
  <div class="kn-saved-ssr-in">
    <p class="kn-saved-count">Loading…</p>
    <ul class="kn-saved-list kn-saved-loading" aria-busy="true">
      <li class="kn-saved-item kn-saved-skeleton"></li>
      <li class="kn-saved-item kn-saved-skeleton"></li>
      <li class="kn-saved-item kn-saved-skeleton"></li>
    </ul>
  </div>
  <div class="kn-saved-empty kn-saved-ssr-out">
    ${ms("bookmark-simple", 32)}
    <p class="kn-saved-empty-title">Log in to see your saved stories</p>
    <p class="kn-saved-empty-copy">
      Save any story with the bookmark under it. Only you can see this list.
    </p>
    <span class="kn-btn kn-btn-accent">Log in</span>
  </div>
`;

// Saved stories (NEU 2: iOS "Saved stories · List (variant)" and "Web 2 ·
// Desktop · Saved stories"). The list is private: SavedStories.jsx signs the
// request with this browser's key and fills <kiwi-saved-stories>. The page
// itself is the same for everyone.
export default async function (theme) {
  const path = "/saved";
  return "<!DOCTYPE html>" + html`
    <html lang="en" op="news">
      <head>
        ${custom(
          undefined,
          "Saved stories | Kiwi News",
          "Your reading list on Kiwi News. Only visible to you.",
        )}
        <meta name="robots" content="noindex" />
      </head>
      <body ontouchstart="">
        <div class="container">
          ${Sidebar(path)}
          ${RightColumn({ newsletter: false, children: ReadingListBox() })}
          <main id="hnmain" class="scaled-hnmain" role="main">
            <table
              border="0"
              cellpadding="0"
              cellspacing="0"
              bgcolor="var(--background-color0)"
            >
              <tr>
                ${Header(theme, path)}
              </tr>
              <tr>
                <td class="kn-saved-page">
                  <h1 class="kn-headline kn-saved-headline">Saved stories</h1>
                  <p class="kn-sub">Your reading list. Ready when you are.</p>
                  <kiwi-saved-stories>
                    ${SavedPlaceholder()}
                  </kiwi-saved-stories>
                </td>
              </tr>
            </table>
            ${Footer(theme, path)}
          </main>
        </div>
      </body>
    </html>
  `;
}
