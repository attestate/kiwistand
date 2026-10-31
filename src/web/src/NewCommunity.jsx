// @format
// /communities/new: start a community, or edit yours (?edit=<name key>),
// with a live preview (designs 9, 9b, 10 and 11). Signs the Community
// message like a submission is signed (the local Kiwi key, else the wallet)
// and sends it to the node.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Wallet } from "@ethersproject/wallet";
import { useAccount } from "wagmi";

import * as API from "./API.mjs";
import {
  ABOUT_LIMIT,
  NAME_LIMIT,
  PALETTE,
  RULE_LIMIT,
  RULES_LIMIT,
  catalog,
  clean,
  clip,
  colorVars,
  communityId,
  isValidName,
  length,
  matchIcons,
  nameKey,
  prepare,
  suggestIcons,
} from "./communities.mjs";
import {
  CloseButton,
  Modal,
  Svg,
  UI,
  currentIdentity,
  join,
} from "./Communities.jsx";
import { useSigner } from "./client.mjs";
import { getLocalAccount } from "./session.mjs";
import { capture } from "./analytics.mjs";
import { openOnboarding } from "./LoginModal.jsx";

const COMMUNITY_TYPES = {
  Community: [
    { name: "type", type: "string" },
    { name: "name", type: "string" },
    { name: "about", type: "string" },
    { name: "rules", type: "string[]" },
    { name: "icon", type: "string" },
    { name: "color", type: "string" },
    { name: "timestamp", type: "uint256" },
  ],
};

// Phosphor's 1,512 icons with their tags (phosphor.json), loaded only here.
function useCatalog() {
  const [icons, setIcons] = useState(null);
  useEffect(() => {
    import("./phosphor.json")
      .then((module) => setIcons(catalog(module.default)))
      .catch((err) => console.error("Couldn't load the icons", err));
  }, []);
  return icons;
}

function IconCell({ icons, name, selected, size = 20, onPick }) {
  const icon = icons?.byName.get(name);
  return (
    <button
      type="button"
      className="cm-icon-cell"
      aria-pressed={selected ? "true" : "false"}
      aria-label={name.replace(/-/g, " ")}
      title={name}
      onClick={() => onPick(name)}
    >
      {icon && <Svg path={icon.path} size={size} />}
    </button>
  );
}

