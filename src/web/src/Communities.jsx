// @format
// Your communities, and what depends on them: Join and Joined, the Home
// tabs and side box, the Joined tab of /communities, a community's "Invite
// people" and the page an invite link opens.
//
// NOTE: This is the one place membership comes from. It isn't on the
// protocol (yet), so a community is yours when you joined it in this browser
// (localStorage, like the iOS app keeps it on the phone; theme-init.js reads
// the same key before the first paint) or when your account runs it
// (GET /api/v1/communities?owner=, on every device). You can't leave a
// community you run.
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import {
  canLeave,
  colorVars,
  creator,
  inviteURL,
  isOwner,
  shortName,
  yourCommunities,
} from "./communities.mjs";
import { paths as ui } from "./cm-icons.mjs";
import { getCookie, getLocalAccount } from "./session.mjs";
import { capture } from "./analytics.mjs";

const KEY = "kiwi-communities";
const EVENT = "kiwi-communities";

// ---------------------------------------------------------------- storage

const fields = [
  "id",
  "name",
  "about",
  "icon",
  "path",
  "color",
  "owner",
  "ownerName",
  "created",
];

function entry(community) {
  return Object.fromEntries(fields.map((key) => [key, community[key] ?? null]));
}

// Joined in this browser, newest first.
export function readJoined() {
  let list;
  try {
    list = JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch (err) {
    return [];
  }
  if (!Array.isArray(list)) return [];
  return list.filter(
    (c) => c && typeof c.id === "string" && typeof c.name === "string",
  );
}

function writeJoined(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch (err) {
    // Private mode or storage full: joining lasts until the page reloads.
  }
  window.dispatchEvent(new Event(EVENT));
}

// Who's reading: the account of the wallet or of the local Kiwi key.
// main.jsx announces a change ("kiwi-identity") once the wallet connects.
export function currentIdentity() {
  let local;
  try {
    local = getLocalAccount();
  } catch (err) {
    local = null;
  }
  return window.__kiwiIdentity || local?.identity || getCookie("identity");
}

export function useIdentity() {
  const [identity, setIdentity] = useState(currentIdentity);
  useEffect(() => {
    const update = () => setIdentity(currentIdentity());
    window.addEventListener("kiwi-identity", update);
    return () => window.removeEventListener("kiwi-identity", update);
  }, []);
  return identity;
}

// The communities your account runs, loaded once per page and identity.
let owned = { identity: null, list: [] };
function loadOwned(identity) {
  const key = identity ? identity.toLowerCase() : null;
  if (owned.identity === key) return;
  owned = { identity: key, list: [] };
  if (!key) return;
  fetch(`/api/v1/communities?owner=${key}&limit=200`)
    .then((response) => response.json())
    .then(({ data }) => {
      if (owned.identity !== key || !Array.isArray(data)) return;
      owned = { identity: key, list: data.map(entry) };
      window.dispatchEvent(new Event(EVENT));
    })
    .catch((err) => console.error("Couldn't load your communities", err));
}

export function join(community) {
  const list = readJoined().filter((c) => c.id !== community.id);
  writeJoined([entry(community), ...list]);
  capture("community_joined", { community: community.id });
}

export function leave(community, identity) {
  if (!canLeave(community, identity)) return;
  writeJoined(readJoined().filter((c) => c.id !== community.id));
  capture("community_left", { community: community.id });
}

// Refreshes a joined community's entry (its owner may have changed its
// name, icon or colour).
export function remember(community) {
  const list = readJoined();
  const index = list.findIndex((c) => c.id === community.id);
  if (index === -1) return;
  const fresh = entry(community);
  if (JSON.stringify(list[index]) === JSON.stringify(fresh)) return;
  list[index] = fresh;
  writeJoined(list);
}

// Your communities: joined here, then the ones you run (yourCommunities).
export function useJoined() {
  const identity = useIdentity();
  const read = () => yourCommunities(readJoined(), owned.list);
  const [list, setList] = useState(read);
  useEffect(() => {
    const update = () => setList(read());
    loadOwned(identity);
    update();
    window.addEventListener(EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, [identity]);
  return list;
}

// ---------------------------------------------------------------- drawing

export function Svg({ path, size = 16, className = "cm-icon" }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

export function UI({ name, size = 16 }) {
  return <Svg path={ui[name]} size={size} />;
}

// A community's icon: its path when we have it (joined here, the pages hand
// it over), else the server's SVG of it (/icons/phosphor/, e.g. for the
// communities you run, which the API names only), as a mask in the current
// colour.
export function CommunityIcon({ community, size }) {
  if (community.path) return <Svg path={community.path} size={size} />;
  const url = `url("/icons/phosphor/${community.icon}.svg")`;
  return (
    <span
      className="cm-icon cm-mask"
      style={{ width: size, height: size, "--icon": url }}
      aria-hidden="true"
    />
  );
}

export function Tile({ community, size, iconSize, variant = "soft" }) {
  return (
    <span
      className={`cm-c cm-tile cm-tile-${variant}`}
      style={{ ...colorVars(community.color), width: size, height: size }}
      aria-hidden="true"
    >
      <CommunityIcon community={community} size={iconSize} />
    </span>
  );
}

const href = (community) => `/c/${community.id}`;

// ---------------------------------------------------------------- pieces

// Join or Joined; for the community's owner, who can't leave it, "Invite"
// instead (design 12's owner state).
function JoinButton({ community, size = "" }) {
  const identity = useIdentity();
  const joined = useJoined().some((c) => c.id === community.id);
  const [inviting, setInviting] = useState(false);
  const cls = size ? ` cm-btn-${size}` : "";
  if (isOwner(community, identity)) {
    return (
      <>
        <button
          type="button"
          className={`cm-btn cm-btn-dark${cls}`}
          onClick={() => setInviting(true)}
        >
          <UI name="user-plus" size={size ? 14 : 16} />
          Invite
        </button>
        {inviting && (
          <InviteModal
            community={community}
            inviter={identity}
            onClose={() => setInviting(false)}
          />
        )}
      </>
    );
  }
  if (joined) {
    return (
      <button
        type="button"
        className={`cm-btn cm-btn-outline${cls}`}
        onClick={() => leave(community, identity)}
        aria-pressed="true"
      >
        <UI name="check-bold" size={size ? 14 : 15} />
        Joined
      </button>
    );
  }
  return (
    <button
      type="button"
      className={`cm-btn cm-btn-dark${cls}`}
      onClick={() => join(community)}
      aria-pressed="false"
    >
      <UI name="plus-bold" size={size ? 14 : 15} />
      Join
    </button>
  );
}

function share(name, url) {
  const text = `Join ${name} on Kiwi News`;
  const e = encodeURIComponent;
  return [
    {
      label: "X (Twitter)",
      icon: "x-logo",
      href: `https://x.com/intent/tweet?text=${e(text)}&url=${e(url)}`,
    },
    {
      label: "Telegram",
      icon: "telegram-logo",
      href: `https://t.me/share/url?url=${e(url)}&text=${e(text)}`,
    },
    {
      label: "WhatsApp",
      icon: "whatsapp-logo",
      href: `https://wa.me/?text=${e(`${text}: ${url}`)}`,
    },
    {
      label: "Email",
      icon: "envelope-simple",
      href: `mailto:?subject=${e(text)}&body=${e(`${text}:\n\n${url}`)}`,
    },
  ];
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    const input = document.createElement("textarea");
    input.value = text;
    document.body.appendChild(input);
    input.select();
    const done = document.execCommand("copy");
    input.remove();
    return done;
  }
}

export function Modal({ label, small = false, onClose, children }) {
  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);
  return (
    <div
      className="cm-overlay"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className={`cm-modal${small ? " cm-modal-sm" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        {children}
      </div>
    </div>
  );
}

export function CloseButton({ onClick }) {
  return (
    <button
      type="button"
      className="cm-close"
      onClick={onClick}
      aria-label="Close"
    >
      <UI name="x-bold" size={14} />
    </button>
  );
}

// "Invite people to <name>": the community's link with who shared it.
export function InviteModal({ community, inviter, onClose }) {
  const url = inviteURL(community.id, inviter);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <Modal label={`Invite people to ${community.name}`} small onClose={onClose}>
      <div className="cm-modal-head">
        <div>
          <h2>Invite people to {community.name}</h2>
          <p>Anyone with the link can join.</p>
        </div>
        <CloseButton onClick={onClose} />
      </div>
      <div className="cm-link-row">
        <span className="cm-link">
          <UI name="link-simple" size={16} />
          <span>{url.replace(/^https:\/\//, "")}</span>
        </span>
        <button
          type="button"
          className="cm-btn cm-btn-soft"
          onClick={async () => {
            if (await copy(url)) setCopied(true);
            capture("community_invite_copied", { community: community.id });
          }}
        >
          <UI name={copied ? "check-bold" : "copy-bold"} size={15} />
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      <span className="cm-preview-label">Share via</span>
      <div className="cm-share">
        {share(community.name, url).map(({ label, icon, href }) => (
          <a
            key={label}
            className="cm-btn cm-btn-outline"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
          >
            <UI name={icon} size={16} />
            {label}
          </a>
        ))}
      </div>
    </Modal>
  );
}

// The header card's buttons: Join or Joined, and for the owner "Edit" and
// "Invite people".
function Actions({ community }) {
  const identity = useIdentity();
  const [inviting, setInviting] = useState(false);
  useEffect(() => remember(community), []);
  if (!isOwner(community, identity)) {
    return <JoinButton community={community} />;
  }
  const key = community.id.split("/")[1];
  return (
    <>
      <a
        className="cm-btn cm-btn-outline"
        href={`/communities/new?edit=${key}`}
        data-no-instant
      >
        Edit
      </a>
      <button
        type="button"
        className="cm-btn cm-btn-dark"
        onClick={() => setInviting(true)}
      >
        <UI name="user-plus" size={16} />
        Invite people
      </button>
      {inviting && (
        <InviteModal
          community={community}
          inviter={identity}
          onClose={() => setInviting(false)}
        />
      )}
    </>
  );
}

// The page an invite link opens: "Join <name>", then its page. Members and
// the owner (opening their own link) just open it.
function InviteJoin({ community }) {
  const identity = useIdentity();
  const joined = useJoined().some((c) => c.id === community.id);
  const open = () => (window.location.href = href(community));
  if (isOwner(community, identity)) {
    return (
      <a className="cm-btn cm-btn-dark cm-btn-lg" href={href(community)}>
        Open {shortName(community.name)}
      </a>
    );
  }
  return (
    <>
      <button
        type="button"
        className="cm-btn cm-btn-dark cm-btn-lg"
        onClick={() => {
          if (!joined) join(community);
          open();
        }}
      >
        {!joined && <UI name="plus-bold" size={16} />}
        {joined ? "Open" : "Join"} {shortName(community.name)}
      </button>
      <a className="cm-btn cm-btn-quiet cm-btn-lg" href={href(community)}>
        Not now
      </a>
    </>
  );
}

// The Home tabs between "All stories" and "Browse".
function Tabs() {
  return useJoined().map((community) => (
    <a
      key={community.id}
      className="cm-tab cm-c"
      style={colorVars(community.color)}
      href={href(community)}
    >
      <span className="cm-icon-c">
        <CommunityIcon community={community} size={18} />
      </span>
      <span className="cm-tab-name">{community.name}</span>
    </a>
  ));
}

// The side box's rows.
function SideList({ placeholder }) {
  const list = useJoined();
  const identity = useIdentity();
  if (list.length === 0) {
    return <p className="cm-side-empty">{placeholder}</p>;
  }
  return list.slice(0, 5).map((community) => (
    <a key={community.id} className="cm-side-row" href={href(community)}>
      <Tile community={community} size={32} iconSize={19} />
      <span className="cm-side-row-text">
        <span className="cm-side-row-name">{community.name}</span>
        <span className="cm-side-row-by">
          created by {creator(community, identity)}
        </span>
      </span>
      <span className="cm-side-row-state">Joined</span>
    </a>
  ));
}

// The Joined tab of /communities: the cards of the communities you joined.
function JoinedList() {
  const list = useJoined();
  const identity = useIdentity();
  if (list.length === 0) {
    return (
      <div className="cm-empty">
        <span className="cm-empty-icon">
          <UI name="users-three" size={24} />
        </span>
        <h2>No communities yet</h2>
        <p>Join a community and it shows here and in your Home tabs.</p>
        <a className="cm-btn cm-btn-dark" href="/communities">
          Discover communities
        </a>
      </div>
    );
  }
  return (
    <>
      <p className="cm-count">
        {list.length} {list.length === 1 ? "community" : "communities"}
      </p>
      <div className="cm-grid">
        {list.map((community) => (
          <article key={community.id} className="cm-item">
            <div className="cm-item-head">
              <a href={href(community)} tabIndex={-1} aria-hidden="true">
                <Tile community={community} size={44} iconSize={26} />
              </a>
              <div className="cm-item-text">
                <a className="cm-item-name" href={href(community)}>
                  {community.name}
                </a>
                <span className="cm-item-by">
                  created by {creator(community, identity)}
                </span>
              </div>
              <div className="cm-join">
                <JoinButton community={community} size="sm" />
              </div>
            </div>
            {community.about && (
              <p className="cm-item-about">{community.about}</p>
            )}
          </article>
        ))}
      </div>
    </>
  );
}

function data(element) {
  try {
    return JSON.parse(element.dataset.community);
  } catch (err) {
    return null;
  }
}

// Mounts each [data-cm] element of the page.
export function mount(elements) {
  for (const element of elements) {
    const kind = element.dataset.cm;
    const community = data(element);
    let node = null;
    if (kind === "tabs") node = <Tabs />;
    if (kind === "side") {
      const placeholder = element.textContent.trim();
      node = <SideList placeholder={placeholder} />;
    }
    if (kind === "joined") node = <JoinedList />;
    if (kind === "join" && community) {
      node = <JoinButton community={community} size="sm" />;
    }
    if (kind === "actions" && community) {
      node = <Actions community={community} />;
    }
    if (kind === "invite" && community) {
      node = <InviteJoin community={community} />;
    }
    if (node) createRoot(element).render(node);
  }
}
