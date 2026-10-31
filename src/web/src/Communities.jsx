// @format
// Your communities, and what depends on them: Join and Joined, the Home
// tabs and side box, the Joined tab of /communities, a community's "Invite
// people" and the page an invite link opens.
//
// NOTE: This is the one place membership comes from. Since protocol 14.0.0
// (src/memberships.mjs) joining and leaving are signed Membership messages,
// and the node lists the communities you're a member of, the ones your
// account runs included (GET /api/v1/communities?member=). This browser keeps
// that list as you last saw it (theme-init.js reads it before the first
// paint), with the joins and leaves you signed that the node doesn't show
// yet. Joins kept here before 14.0.0 are signed once, with this browser's
// Kiwi key. You can't leave a community you run.
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Wallet } from "@ethersproject/wallet";

import {
  MEMBERSHIP_TYPES,
  canLeave,
  colorVars,
  creator,
  inviteURL,
  isOwner,
  legacyJoins,
  memberCount,
  membership,
  record,
  settle,
  shortName,
  toSign,
  withPending,
} from "./communities.mjs";
import { paths as ui } from "./cm-icons.mjs";
import { EIP712_DOMAIN, send } from "./API.mjs";
import { getCookie, getLocalAccount } from "./session.mjs";
import { capture } from "./analytics.mjs";

// Your communities as last shown (theme-init.js reads it too).
const KEY = "kiwi-communities";
// The joins and leaves the node's list doesn't show yet (communities.mjs).
const PENDING = "kiwi-communities-pending";
// Set once the joins kept before 14.0.0 moved to PENDING.
const MIGRATED = "kiwi-communities-14";
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
  "timestamp",
  "members",
  "stories",
];

function entry(community) {
  return Object.fromEntries(fields.map((key) => [key, community[key] ?? null]));
}

function read(key) {
  let list;
  try {
    list = JSON.parse(localStorage.getItem(key) || "[]");
  } catch (err) {
    return [];
  }
  return Array.isArray(list) ? list : [];
}

function write(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch (err) {
    // Private mode or storage full: it lasts until the page reloads.
  }
}

// Your communities as last shown: the node's list (or, before it was read,
// the joins kept here), the joins signed since first.
export function readJoined() {
  return read(KEY).filter(
    (c) => c && typeof c.id === "string" && typeof c.name === "string",
  );
}

function readPending() {
  return read(PENDING).filter(
    (p) => p && p.community && typeof p.community.id === "string",
  );
}

// Once: the joins kept in this browser before 14.0.0 become joins to sign.
function migrateStorage() {
  try {
    if (localStorage.getItem(MIGRATED)) return;
    write(PENDING, [...legacyJoins(readJoined()), ...readPending()]);
    localStorage.setItem(MIGRATED, "1");
  } catch (err) {
    // No storage: nothing was kept either.
  }
}

// The node's list of your communities, once read on this page.
let node = { identity: null, list: null };

