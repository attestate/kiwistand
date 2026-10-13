import React, { Suspense, lazy, useEffect, useState } from "react";
import slugify from "slugify";

import MS from "./ms.jsx";
import { bookmarkAccount, listBookmarks, setBookmark } from "./bookmarks.mjs";

const LoginModal = lazy(() => import("./LoginModal.jsx"));

const norm = (index) => String(index || "").replace(/^0x/, "").toLowerCase();

// "2h", "3d", "1w", like the iOS app.
function shortAge(seconds) {
  const s = Math.max(0, Math.floor(Date.now() / 1000) - seconds);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`;
  if (s < 30 * 86400) return `${Math.floor(s / (7 * 86400))}w`;
  if (s < 365 * 86400) return `${Math.floor(s / (30 * 86400))}mo`;
  return `${Math.floor(s / (365 * 86400))}y`;
}

function source(href) {
  if (!href || href.startsWith("data:")) return "Text post";
  if (href.startsWith("kiwi:")) return "Kiwi News";
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const storyPath = (story) =>
  `/stories/${slugify(story.title || "", { strict: true })}?index=0x${norm(
    story.index,
  )}`;

async function share(story) {
  const url = `https://news.kiwistand.com${storyPath(story)}`;
  if (window.innerWidth <= 640 && navigator.share) {
    navigator.share({ url }).catch(() => {});
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    window.toast?.success?.("Link copied!");
  } catch {
    window.toast?.error?.("Could not copy link");
  }
}

const Row = ({ story, onRemove }) => (
  <li className="kn-saved-item">
    <a className="kn-saved-text" href={storyPath(story)}>
      <span className="kn-saved-domain">{source(story.href)}</span>
      <span className="kn-saved-title">{story.title}</span>
      <span className="kn-saved-meta">
        Saved {shortAge(story.savedAt || story.timestamp)} ago
        {story.commentCount > 0
          ? ` · ${story.commentCount} ${
              story.commentCount === 1 ? "comment" : "comments"
            }`
          : ""}
      </span>
    </a>
    <button
      type="button"
      className="kn-saved-btn"
      aria-label="Share"
      title="Share"
      onClick={() => share(story)}
    >
      <MS name="ios_share" size={20} />
    </button>
    <button
      type="button"
      className="kn-saved-btn kn-saved-remove"
      aria-label="Remove from saved"
      title="Remove from saved"
      onClick={() => onRemove(story)}
    >
      <MS name="bookmark-fill" size={20} />
    </button>
  </li>
);

// The list of /saved (views/saved.mjs): the account's saved stories, newest
// first, with share and remove (and undo). Logged out, a prompt to log in.
export default function SavedStories({ delegations, toast }) {
  const [account] = useState(() => bookmarkAccount());
  const [stories, setStories] = useState(null);
  const [error, setError] = useState(null);
  const [login, setLogin] = useState(false);

  useEffect(() => {
    if (!account) return;
    listBookmarks(account)
      .then(setStories)
      .catch((err) => setError(err.message));
  }, [account]);

  const remove = async (story) => {
    const before = stories;
    setStories(stories.filter((item) => item !== story));
    try {
      await setBookmark(account, story.index, false);
    } catch (err) {
      setStories(before);
      toast?.error?.(err.message);
      return;
    }
    toast?.(
      (t) => (
        <span className="kn-toast-undo">
          Removed from saved stories
          <button
            type="button"
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                await setBookmark(account, story.index, true);
                setStories((current) =>
                  [story, ...current.filter((item) => item !== story)].sort(
                    (a, b) => (b.savedAt || 0) - (a.savedAt || 0),
                  ),
                );
              } catch (err) {
                toast?.error?.(err.message);
              }
            }}
          >
            Undo
          </button>
        </span>
      ),
      { duration: 5000 },
    );
  };

  if (!account) {
    return (
      <div className="kn-saved-empty">
        <MS name="bookmark" size={32} />
        <p className="kn-saved-empty-title">Log in to see your saved stories</p>
        <p className="kn-saved-empty-copy">
          Save any story with the bookmark under it. Only you can see this list.
        </p>
        <button
          type="button"
          className="kn-btn kn-btn-accent"
          onClick={() => setLogin(true)}
        >
          Log in
        </button>
        {login && (
          <Suspense fallback={null}>
            <LoginModal
              defaultOpen={true}
              delegations={delegations}
              toast={toast}
              onClose={() => setLogin(false)}
            />
          </Suspense>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="kn-saved-empty">
        <p className="kn-saved-empty-title">Couldn't load your saved stories</p>
        <p className="kn-saved-empty-copy">{error}</p>
      </div>
    );
  }

  if (!stories) {
    return (
      <>
        <p className="kn-saved-count">Loading…</p>
        <ul className="kn-saved-list kn-saved-loading" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="kn-saved-item kn-saved-skeleton" />
          ))}
        </ul>
      </>
    );
  }

  return (
    <>
      <p className="kn-saved-count">
        {stories.length} {stories.length === 1 ? "story" : "stories"} · Only
        visible to you
      </p>
      {stories.length === 0 ? (
        <div className="kn-saved-empty">
          <MS name="bookmark" size={32} />
          <p className="kn-saved-empty-title">Nothing saved yet</p>
          <p className="kn-saved-empty-copy">
            Tap the bookmark under any story to read it later.
          </p>
        </div>
      ) : (
        <ul className="kn-saved-list">
          {stories.map((story) => (
            <Row key={story.index} story={story} onRemove={remove} />
          ))}
        </ul>
      )}
    </>
  );
}
