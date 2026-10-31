import htm from "htm";
import vhtml from "vhtml";

import { custom } from "./components/head.mjs";
import * as parser from "../parser.mjs";
import { Page, Icon } from "./components/n2.mjs";
import { communityData } from "./community.mjs";

const html = htm.bind(vhtml);

// `community`: the one "Post to" starts on (/submit?community=<id>).
export default async function submit(theme, url = "", title = "", community = null) {
  if (url && !title) {
    let data;
    try {
      const generateTitle = true;
      data = await parser.metadata(url, generateTitle);
    } catch (err) {
      // noop, if the request fails we just continue as though nothing ever happened.
    }
    if (data && data.ogTitle) {
      title = data.ogTitle;
    }
    if (data && data.canonicalLink) {
      url = data.canonicalLink;
    }
  }
  const path = "/submit";
  const remaining = 80 - title.length;
  return Page({
    theme,
    path,
    wide: true,
    head: custom(
      undefined,
      "Submit | Kiwi News",
      "Submit a link to share with the Kiwi News community.",
      undefined,
      ["/"],
    ),
    body: html`<div class="n2-submit">
      <form
                      id="n2-submit-form"
                      class="n2-submit-form"
                      onsubmit="event.preventDefault(); return false;"
                    >
                      <header class="n2-page-head n2-submit-head">
                        <h1 class="n2-title">
                          <span class="n2-d">Submit a story</span>
                          <span class="n2-m">Share with the community</span>
                        </h1>
                        <p class="n2-sub">
                          <span class="n2-sub-link"
                            >A link, an idea, a fresh perspective.</span
                          >
                          <span class="n2-sub-text"
                            >Start a thoughtful conversation.</span
                          >
                        </p>
                      </header>
                      <div
                        id="n2-post-to"
                        class="n2-field n2-post-to"
                        data-community="${community ? communityData(community) : null}"
                      ></div>
                      <div class="n2-field n2-field-title">
                        <label for="titleInput" class="n2-label"
                          >Title<span class="n2-m">:</span></label
                        >
                        <div
                          contenteditable="true"
                          role="textbox"
                          aria-multiline="true"
                          id="titleInput"
                          class="n2-input n2-title-input"
                          name="title"
                          maxlength="80"
                          required
                          wrap="soft"
                          data-placeholder="Enter title"
                          onpaste="
                            event.preventDefault();
                            const text = event.clipboardData.getData('text/plain');
                            document.execCommand('insertText', false, text);"
                        >${title}</div>
                        <div class="n2-hint-row">
                          <span class="n2-hint n2-d"
                            >Use the original title. No clickbait.</span
                          >
                          <span class="n2-count"
                            ><span class="n2-m">Characters remaining: </span
                            ><span class="remaining">${remaining}</span
                            ><span class="n2-d"> characters left</span></span
                          >
                        </div>
                      </div>
                      <div id="submit-button" class="n2-submit-root">
                        <div class="n2-tabs" role="tablist">
                          <button
                            type="button"
                            role="tab"
                            aria-selected="true"
                            class="n2-tab is-active"
                            disabled
                          >
                            Link
                          </button>
                          <button
                            type="button"
                            role="tab"
                            aria-selected="false"
                            class="n2-tab"
                            disabled
                          >
                            Text
                          </button>
                        </div>
                        <div class="n2-field n2-field-link">
                          <label for="urlInput" class="n2-label n2-d"
                            >Link</label
                          >
                          <input
                            placeholder="Enter or paste article URL"
                            id="urlInput"
                            class="n2-input"
                            type="text"
                            name="link"
                            size="50"
                            maxlength="2048"
                            required
                            value="${url}"
                          />
                          <div class="n2-hint-row n2-d">
                            <span class="n2-hint"
                              >Paste the link to the original source.</span
                            >
                          </div>
                        </div>
                        <div class="n2-upload-row">
                          <span class="n2-btn-outline n2-upload" aria-disabled="true"
                            >${Icon("addPhoto")}<span class="n2-d"
                              >Upload image</span
                            ><span class="n2-m">Upload Image</span></span
                          >
                          <span class="n2-hint n2-d"
                            >Optional. Replaces the preview image from the
                            link.</span
                          >
                        </div>
                        <div class="n2-actions">
                          <button id="button-onboarding" class="n2-btn" disabled>
                            Submit
                          </button>
                          <span class="n2-note n2-d"
                            >Your submission is signed with your account and is
                            public.</span
                          >
                        </div>
                      </div>
                      <div class="n2-preview-wrap">
                        <div class="n2-eyebrow n2-d">Preview</div>
                        <div
                          style="${previewStyle}"
                          id="embed-preview"
                          class="n2-preview"
                        ></div>
                      </div>
                    </form>
                    <aside class="n2-submit-aside n2-d" aria-label="Before you submit">
                      <div class="n2-card n2-tips">
                        <div class="n2-eyebrow">Before you submit</div>
                        <ul>
                          <li>${Icon("check")}Link to the original source, not a repost.</li>
                          <li>${Icon("check")}Keep the original title. No clickbait or ALL CAPS.</li>
                          <li>${Icon("check")}Check it hasn't been posted this week.</li>
                          <li>${Icon("check")}Builders, research, tools and ideas do best.</li>
                        </ul>
                        <a class="n2-arrow-link" href="/guidelines"
                          >Read the guidelines${Icon("arrow")}</a
                        >
                      </div>
                    </aside>
    </div>`,
  });
}

// NOTE: The link preview (parser.mjs render, SubmitButton.jsx) is user
// content and keeps main's box.
const previewStyle = `
  width: 100%;
  max-width: 600px;
  min-height: 450px;
  font-size: 16px;
  box-sizing: border-box;
`;