// "Choose an icon": search all icons, or browse the suggestions for the
// name and Phosphor's categories.
function IconPicker({ icons, name, selected, onPick, onClose }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(null);
  const trimmed = query.trim();
  let shown;
  let label;
  if (trimmed) {
    shown = matchIcons(trimmed, icons, 240);
    label = `${shown.length} ${shown.length === 1 ? "icon" : "icons"} for “${trimmed}”`;
  } else if (category !== null) {
    shown = icons.icons
      .filter((icon) => icon.kinds.includes(category))
      .map((icon) => icon.name);
    label = icons.categories[category].label;
  } else {
    shown = suggestIcons(name, icons, 32);
    label = name ? `Suggested for “${name}”` : "Suggested";
  }
  return (
    <Modal label="Choose an icon" onClose={onClose}>
      <div className="cm-modal-head">
        <h2>Choose an icon</h2>
        <CloseButton onClick={onClose} />
      </div>
      <label className="cm-search">
        <UI name="magnifying-glass" size={16} />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${icons.icons.length.toLocaleString("en-US")} icons`}
          aria-label="Search icons"
          autoFocus
        />
      </label>
      <div className="cm-chips" role="group" aria-label="Categories">
        <button
          type="button"
          className="cm-chip cm-chip-lg"
          aria-pressed={!trimmed && category === null ? "true" : "false"}
          onClick={() => {
            setQuery("");
            setCategory(null);
          }}
        >
          Suggested
        </button>
        {icons.categories.map((entry, index) => (
          <button
            key={entry.name}
            type="button"
            className="cm-chip cm-chip-lg"
            aria-pressed={!trimmed && category === index ? "true" : "false"}
            onClick={() => {
              setQuery("");
              setCategory(index);
            }}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <span className="cm-preview-label">{label}</span>
      <div className="cm-icon-grid">
        {shown.map((icon) => (
          <IconCell
            key={icon}
            icons={icons}
            name={icon}
            size={22}
            selected={icon === selected}
            onPick={onPick}
          />
        ))}
      </div>
    </Modal>
  );
}

function Preview({ icons, name, about, icon, color, className = "" }) {
  const path = icons?.byName.get(icon)?.path;
  const vars = colorVars(color);
  return (
    <div className={`cm-preview ${className}`}>
      <span className="cm-preview-label">Live preview</span>
      <div className="cm-c cm-preview-card" style={vars}>
        <div className="cm-preview-id">
          <span className="cm-mark">{path && <Svg path={path} size={26} />}</span>
          <span className="cm-preview-name">{name}</span>
        </div>
        {about && <p className="cm-preview-about">{about}</p>}
        <span className="cm-preview-meta">created by you</span>
      </div>
      <div className="cm-preview-tag">
        On stories:
        <span className="cm-c cm-tag" style={vars}>
          {path && <Svg path={path} size={14} />}
          <span>{name || "Name"}</span>
        </span>
        <span className="cm-domain">github.com</span>
      </div>
      <p className="cm-preview-hint">Updates as you type.</p>
    </div>
  );
}

// The ideas for a name you already use.
function alternatives(name, owned) {
  return [`Applied ${name}`, `${name} Builders`].filter(
    (idea) =>
      isValidName(idea) &&
      !owned.some((c) => nameKey(c.name) === nameKey(idea)),
  );
}

const oneLine = (text) => text.replace(/[\r\n]+/g, " ");

export default function NewCommunity({ toast, editKey }) {
  const icons = useCatalog();
  const account = useAccount();
  const wallet = useSigner();
  const localAccount = getLocalAccount(account.address);
  const identity =
    localAccount?.identity || (account.isConnected ? account.address : null);

  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const [rules, setRules] = useState([]);
  const [picked, setPicked] = useState("");
  const [color, setColor] = useState(PALETTE[0].hex);
  const [editingRule, setEditingRule] = useState(null);
  const [draft, setDraft] = useState("");
  const [picker, setPicker] = useState(false);
  const [owned, setOwned] = useState([]);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const previewRoot = useRef(document.getElementById("cm-new-preview"));

  // Your communities: a name you already use is taken (by you); with
  // ?edit=, the one to edit.
  useEffect(() => {
    if (!identity) return;
    const url = `/api/v1/communities?owner=${identity}&limit=200&t=${Date.now()}`;
    fetch(url)
      .then((response) => response.json())
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : [];
        setOwned(list);
        const mine = editKey && list.find((c) => nameKey(c.name) === editKey);
        if (mine) edit(mine);
      })
      .catch((err) => console.error("Couldn't load your communities", err));
  }, [identity]);

  function edit(community) {
    setEditing(community);
    setName(community.name);
    setAbout(community.about);
    setRules(community.rules);
    setPicked(community.icon);
    setColor(
      PALETTE.some(({ hex }) => hex === community.color.toUpperCase())
        ? community.color.toUpperCase()
        : PALETTE[0].hex,
    );
  }

  const cleanName = clean(name);
  const suggestions = useMemo(
    () => (icons ? suggestIcons(cleanName, icons, 8) : []),
    [icons, cleanName],
  );
  const icon = picked || suggestions[0] || "";
  // The picked icon first, then the name's suggestions: eight and "More".
  const grid = [icon, ...suggestions.filter((s) => s !== icon)]
    .filter(Boolean)
    .slice(0, 8);

  const taken =
    !editing &&
    owned.find((c) => cleanName && nameKey(c.name) === nameKey(cleanName));
  const invalid = cleanName && !isValidName(cleanName);
  const ideas = taken ? alternatives(taken.name, owned) : [];
  const disabled = saving || !cleanName || invalid || !!taken || !icon;

  function saveRule() {
    const text = clean(draft);
    if (text) {
      const next = [...rules];
      if (editingRule === "new") next.push(text);
      else next[editingRule] = text;
      setRules(next);
    } else if (editingRule !== "new") {
      setRules(rules.filter((_, i) => i !== editingRule));
    }
    setEditingRule(null);
    setDraft("");
  }

  async function submit() {
    let signer = wallet;
    if (localAccount?.privateKey) signer = new Wallet(localAccount.privateKey);
    if (!signer || !identity) {
      if (account.isConnected) {
        toast("Your wallet is still connecting, please try again.");
      } else {
        openOnboarding();
      }
      return;
    }
    // A rule still being typed counts.
    let all = rules;
    if (editingRule !== null && clean(draft)) {
      all = [...rules];
      if (editingRule === "new") all.push(draft);
      else all[editingRule] = draft;
    }
    const prepared = prepare({ name, about, rules: all, icon, color });
    if (prepared.error) {
      toast.error(prepared.error);
      return;
    }
    const now = Math.floor(Date.now() / 1000);
    // NOTE: The newest version of a community wins, so an edit is signed
    // after the one it replaces.
    const timestamp = editing ? Math.max(now, editing.timestamp + 1) : now;
    const value = { type: "community", ...prepared.fields, timestamp };

    setSaving(true);
    if (!localAccount) toast("Please sign the message in your wallet!");
    let signature;
    try {
      signature = await signer._signTypedData(
        API.EIP712_DOMAIN,
        COMMUNITY_TYPES,
        value,
      );
    } catch (err) {
      toast.error(`Couldn't sign: ${err.message}`);
      setSaving(false);
      return;
    }
    const wait = true;
    const response = await API.send(value, signature, wait);
    if (response.status !== "success") {
      toast.error(`Couldn't save the community: ${response.details}`);
      setSaving(false);
      return;
    }
    const id = communityId(identity, value.name);
    join({
      id,
      name: value.name,
      about: value.about,
      icon: value.icon,
      path: icons.byName.get(value.icon).path,
      color: value.color,
      owner: identity,
      ownerName: editing?.ownerName ?? null,
      created: editing?.created ?? timestamp,
    });
    capture(editing ? "community_edited" : "community_created", {
      community: id,
    });
    window.location.href = `/c/${id}`;
  }

  const preview = (className) => (
    <Preview
      icons={icons}
      name={cleanName}
      about={clean(about)}
      icon={icon}
      color={color}
      className={className}
    />
  );

  return (
    <form
      className="cm-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!disabled) submit();
      }}
    >
      <div className="cm-field">
        <div className="cm-label-row">
          <label className="cm-label" htmlFor="cm-name">
            Name
          </label>
          <span className="cm-counter">
            {length(name)}/{NAME_LIMIT}
          </span>
        </div>
        <input
          id="cm-name"
          className={`cm-input${taken || invalid ? " cm-invalid" : ""}`}
          value={name}
          readOnly={!!editing}
          placeholder="e.g. Agent Builders"
          autoComplete="off"
          onChange={(event) =>
            setName(clip(oneLine(event.target.value), NAME_LIMIT))
          }
        />
        {taken ? (
          <p className="cm-error" role="alert">
            <UI name="warning-circle" size={14} />
            <span>You already run “{taken.name}”. Edit it, or try:</span>
            <button
              type="button"
              className="cm-chip"
              onClick={() => edit(taken)}
            >
              <UI name="pencil-simple" size={12} />
              Edit “{taken.name}”
            </button>
            {ideas.map((idea) => (
              <button
                key={idea}
                type="button"
                className="cm-chip"
                onClick={() => setName(idea)}
              >
                {idea}
              </button>
            ))}
          </p>
        ) : invalid ? (
          <p className="cm-error" role="alert">
            <UI name="warning-circle" size={14} />
            Use letters and digits, with one space or hyphen between words.
          </p>
        ) : (
          <p className="cm-help">
            {editing
              ? "The name stays: it's part of the community's link."
              : "Short and clear. It shows up on stories and in the Home tabs."}
          </p>
        )}
      </div>

      <div className="cm-field cm-c" style={colorVars(color)}>
        <span className="cm-label">Icon</span>
        <div className="cm-icon-row">
          {grid.map((name) => (
            <IconCell
              key={name}
              icons={icons}
              name={name}
              selected={name === icon}
              onPick={setPicked}
            />
          ))}
          <button
            type="button"
            className="cm-icon-cell"
            onClick={() => icons && setPicker(true)}
          >
            <UI name="dots-three-bold" size={18} />
            <span>More</span>
          </button>
        </div>
        <span className="cm-label">Colour</span>
        <div className="cm-colors" role="radiogroup" aria-label="Colour">
          {PALETTE.map((entry) => (
            <button
              key={entry.hex}
              type="button"
              role="radio"
              aria-checked={entry.hex === color ? "true" : "false"}
              aria-label={entry.key}
              className="cm-color cm-c"
              style={colorVars(entry.hex)}
              onClick={() => setColor(entry.hex)}
            />
          ))}
        </div>
      </div>

      <div className="cm-field">
        <div className="cm-label-row">
          <label className="cm-label" htmlFor="cm-about">
            Description
          </label>
          <span className="cm-counter">
            {length(about)}/{ABOUT_LIMIT}
          </span>
        </div>
        <textarea
          id="cm-about"
          className="cm-input"
          rows="1"
          value={about}
          placeholder="What's it about?"
          onKeyDown={(event) => event.key === "Enter" && event.preventDefault()}
          onChange={(event) =>
            setAbout(clip(oneLine(event.target.value), ABOUT_LIMIT))
          }
        />
      </div>

      <div className="cm-field">
        <div className="cm-label-row">
          <span className="cm-label">House rules</span>
          <span className="cm-counter">
            {rules.length} of {RULES_LIMIT}
          </span>
        </div>
        <ul className="cm-rule-list">
          {rules.map((rule, index) =>
            editingRule === index ? (
              <RuleInput
                key={index}
                draft={draft}
                setDraft={setDraft}
                onSave={saveRule}
                onCancel={() => setEditingRule(null)}
              />
            ) : (
              <li key={index} className="cm-rule">
                <span
                  className="cm-rule-text"
                  onClick={() => {
                    setEditingRule(index);
                    setDraft(rule);
                  }}
                >
                  {rule}
                </span>
                <button
                  type="button"
                  className="cm-rule-remove"
                  aria-label="Remove rule"
                  onClick={() => setRules(rules.filter((_, i) => i !== index))}
                >
                  <UI name="x" size={14} />
                </button>
              </li>
            ),
          )}
          {editingRule === "new" && (
            <RuleInput
              draft={draft}
              setDraft={setDraft}
              onSave={saveRule}
              onCancel={() => setEditingRule(null)}
            />
          )}
        </ul>
        {rules.length + (editingRule === "new" ? 1 : 0) < RULES_LIMIT ? (
          editingRule === null && (
            <button
              type="button"
              className="cm-add-rule"
              onClick={() => {
                setEditingRule("new");
                setDraft("");
              }}
            >
              <UI name="plus-bold" size={14} />
              Add a rule
            </button>
          )
        ) : (
          <p className="cm-help">That’s the maximum of {RULES_LIMIT} rules.</p>
        )}
        <p className="cm-help">Kiwi’s guidelines always apply on top.</p>
      </div>

      {preview("cm-preview-inline")}

      <div className="cm-form-actions">
        <button type="submit" className="cm-btn cm-btn-accent" disabled={disabled}>
          {saving
            ? !localAccount
              ? "Please confirm signature..."
              : "Saving..."
            : editing
              ? "Save changes"
              : "Create community"}
        </button>
        <a
          className="cm-btn cm-btn-quiet"
          href={editing ? `/c/${editing.id}` : "/communities"}
        >
          Cancel
        </a>
        <span className="cm-help">You can change everything later.</span>
      </div>

      {previewRoot.current && createPortal(preview(""), previewRoot.current)}
      {picker && icons && (
        <IconPicker
          icons={icons}
          name={cleanName}
          selected={icon}
          onPick={(name) => {
            setPicked(name);
            setPicker(false);
          }}
          onClose={() => setPicker(false)}
        />
      )}
    </form>
  );
}

// Adding or editing a rule (design 9b): Enter saves, Esc cancels.
function RuleInput({ draft, setDraft, onSave, onCancel }) {
  return (
    <li className="cm-rule">
      <div className="cm-rule-edit">
        <label className="cm-rule-input">
          <input
            value={draft}
            autoFocus
            aria-label="Rule"
            onChange={(event) =>
              setDraft(clip(oneLine(event.target.value), RULE_LIMIT))
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSave();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                onCancel();
              }
            }}
          />
          <span className="cm-counter">
            {length(draft)}/{RULE_LIMIT}
          </span>
        </label>
        <span className="cm-keys">
          <span>
            <kbd>Enter</kbd>to save
          </span>
          <span>
            <kbd>Esc</kbd>to cancel
          </span>
        </span>
      </div>
    </li>
  );
}
