// @format
import test from "ava";
import { JSDOM, VirtualConsole } from "jsdom";

import { installDataActions } from "../src/web/src/dataActions.mjs";

// A page with the listeners installed. calls records what they did.
function page(body, setup = () => {}) {
  const { window } = new JSDOM(`<body>${body}</body>`, {
    url: "https://news.kiwistand.com/new",
    // NOTE: Silences jsdom's "navigation not implemented" for plain links.
    virtualConsole: new VirtualConsole(),
  });
  const calls = [];
  const log =
    (name) =>
    (...args) => {
      calls.push([name, ...args]);
      return Promise.resolve();
    };
  window.open = log("open");
  window.openEmbedDrawer = log("drawer");
  window.sdk = { actions: { openUrl: log("openUrl") } };
  window.kiwiTrackShare = log("track");
  window.toast = { success: log("toast") };
  window.document.execCommand = log("execCommand");
  for (const name of ["sendBeacon", "share"]) {
    Object.defineProperty(window.navigator, name, { value: log(name) });
  }
  Object.defineProperty(window.navigator, "clipboard", {
    value: { writeText: log("copy") },
  });
  setup(window);
  installDataActions(window.document);
  const $ = (selector) => window.document.querySelector(selector);
  // Returns whether the click's default action was prevented.
  const click = (selector, init) =>
    !$(selector).dispatchEvent(
      new window.MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        ...init,
      }),
    );
  return { window, calls, $, click };
}

test("outbound links: a beacon, then a new tab, or in the apps the drawer or openUrl", (t) => {
  const { window, calls, click } = page(`
    <a id="a" data-action="outbound" data-href="https://example.com/a" data-can-iframe="true" href="https://example.com/a"><b>a</b></a>
    <a id="x" data-action="outbound" data-href="https://x.com/u/status/1" data-can-iframe="true"></a>
    <a id="fc" data-action="outbound" data-href="https://farcaster.xyz/u/0x1" data-can-iframe="true"></a>
    <a id="noframe" data-action="outbound" data-href="https://example.com/b" data-can-iframe="false"></a>
    <a id="title" data-action="outbound" data-app-hosts="x" data-href="https://farcaster.xyz/u/0x1" data-can-iframe="true"></a>
    <a id="tab" data-action="outbound-tab" data-href="https://bsky.app/p/1"></a>
    <a id="comment" data-action="app-link" data-url="https://example.com/c" href="https://example.com/c" target="_blank"></a>`);
  // A link in a comment is a plain link on the website.
  t.false(click("#comment"));
  t.true(click("#a b"));
  t.deepEqual(calls, [
    ["sendBeacon", "/outbound?url=https%3A%2F%2Fexample.com%2Fa"],
    ["open", "https://example.com/a", "_blank"],
  ]);

  calls.length = 0;
  window.ReactNativeWebView = {};
  for (const id of ["a", "x", "fc", "noframe", "title", "tab"]) click(`#${id}`);
  t.true(click("#comment"));
  t.deepEqual(
    calls.filter(([name]) => name !== "sendBeacon"),
    [
      ["drawer", "https://example.com/a"],
      ["openUrl", "https://x.com/u/status/1"],
      ["openUrl", "https://farcaster.xyz/u/0x1"],
      ["openUrl", "https://example.com/b"],
      // Story titles only hand X to the system browser.
      ["drawer", "https://farcaster.xyz/u/0x1"],
      ["open", "https://bsky.app/p/1", "_blank"],
      ["openUrl", "https://example.com/c"],
    ],
  );
});

test("in-app links show the spinner on plain clicks only", (t) => {
  const { $, calls, click } = page(`
    <div id="spinner-overlay" style="display: none"></div>
    <a id="link" data-action="spinner" href="/best">Top</a>
    <a id="picture" data-action="spinner" data-beacon="true" data-href="https://imagedelivery.net/a/b/public" href="/stories/a?index=0x1">a</a>`);
  t.false(click("#link", { metaKey: true }));
  t.is($("#spinner-overlay").style.display, "none");
  t.false(click("#link"));
  t.is($("#spinner-overlay").style.display, "block");
  t.deepEqual(calls, []);
  click("#picture");
  t.deepEqual(calls, [
    [
      "sendBeacon",
      "/outbound?url=https%3A%2F%2Fimagedelivery.net%2Fa%2Fb%2Fpublic",
    ],
  ]);
});

test("chat bubbles and comment previews open the comments inline, also in rows added later", (t) => {
  const { window, $, click } = page("");
  const opened = [];
  window.addEventListener("open-comments-0xab", (e) =>
    opened.push(e.detail.source),
  );
  // As endless scroll adds rows: after the listeners were installed.
  window.document.body.innerHTML = `
    <a id="chat-bubble-ab" data-action="comments" data-story-idx="ab" href="/stories/a?index=0xab"></a>
    <div class="comment-preview-0xab" style="opacity: 0"></div>
    <a id="preview" data-action="comment-preview" data-story-idx="ab" data-comment-idx="cd" href="/stories/a?index=0xab#0xcd"></a>`;
  t.true(click("#chat-bubble-ab"));
  t.true($("#chat-bubble-ab").classList.contains("comment-button-active"));
  t.is($(".comment-preview-0xab").style.opacity, "1");
  t.false(click("#preview", { ctrlKey: true }));
  t.true(click("#preview"));
  t.is(window.location.hash, "#0xcd");
  t.deepEqual(opened, ["chat-bubble", "comment-preview"]);
});

test("share copies the story's link on wide screens and shares it on phones", async (t) => {
  const { window, calls, click } = page(`
    <button id="share" data-action="share" data-story-slug="hello" data-story-index="0xab" data-story-href="https://example.com/a"></button>`);
  const url = "https://news.kiwistand.com/stories/hello?index=0xab";
  t.true(click("#share"));
  await new Promise((resolve) => setTimeout(resolve));
  t.deepEqual(calls, [
    ["track", "https://example.com/a", "native"],
    ["copy", url],
    ["toast", "Link copied!"],
  ]);
  calls.length = 0;
  window.innerWidth = 400;
  click("#share");
  t.deepEqual(calls[1], ["share", { url }]);
});

test("the submit form, pasted titles and broken images", (t) => {
  const { window, $, calls } = page(
    `<form id="form" data-action="no-submit"><input /></form>
    <div id="title" contenteditable="true" data-action="plain-paste"><b>x</b></div>
    <img id="placeholder" data-fallback-src="data:image/svg+xml,a" src="https://example.com/a.png" />
    <img id="hidden" data-hide-on-error src="https://example.com/b.png" />`,
    // Failed before the listeners were installed.
    (window) => {
      const img = window.document.querySelector("#hidden");
      Object.defineProperty(img, "complete", { value: true });
    },
  );
  const event = (type) =>
    new window.Event(type, { bubbles: true, cancelable: true });
  t.false($("#form").dispatchEvent(event("submit")));

  const paste = event("paste");
  paste.clipboardData = {
    getData: (type) => (type === "text/plain" ? "Plain" : ""),
  };
  t.false($("#title b").dispatchEvent(paste));
  t.deepEqual(calls, [["execCommand", "insertText", false, "Plain"]]);

  t.is($("#hidden").style.display, "none");
  $("#placeholder").dispatchEvent(new window.Event("error"));
  t.is($("#placeholder").src, "data:image/svg+xml,a");
  // Only once, so a broken placeholder doesn't loop.
  $("#placeholder").dispatchEvent(new window.Event("error"));
  t.is($("#placeholder").getAttribute("data-fallback-src"), null);
});
