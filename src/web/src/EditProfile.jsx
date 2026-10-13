import React, { useState, useEffect, useRef } from "react";
import Modal from "react-modal";
import { useAccount } from "wagmi";
import { Wallet } from "@ethersproject/wallet";

import { EIP712_DOMAIN } from "./API.mjs";
import { getLocalAccount } from "./session.mjs";
import { useSigner } from "./client.mjs";
import { uploadImage } from "./uploadImage.mjs";

// Same rules as src/profiles.mjs, so people see problems while typing.
export const PROFILE_TYPES = {
  Profile: [
    { name: "name", type: "string" },
    { name: "bio", type: "string" },
    { name: "avatar", type: "string" },
    { name: "timestamp", type: "uint256" },
  ],
};
const NAME = /^[a-z0-9_]{2,20}$/i;
const RESERVED = [
  "kiwi",
  "kiwinews",
  "admin",
  "support",
  "moderator",
  "mod",
  "official",
  "team",
];
const BIO_LIMIT = 160;

if (typeof document !== "undefined") {
  Modal.setAppElement("body");
}

const modalStyles = {
  overlay: {
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    zIndex: 1100,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    position: "relative",
    inset: "unset",
    width: "90%",
    maxWidth: "440px",
    maxHeight: "90vh",
    overflowY: "auto",
    backgroundColor: "var(--background-color0)",
    borderRadius: 2,
    padding: "22px 20px 24px 20px",
    boxShadow: "var(--shadow-default)",
    border: "var(--border)",
    color: "var(--text-primary)",
  },
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 10px",
  fontSize: "16px",
  fontFamily: "inherit",
  border: "var(--border)",
  borderRadius: 2,
  background: "var(--bg-white)",
  color: "var(--text-primary)",
};

const labelStyle = {
  display: "block",
  fontWeight: 600,
  fontSize: "14px",
  margin: "14px 0 6px 0",
};

const buttonStyle = {
  padding: "8px 14px",
  borderRadius: 2,
  border: "none",
  background: "#afc046",
  color: "#000",
  fontWeight: 600,
  fontSize: "14px",
  cursor: "pointer",
};

const secondaryStyle = {
  ...buttonStyle,
  background: "transparent",
  border: "var(--border)",
  color: "var(--text-primary)",
  fontWeight: 400,
};

// The logged-in identity: a local Kiwi key (also passkey accounts, whose key
// address is the identity) or else the connected wallet.
export function useIdentity() {
  const account = useAccount();
  const local = getLocalAccount(account.address);
  if (local) return { identity: local.identity, local };
  if (account.isConnected) return { identity: account.address };
  return {};
}

export async function fetchProfile(address) {
  const response = await fetch(`/api/v1/profile/${address}`);
  if (!response.ok) throw new Error("Couldn't load the profile");
  const body = await response.json();
  return body.data;
}

export function nameProblem(name) {
  if (name === "") return "";
  if (!NAME.test(name)) {
    return "2 to 20 letters, digits or underscores (no dots or spaces)";
  }
  if (RESERVED.includes(name.toLowerCase())) return "That name is reserved";
  return "";
}

