import htm from "htm";
import vhtml from "vhtml";

import { custom } from "./components/head.mjs";
import * as parser from "../parser.mjs";
import { Page, Icon } from "./components/n2.mjs";

const html = htm.bind(vhtml);

export default async function submit(theme, url = "", title = "", tab = "") {
  // NOTE: /submit?tab=post opens the Post tab (SubmitButton.jsx keeps the
  // parameter in sync), rendered here already so nothing jumps.
  const isPost = tab === "post" && !url;
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
    body: html`<div class="n2-submit${isPost ? " is-post" : ""}">
      <form
                      id="n2-submit-form"
                      class="n2-submit-form${isPost ? " is-post" : ""}"
                      onsubmit="event.preventDefault(); return false;"
                    >
                      <header class="n2-page-head n2-submit-head">
                        <h1 class="n2-title">
                          <span class="n2-head-link"
                            ><span class="n2-d">Submit a story</span
                            ><span class="n2-m">Share with the community</span></span
                          >
                          <span class="n2-head-post">Share with the community</span>
                        </h1>
                        <p class="n2-sub">
                          <span class="n2-sub-link"
                            >A link, an idea, a fresh perspective.</span
                          >
                          <span class="n2-sub-post"
                            >Say something. Up to 200 characters and one
                            picture.</span
                          >
                        </p>
                      </header>
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
                            aria-selected="${isPost ? "false" : "true"}"
                            class="n2-tab${isPost ? "" : " is-active"}"
                            disabled
                          >
                            Link
                          </button>
                          <button
                            type="button"
                            role="tab"
                            aria-selected="${isPost ? "true" : "false"}"
                            class="n2-tab${isPost ? " is-active" : ""}"
                            disabled
                          >
                            Post
                          </button>
                        </div>
                        ${isPost
                          ? html`<div class="n2-field n2-field-post">
                              <label class="n2-label n2-d">Post</label>
                              <div class="n2-post-box">
                                <textarea
                                  class="n2-post-textarea"
                                  rows="4"
                                  placeholder="What's on your mind?"
                                  disabled
                                ></textarea>
                                <div class="n2-post-tools">
                                  <span class="n2-post-add" aria-disabled="true"
                                    >${Icon("addPhoto")}Add image<span
                                      class="n2-post-add-count"
                                      >0/1</span
                                    ></span
                                  >
                                </div>
                              </div>
                              <div class="n2-hint-row">
                                <span class="n2-hint"
                                  >Links work. The picture shows under your
                                  text.</span
                                >
                              </div>
                            </div>`
                          : null}
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
                            ${isPost ? "Post" : "Submit"}
                          </button>
                          <span class="n2-note n2-d"
                            >${isPost
                              ? "Your post is signed with your account and is public."
                              : "Your submission is signed with your account and is public."}</span
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
                        <ul class="n2-tips-link">
                          <li>${Icon("check")}Link to the original source, not a repost.</li>
                          <li>${Icon("check")}Keep the original title. No clickbait or ALL CAPS.</li>
                          <li>${Icon("check")}Check it hasn't been posted this week.</li>
                          <li>${Icon("check")}Builders, research, tools and ideas do best.</li>
                        </ul>
                        <ul class="n2-tips-post">
                          <li>${Icon("check")}Say something builders want to read.</li>
                          <li>${Icon("check")}One picture, yours to share. No NSFW.</li>
                          <li>${Icon("check")}No ads, shilling or giveaways.</li>
                          <li>${Icon("check")}A link? Use the Link tab instead.</li>
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
