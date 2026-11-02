// @format
// NOTE: What the templates' on…= attributes did. The script policy
// (src/securityheaders.mjs) runs no inline handlers, so server-rendered
// markup names its action in data-action (plus the data-* it reads) and the
// listeners below, on document, do it. Rows added later (endless scroll,
// islands) need nothing bound to them.

const modified = (e) => e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1;

// Hosts the apps (iOS app, mini app) hand to the system browser instead of
// the embed drawer. Story titles only do that for X (data-app-hosts="x").
const X_HOSTS = ["x.com", "twitter.com"];
const APP_HOSTS = [...X_HOSTS, "farcaster.xyz", "warpcast.com"];

const click = {
  spinner(e, el, win) {
    if (modified(e)) return;
    const overlay = win.document.getElementById("spinner-overlay");
    if (overlay) overlay.style.display = "block";
    if (el.dataset.beacon) beacon(win, el.dataset.href);
  },

  // A story's link: in the apps the embed drawer or the system browser,
  // else a new tab.
  outbound(e, el, win) {
    e.preventDefault();
    const url = el.dataset.href;
    beacon(win, url);
    if (!win.ReactNativeWebView && win === win.parent) {
      return win.open(url, el.getAttribute("target") || "_blank");
    }
    const hasOpenUrl = Boolean(win.sdk?.actions?.openUrl);
    const drawer = () =>
      win.openEmbedDrawer ? win.openEmbedDrawer(url) : win.open(url, "_blank");
    try {
      const host = new URL(url).hostname.toLowerCase();
      const xOnly = el.dataset.appHosts === "x";
      const external =
        (!xOnly && host.endsWith(".substack.com")) ||
        (xOnly ? X_HOSTS : APP_HOSTS).some(
          (d) => host === d || host.endsWith("." + d),
        );
      if (external) {
        hasOpenUrl ? win.sdk.actions.openUrl(url) : win.open(url, "_blank");
      } else if (el.dataset.canIframe !== "true" && hasOpenUrl) {
        win.sdk.actions.openUrl(url);
      } else {
        drawer();
      }
    } catch (err) {
      drawer();
    }
  },

  // A link in a comment: the apps open it with sdk.actions.openUrl.
  "app-link"(e, el, win) {
    if (!win.ReactNativeWebView && win === win.parent) return;
    e.preventDefault();
    win.sdk.actions.openUrl(el.dataset.url);
  },

  "outbound-tab"(e, el, win) {
    e.preventDefault();
    beacon(win, el.dataset.href);
    win.open(el.dataset.href, "_blank");
  },

  "image-viewer"(e, el, win) {
    e.preventDefault();
    if (win.openImageViewer) win.openImageViewer(el.dataset.href);
  },

  // The chat bubble opens the story's comments inline.
  comments(e, el, win) {
    e.preventDefault();
    const si = el.dataset.storyIdx;
    el.classList.toggle("comment-button-active");
    openComments(win, si, "chat-bubble");
    const preview = win.document.querySelector(".comment-preview-0x" + si);
    if (preview) preview.style.opacity = 1;
    const border = win.document.querySelector(
      ".without-comment-preview-0x" + si,
    );
    if (border) border.classList.toggle("no-border");
  },

  // The comment preview under a row does too, and lands on that comment.
  // Cmd/Ctrl/Shift click keeps the link to the story page.
  "comment-preview"(e, el, win) {
    if (modified(e)) return;
    e.preventDefault();
    const { pathname, search } = win.location;
    win.history.replaceState(
      null,
      "",
      `${pathname}${search}#0x${el.dataset.commentIdx}`,
    );
    openComments(win, el.dataset.storyIdx, "comment-preview");
    const bubble = win.document.getElementById(
      "chat-bubble-" + el.dataset.storyIdx,
    );
    if (bubble) bubble.classList.add("comment-button-active");
  },

  share(e, el, win) {
    e.preventDefault();
    const { storySlug, storyIndex, storyHref } = el.dataset;
    const url = `https://news.kiwistand.com/stories/${storySlug}?index=${storyIndex}`;
    if (typeof win.kiwiTrackShare === "function") {
      win.kiwiTrackShare(storyHref, "native");
    }
    if (win.innerWidth <= 640 && win.navigator.share) {
      win.navigator.share({ url }).catch(() => {});
    } else {
      copyLink(win, url);
    }
  },

  "share-url"(e, el, win) {
    e.preventDefault();
    win.navigator.share({ url: el.dataset.shareUrl });
  },

  copy(e, el, win) {
    win.navigator.clipboard.writeText(el.dataset.copyText);
  },
};

const submit = { "no-submit": (e) => e.preventDefault() };

// Paste as plain text into a contenteditable.
const paste = {
  "plain-paste"(e, el, win) {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    win.document.execCommand("insertText", false, text);
  },
};

function beacon(win, url) {
  win.navigator.sendBeacon &&
    win.navigator.sendBeacon("/outbound?url=" + encodeURIComponent(url));
}

function openComments(win, si, source) {
  win.dispatchEvent(
    new win.CustomEvent("open-comments-0x" + si, { detail: { source } }),
  );
  win.dispatchEvent(new win.HashChangeEvent("hashchange"));
}

async function copyLink(win, url) {
  try {
    await win.navigator.clipboard.writeText(url);
  } catch (err) {
    try {
      const ta = win.document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      win.document.body.appendChild(ta);
      ta.select();
      win.document.execCommand("copy");
      win.document.body.removeChild(ta);
    } catch (err2) {
      win.toast?.error?.("Could not copy link");
      return;
    }
  }
  win.toast?.success?.("Link copied!");
}

// A broken image shows data-fallback-src instead (once), or is hidden
// (data-hide-on-error).
function imageFailed(img) {
  const { fallbackSrc } = img.dataset;
  if (fallbackSrc) {
    delete img.dataset.fallbackSrc;
    img.src = fallbackSrc;
  } else if ("hideOnError" in img.dataset) {
    img.style.display = "none";
  }
}

function delegate(doc, type, actions) {
  const selector = Object.keys(actions)
    .map((name) => `[data-action="${name}"]`)
    .join(",");
  doc.addEventListener(type, (e) => {
    const el = e.target.closest?.(selector);
    if (el) actions[el.dataset.action](e, el, doc.defaultView);
  });
}

export function installDataActions(doc = document) {
  delegate(doc, "click", click);
  delegate(doc, "submit", submit);
  delegate(doc, "paste", paste);
  // error doesn't bubble, but it passes document while capturing. Images
  // that failed before this ran are caught up on.
  doc.addEventListener(
    "error",
    (e) => e.target.tagName === "IMG" && imageFailed(e.target),
    true,
  );
  doc
    .querySelectorAll("img[data-fallback-src], img[data-hide-on-error]")
    .forEach((img) => img.complete && !img.naturalWidth && imageFailed(img));
  // iOS Safari only applies :active styles on a page with a touchstart
  // listener (the templates had an empty one on <body>).
  doc.addEventListener("touchstart", () => {}, { passive: true });
}