export function EditProfileModal(props) {
  const { identity, local, isOpen, onClose, onSaved, toast } = props;
  const wallet = useSigner();
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("");
  const [fallbackAvatar, setFallbackAvatar] = useState("");
  const [availability, setAvailability] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const ownName = useRef("");
  const nameInput = useRef(null);

  useEffect(() => {
    if (!isOpen || !identity) return;
    setLoaded(false);
    setError("");
    fetchProfile(identity)
      .then((profile) => {
        const kiwi = profile.kiwiProfile;
        ownName.current = kiwi?.name || "";
        setName(kiwi?.name || "");
        setBio(kiwi?.bio || "");
        setAvatar(kiwi?.avatar || "");
        if (!kiwi?.avatar) setFallbackAvatar(profile.safeAvatar || "");
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [isOpen, identity]);

  useEffect(() => {
    setAvailability("");
    if (!name || nameProblem(name)) return;
    if (name.toLowerCase() === ownName.current.toLowerCase()) return;
    let current = true;
    const timer = setTimeout(async () => {
      let response;
      try {
        response = await fetch(
          `/api/v1/profile-name/${encodeURIComponent(name)}`,
        );
      } catch {
        return;
      }
      if (!current) return;
      if (response.status === 404) return setAvailability("available");
      if (!response.ok) return;
      const body = await response.json();
      const mine =
        body.data?.address?.toLowerCase() === identity.toLowerCase();
      setAvailability(mine ? "" : "taken");
    }, 300);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [name, identity]);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }
    setUploading(true);
    setError("");
    try {
      setAvatar(await uploadImage(file));
    } catch (err) {
      setError(`Error uploading image: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const bioLength = [...bio.trim()].length;
  const problem =
    nameProblem(name) ||
    (availability === "taken" ? "That name is taken" : "") ||
    (bioLength > BIO_LIMIT ? `Up to ${BIO_LIMIT} characters` : "");

  const save = async () => {
    setError("");
    let signer;
    if (local && local.identity.toLowerCase() === identity.toLowerCase()) {
      signer = new Wallet(local.privateKey);
    } else if (wallet) {
      signer = wallet;
    } else {
      setError("Connect your wallet to save your profile");
      return;
    }
    const value = {
      name,
      bio: bio.trim(),
      avatar,
      timestamp: Math.floor(Date.now() / 1000),
    };
    setSaving(true);
    try {
      const signature = await signer._signTypedData(
        EIP712_DOMAIN,
        PROFILE_TYPES,
        value,
      );
      const response = await fetch("/api/v1/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...value, signature }),
      });
      const body = await response.json();
      if (body.status !== "success") {
        setError(body.details || "Couldn't save your profile");
        return;
      }
      toast?.success("Profile saved");
      onSaved?.(body.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const shownAvatar = avatar || fallbackAvatar;
  const remaining = BIO_LIMIT - bioLength;

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      onAfterOpen={() => nameInput.current?.focus()}
      style={modalStyles}
      contentLabel="Edit profile"
    >
      <div style={{ fontWeight: 700, fontSize: "18px" }}>Edit profile</div>

      <label style={labelStyle}>Picture</label>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div
          style={{
            width: 56,
            height: 56,
            flexShrink: 0,
            border: "var(--border)",
            borderRadius: 2,
            background: "var(--bg-white)",
            overflow: "hidden",
          }}
        >
          {shownAvatar && (
            <img
              src={shownAvatar}
              alt=""
              width="56"
              height="56"
              style={{ width: 56, height: 56, objectFit: "cover" }}
            />
          )}
        </div>
        <label style={{ ...secondaryStyle, display: "inline-block" }}>
          {uploading ? "Uploading..." : "Upload"}
          <input
            type="file"
            accept="image/*"
            onChange={handleFile}
            disabled={uploading}
            style={{ display: "none" }}
          />
        </label>
        {avatar && (
          <button
            type="button"
            style={secondaryStyle}
            onClick={() => {
              setAvatar("");
              setFallbackAvatar("");
            }}
          >
            Remove
          </button>
        )}
      </div>

      <label style={labelStyle} htmlFor="kiwi-profile-name">
        Nickname
      </label>
      <input
        id="kiwi-profile-name"
        ref={nameInput}
        style={inputStyle}
        value={name}
        maxLength={20}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck="false"
        placeholder="e.g. kiwi_fan"
        disabled={!loaded}
        onChange={(e) => setName(e.target.value.trim())}
      />
      <div
        style={{
          minHeight: "18px",
          marginTop: "4px",
          fontSize: "13px",
          color:
            nameProblem(name) || availability === "taken"
              ? "#d32f2f"
              : "var(--text-secondary)",
        }}
      >
        {nameProblem(name) ||
          (availability === "taken" && "That name is taken") ||
          (availability === "available" && "Available") ||
          ""}
      </div>

      <label style={labelStyle} htmlFor="kiwi-profile-bio">
        Bio
      </label>
      <textarea
        id="kiwi-profile-bio"
        style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }}
        value={bio}
        disabled={!loaded}
        onChange={(e) => setBio(e.target.value)}
      />
      <div
        style={{
          marginTop: "4px",
          fontSize: "13px",
          textAlign: "right",
          color: remaining < 0 ? "#d32f2f" : "var(--text-secondary)",
        }}
      >
        {remaining}
      </div>

      {error && (
        <div style={{ marginTop: "8px", fontSize: "14px", color: "#d32f2f" }}>
          {error}
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "8px",
          marginTop: "16px",
        }}
      >
        <button type="button" style={secondaryStyle} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          style={{
            ...buttonStyle,
            opacity: !loaded || saving || uploading || problem ? 0.5 : 1,
          }}
          disabled={!loaded || saving || uploading || !!problem}
          onClick={save}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </Modal>
  );
}

// "Edit profile" on your own profile page (views/upvotes.mjs).
// NOTE: Material Symbols Rounded "edit".
const EditSVG = () => (
  <svg
    className="n2-icon"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 -960 960 960"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M185.39-185.39h40.92l468.54-467.92-40.93-40.92-468.53 467.92v40.92ZM168.85-140q-12.52 0-20.69-8.16-8.16-8.17-8.16-20.69v-51.84q0-11.79 4.81-22.82 4.81-11.03 12.81-18.64l544.3-544.46q6.23-5.63 14.66-9.2 8.42-3.57 17.6-3.57 8.57 0 16.81 3.34 8.24 3.35 15.32 9.43l40.92 40.92q6.69 6.69 9.73 15.16 3.04 8.46 3.04 16.93 0 8.6-3.51 17.33-3.5 8.73-9.26 14.96L262.15-157.62q-7.61 8-18.64 12.81-11.03 4.81-22.82 4.81h-51.84Zm605.53-594.31-39.46-39.07 39.46 39.07Zm-99.75 60.68-20.71-20.6 40.93 40.92-20.22-20.32Z" />
  </svg>
);

export default function EditProfileButton(props) {
  const { address, toast, variant } = props;
  const { identity, local } = useIdentity();
  const [open, setOpen] = useState(false);

  if (!identity || identity.toLowerCase() !== address.toLowerCase()) {
    return null;
  }

  return (
    <>
      {variant === "row" ? (
        // NOTE: The profile page's "Edit profile" row (public/pages.css).
        <button
          type="button"
          className="n2-own-row"
          onClick={() => setOpen(true)}
        >
          <EditSVG />
          <span>Edit profile</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            ...secondaryStyle,
            padding: "2px 10px",
            height: "24px",
            fontSize: "13px",
          }}
        >
          Edit profile
        </button>
      )}
      <EditProfileModal
        identity={identity}
        local={local}
        isOpen={open}
        toast={toast}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false);
          setTimeout(() => window.location.reload(), 1000);
        }}
      />
    </>
  );
}