// Shows the node's list with what's pending, and keeps it for the next page.
function update() {
  let pending = readPending();
  if (node.list) {
    pending = settle(node.list, pending);
    write(PENDING, pending);
    write(KEY, withPending(node.list, pending));
  } else {
    write(KEY, withPending(readJoined(), pending));
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

// This browser's Kiwi key for `identity`: it signs without asking.
function keyFor(identity) {
  let local;
  try {
    local = getLocalAccount(identity);
  } catch (err) {
    local = null;
  }
  return local?.privateKey ? new Wallet(local.privateKey) : null;
}

// The Kiwi key, else the connected wallet, as for a submission.
async function signerFor(identity) {
  const key = keyFor(identity);
  if (key) return key;
  try {
    const { getConnectorClient } = await import("@wagmi/core");
    const { client, walletClientToSigner } = await import("./client.mjs");
    return walletClientToSigner(await getConnectorClient(client));
  } catch (err) {
    return null;
  }
}

async function sign(signer, type, community) {
  const value = membership(type, community);
  const signature = await signer._signTypedData(
    EIP712_DOMAIN,
    MEMBERSHIP_TYPES,
    value,
  );
  return { value, signature };
}

// Reads your communities from the node, once per page and identity, and
// signs the joins kept from before 14.0.0.
function load(identity) {
  const key = identity ? identity.toLowerCase() : null;
  if (!key || node.identity === key) return;
  node = { identity: key, list: null };
  fetch(`/api/v1/communities?member=${key}&limit=200`)
    .then((response) => response.json())
    .then(({ data }) => {
      if (node.identity !== key || !Array.isArray(data)) return;
      node = { identity: key, list: data.map(entry) };
      update();
      return migrate(identity);
    })
    .catch((err) => console.error("Couldn't load your communities", err));
}

// Signs the joins kept from before 14.0.0, with this browser's Kiwi key
// only: a wallet would ask once per community.
let migrating = false;
async function migrate(identity) {
  const signer = keyFor(identity);
  if (!signer || migrating) return;
  const { sign: joins, drop } = toSign(readPending(), identity);
  if (joins.length === 0 && drop.length === 0) return;
  migrating = true;
  const done = new Set(drop.map(({ community }) => community.id));
  const joined = [];
  for (const { community } of joins) {
    let response;
    try {
      const { value, signature } = await sign(signer, "join", community);
      response = await send(value, signature, true);
    } catch (err) {
      break;
    }
    if (response.status === "success") {
      joined.push(community);
    } else if (response.code === 400) {
      // The node doesn't know it (anymore).
      done.add(community.id);
    } else {
      // Offline or too many requests: the rest waits for the next page.
      break;
    }
  }
  let pending = readPending().filter(
    ({ community, signed }) => signed || !done.has(community.id),
  );
  for (const community of joined) {
    pending = record(pending, {
      type: "join",
      community,
      signed: true,
      at: Date.now(),
    });
  }
  write(PENDING, pending);
  migrating = false;
  update();
}

// Signs and sends a join or leave. The change shows right away and is
// undone if the node refuses it. False if nothing was sent.
async function change(type, community) {
  const identity = currentIdentity();
  const signer = identity && (await signerFor(identity));
  if (!signer) {
    const { openOnboarding } = await import("./LoginModal.jsx");
    openOnboarding();
    return false;
  }
  let message;
  try {
    message = await sign(signer, type, community);
  } catch (err) {
    return false;
  }
  const before = readPending();
  write(
    PENDING,
    record(before, {
      type,
      community: entry(community),
      signed: true,
      at: Date.now(),
    }),
  );
  update();
  const response = await send(message.value, message.signature, true);
  if (response.status !== "success") {
    write(PENDING, before);
    update();
    const verb = type === "join" ? "join" : "leave";
    window.toast?.error?.(`Couldn't ${verb} ${community.name}: ${response.details}`);
    return false;
  }
  capture(type === "join" ? "community_joined" : "community_left", {
    community: community.id,
  });
  return true;
}

export function join(community) {
  return change("join", community);
}

export async function leave(community, identity) {
  if (!canLeave(community, identity)) return false;
  return change("leave", community);
}

// Refreshes a community's entry in your list (its owner may have changed
// its name, icon or colour).
export function remember(community) {
  const list = readJoined();
  const index = list.findIndex((c) => c.id === community.id);
  if (index === -1) return;
  const fresh = entry({ ...list[index], ...community });
  if (JSON.stringify(list[index]) === JSON.stringify(fresh)) return;
  list[index] = fresh;
  write(KEY, list);
  window.dispatchEvent(new Event(EVENT));
}

// Your communities: the node's, with what's pending.
export function useJoined() {
  const identity = useIdentity();
  const [list, setList] = useState(() => {
    migrateStorage();
    return readJoined();
  });
  useEffect(() => {
    const show = () => setList(readJoined());
    load(identity);
    show();
    window.addEventListener(EVENT, show);
    window.addEventListener("storage", show);
    return () => {
      window.removeEventListener(EVENT, show);
      window.removeEventListener("storage", show);
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
  // While the wallet asks to sign, a second click does nothing.
  const [busy, setBusy] = useState(false);
  const act = async (done) => {
    if (busy) return;
    setBusy(true);
    await done();
    setBusy(false);
  };
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
        onClick={() => act(() => leave(community, identity))}
        aria-pressed="true"
        aria-busy={busy ? "true" : undefined}
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
      onClick={() => act(() => join(community))}
      aria-pressed="false"
      aria-busy={busy ? "true" : undefined}
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
        <span className="cm-btn-label">Open {shortName(community.name)}</span>
      </a>
    );
  }
  return (
    <>
      <button
        type="button"
        className="cm-btn cm-btn-dark cm-btn-lg"
        onClick={async () => {
          if (!joined && !(await join(community))) return;
          open();
        }}
      >
        {!joined && <UI name="plus-bold" size={16} />}
        <span className="cm-btn-label">
          {joined ? "Open" : "Join"} {shortName(community.name)}
        </span>
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
                {community.members && (
                  <span className="cm-item-count">
                    {memberCount(community.members)}
                    {community.stories !== null &&
                      ` · ${community.stories} ${
                        community.stories === 1 ? "story" : "stories"
                      }`}
                  </span>
                )}
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
