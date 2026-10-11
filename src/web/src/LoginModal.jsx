import React, { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import Modal from "react-modal";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Wallet } from "@ethersproject/wallet";

import { setCookie, tenYearsInSeconds, isIOSApp } from "./session.mjs";
import { EIP712_DOMAIN } from "./API.mjs";
import { PROFILE_TYPES, nameProblem } from "./EditProfile.jsx";
import { uploadImage } from "./uploadImage.mjs";

if (typeof document !== "undefined") {
  Modal.setAppElement("body");
}

const SparkleIcon = () => (
  <svg viewBox="0 0 256 256" width="1.2em" height="1.2em" style={{ width: "18px", height: "18px" }}>
    <path fill="currentColor" d="m230.86 109.25l-61.68-22.43l-22.43-61.68a19.95 19.95 0 0 0-37.5 0L86.82 86.82l-61.68 22.43a19.95 19.95 0 0 0 0 37.5l61.68 22.43l22.43 61.68a19.95 19.95 0 0 0 37.5 0l22.43-61.68l61.68-22.43a19.95 19.95 0 0 0 0-37.5m-75.14 39.29a12 12 0 0 0-7.18 7.18L128 212.21l-20.54-56.49a12 12 0 0 0-7.18-7.18L43.79 128l56.49-20.54a12 12 0 0 0 7.18-7.18L128 43.79l20.54 56.49a12 12 0 0 0 7.18 7.18L212.21 128Z"></path>
  </svg>
);

const VerifiedIcon = () => (
  <svg viewBox="0 0 24 24" width="1.2em" height="1.2em" style={{ height: "16px", width: "16px", color: "var(--accent-primary)" }}>
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
      <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77a4 4 0 0 1 6.74 0a4 4 0 0 1 4.78 4.78a4 4 0 0 1 0 6.74a4 4 0 0 1-4.77 4.78a4 4 0 0 1-6.75 0a4 4 0 0 1-4.78-4.77a4 4 0 0 1 0-6.76"></path>
      <path d="m9 12l2 2l4-4"></path>
    </g>
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" width="1.2em" height="1.2em" style={{ height: "18px", width: "18px" }}>
    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 6L6 18M6 6l12 12"></path>
  </svg>
);

const WalletIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="1.2em" height="1.2em">
    <rect width="256" height="256" fill="none"/>
    <path d="M40,56V184a16,16,0,0,0,16,16H216a8,8,0,0,0,8-8V80a8,8,0,0,0-8-8H56A16,16,0,0,1,40,56h0A16,16,0,0,1,56,40H192" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16"/>
    <circle cx="180" cy="132" r="12"/>
  </svg>
);

function canUsePasskey() {
  if (typeof window === "undefined") return false;
  if (typeof window.PublicKeyCredential === "undefined") return false;
  // NOTE: The iOS app has its own native sign-in.
  try {
    if (isIOSApp()) return false;
  } catch (err) {}
  return true;
}

// NOTE: "Create account" asks for a nickname first, then makes the passkey
// under that name and saves it as the profile; "Sign in" opens an existing
// passkey; "I have my own wallet" is for wallet accounts. Never "Continue with
// Apple/Google": that reads like Sign in with Apple or Google.

// Saves the new account's profile: first the nickname, later maybe a
// picture. Returns the server's message when it fails, e.g. "That name is
// taken".
async function saveProfile(privateKey, name, avatar = "") {
  const value = {
    name,
    bio: "",
    avatar,
    timestamp: Math.floor(Date.now() / 1000),
  };
  const signature = await new Wallet(privateKey)._signTypedData(
    EIP712_DOMAIN,
    PROFILE_TYPES,
    value,
  );
  const response = await fetch("/api/v1/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...value, signature }),
  });
  const body = await response.json().catch(() => ({}));
  if (body.status === "success") return "";
  if (avatar) return body.details || "Couldn't save your picture.";
  return body.details || "Couldn't save your nickname. Please try another.";
}

const primaryStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "38px",
  backgroundColor: "var(--accent-primary)",
  border: "1px solid var(--accent-primary)",
  color: "var(--bg-black)",
  borderRadius: "8px",
  fontSize: "15px",
  cursor: "pointer",
  margin: "0 16px",
  whiteSpace: "nowrap",
};
const secondaryStyle = {
  ...primaryStyle,
  backgroundColor: "transparent",
  border: "var(--border-thin)",
  color: "var(--text-primary)",
};
const tertiaryStyle = {
  background: "transparent",
  border: "none",
  padding: "4px 16px",
  color: "var(--text-secondary)",
  fontSize: "14px",
  cursor: "pointer",
  textDecoration: "underline",
};
const errorStyle = {
  margin: "0 16px",
  fontSize: "13px",
  lineHeight: "18px",
  color: "var(--color-error, #c0392b)",
};
const rowStyle = { display: "flex", alignItems: "center", height: "100%", gap: "8px" };

const LoginModal = forwardRef((props, ref) => {
  const [showModal, setShowModal] = useState(!!props.defaultOpen);
  const [isButtonHovered, setIsButtonHovered] = useState(false);
  const [isButtonActive, setIsButtonActive] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  // "choose": create account, sign in or wallet; "create": pick a nickname;
  // "avatar": the new account may add a profile picture (or skip it).
  const [step, setStep] = useState("choose");
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [nickname, setNickname] = useState("");
  // "", "invalid", "checking", "available" or "taken"
  const [nameState, setNameState] = useState("");
  const [created, setCreated] = useState(null);

  useEffect(() => {
    const problem = nameProblem(nickname);
    if (!nickname || problem) {
      setNameState(nickname ? "invalid" : "");
      return;
    }
    setNameState("checking");
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/v1/profile-name/${encodeURIComponent(nickname)}`,
        );
        setNameState(response.status === 404 ? "available" : "taken");
      } catch (err) {
        setNameState("");
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [nickname]);
  const [passkeyError, setPasskeyError] = useState("");
  const { openConnectModal } = useConnectModal();
  const showPasskey = canUsePasskey();

  function openModal() {
    setPasskeyError("");
    setShowModal(true);
  }

  useEffect(() => {
    if (!avatarFile) return;
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  function closeModal() {
    // NOTE: The account exists by now; reload so the page shows it signed in.
    if (step === "avatar") {
      setShowModal(false);
      window.location.reload();
      return;
    }
    setShowModal(false);
    setStep("choose");
    setPasskeyError("");
    if (props.onClose) props.onClose();
  }

  // mode: "create" for a new account, "signIn" for an existing passkey
  const failed = (passkey, err) => {
    setPasskeyBusy(false);
    if (passkey && passkey.isCancellation(err)) return;
    if (passkey && err instanceof passkey.PrfUnsupportedError) {
      setPasskeyError(err.message);
      return;
    }
    console.error("Passkey sign-in failed", err);
    setPasskeyError(
      "Couldn't use your passkey. Please try again or use your wallet.",
    );
  };

  const handleSignIn = async () => {
    if (passkeyBusy) return;
    setPasskeyError("");
    setPasskeyBusy(true);
    let passkey;
    try {
      passkey = await import("./passkey.mjs");
      const account = await passkey.signIn();
      passkey.storeAccount(account);
      setCookie("identity", account.address, tenYearsInSeconds);
      setShowModal(false);
      window.location.reload();
    } catch (err) {
      failed(passkey, err);
    }
  };

  // NOTE: The nickname comes first and is required: the passkey is saved
  // under it ("<nickname>" on Kiwi News in the password manager) and it
  // becomes the profile right away. If saving the name fails after the
  // passkey exists (e.g. someone took it in the meantime), only the profile
  // save is retried with a new name; no second passkey is made.
  const handleCreate = async () => {
    if (passkeyBusy || nameState !== "available") return;
    setPasskeyError("");
    setPasskeyBusy(true);
    let passkey;
    try {
      passkey = await import("./passkey.mjs");
      let account = created;
      if (!account) {
        account = await passkey.create({ name: nickname });
        passkey.storeAccount(account);
        setCookie("identity", account.address, tenYearsInSeconds);
        // NOTE: The bell (Bell.jsx) stays hidden until there's a lastUpdate;
        // a brand-new account has nothing to catch up on.
        setCookie("lastUpdate", Math.floor(Date.now() / 1000));
        setCreated(account);
      }
      const problem = await saveProfile(account.privateKey, nickname);
      if (problem) {
        setPasskeyBusy(false);
        setNameState("taken");
        setPasskeyError(problem);
        return;
      }
      setPasskeyBusy(false);
      setStep("avatar");
    } catch (err) {
      failed(passkey, err);
    }
  };

  const finish = () => {
    setShowModal(false);
    window.location.reload();
  };

  const handleAvatarFile = (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPasskeyError("Please select an image file");
      return;
    }
    setPasskeyError("");
    setAvatarFile(file);
  };

  // NOTE: Re-signs the whole profile (name, empty bio, picture) with the new
  // account's key, the same way EditProfile.jsx saves it.
  const handleAvatarSave = async () => {
    if (passkeyBusy || !avatarFile || !created) return;
    setPasskeyError("");
    setPasskeyBusy(true);
    try {
      const url = await uploadImage(avatarFile);
      const problem = await saveProfile(created.privateKey, nickname, url);
      if (problem) {
        setPasskeyBusy(false);
        setPasskeyError(problem);
        return;
      }
      finish();
    } catch (err) {
      console.error("Profile picture upload failed", err);
      setPasskeyBusy(false);
      setPasskeyError(`Error uploading image: ${err.message}`);
    }
  };

  useImperativeHandle(ref, () => ({
    openModal,
    closeModal,
  }));

  const handleConnectWallet = () => {
    closeModal();
    if (openConnectModal) {
      openConnectModal();
    }
  };


  // Modal settings
  const customStyles = {
    overlay: {
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      zIndex: 1000,
    },
    content: {
      fontSize: "15px",
      lineHeight: "1.325",
      fontFamily: "ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'",
      backgroundColor: "var(--bg-white)",
      border: "var(--border-subtle)",
      overflow: "hidden",
      WebkitOverflowScrolling: "touch",
      borderRadius: "2px",
      outline: "none",
      padding: "0",
      position: "absolute",
      top: "16px",
      left: "50%",
      right: "auto",
      bottom: "auto",
      marginRight: "-50%",
      transform: "translateX(-50%)",
      maxWidth: "360px",
      minWidth: "360px",
      width: "100%",
      display: "flex",
      flexDirection: "column",
      zIndex: 1001,
    },
  };

  // Apply drawer style for mobile (bottom drawer)
  if (typeof window !== "undefined" && window.innerWidth < 480) {
    customStyles.content = {
      ...customStyles.content,
      top: "auto",
      left: "0",
      right: "0",
      bottom: "0",
      transform: "none",
      maxWidth: "460px",
      minWidth: "360px",
      margin: "0 auto",
      borderBottomLeftRadius: "0",
      borderBottomRightRadius: "0",
      borderBottom: "none",
    };
  }

  const domain = typeof window !== "undefined" ? window.location.hostname : "kiwistand.com";
  const domainParts = domain.split(".");
  const subdomain = domainParts.length > 2 ? domainParts[0] : "";
  const mainDomain = domainParts.length > 2 ? domainParts.slice(1).join(".") : domain;

  return (
    <Modal
      isOpen={showModal}
      contentLabel="Log In to Kiwi News"
      shouldCloseOnOverlayClick={true}
      onRequestClose={closeModal}
      style={customStyles}
      closeTimeoutMS={0}
    >
      {/* header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: "33px",
        borderBottom: "var(--border-thin)",
        padding: "0 0 0 12px",
        userSelect: "none",
        whiteSpace: "nowrap",
        boxSizing: "border-box",
        width: "100%",
        backgroundColor: "var(--bg-white)",
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          flex: 1,
          minWidth: 0,
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            fontSize: "13px",
            gap: "8px",
          }}>
            <div style={{
              borderRadius: "2px",
              height: "20px",
              width: "20px",
              overflow: "hidden",
            }}>
              <img height="20" width="20" alt="" src="data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='20'%20height='20'%20fill='none'%3e%3cpath%20fill='%23D9D9D9'%20d='M0%200h20v20H0z'/%3e%3cg%20stroke='%23000'%20stroke-linecap='round'%20stroke-linejoin='round'%20clip-path='url(%23a)'%3e%3cpath%20d='M15.565%2011.75h-2.648a1.167%201.167%200%200%200-1.167%201.167v2.648M7.083%204.948v.969a1.75%201.75%200%200%200%201.75%201.75A1.167%201.167%200%200%201%2010%208.833a1.167%201.167%200%201%200%202.333%200A1.17%201.17%200%200%201%2013.5%207.667h1.849m-5.932%208.137V13.5a1.167%201.167%200%200%200-1.167-1.167%201.167%201.167%200%200%201-1.166-1.166v-.584a1.167%201.167%200%200%200-1.167-1.166h-1.72'/%3e%3cpath%20d='M10%2015.833a5.833%205.833%200%201%200%200-11.666%205.833%205.833%200%200%200%200%2011.666Z'/%3e%3c/g%3e%3cdefs%3e%3cclipPath%20id='a'%3e%3cpath%20fill='%23fff'%20d='M3%203h14v14H3z'/%3e%3c/clipPath%3e%3c/defs%3e%3c/svg%3e" />
            </div>
            <div style={{ fontSize: "14px", lineHeight: "22px", fontWeight: "normal" }}>
              <div style={{ display: "flex", overflow: "hidden" }} title={`https://${domain}/`}>
                {subdomain && (
                  <>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{subdomain}</div>
                    <div>.</div>
                  </>
                )}
                <div>{mainDomain}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <VerifiedIcon />
            </div>
          </div>
        </div>
        <button
          onClick={closeModal}
          type="button"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            padding: "0 6px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            borderTopRightRadius: "2px",
          }}
          title="Close Dialog"
          aria-label="Close modal"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Modal content */}
      <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
        {/* title section */}
        <div style={{ display: "flex", flexDirection: "column", padding: "12px 12px 8px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", paddingBottom: "4px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                backgroundColor: "var(--color-badge-bg)",
                color: "var(--color-badge-icon)",
              }}>
                <SparkleIcon />
              </div>
              <div style={{ fontSize: "18px", fontWeight: "500", color: "var(--text-primary)" }}>
                {step === "avatar" ? "Add a profile picture" : "Welcome to Kiwi News!"}
              </div>
            </div>
          </div>
        </div>

        {/* content section */}
        <div style={{ flexGrow: 1, padding: "0 12px 12px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ fontSize: "15px", color: "var(--text-primary)", lineHeight: "22px" }}>
              {step === "avatar"
                ? "Help people recognize you next to your stories and comments. You can change it anytime in your profile."
                : "Please sign in to continue"}
            </div>
          </div>
        </div>

        {/* button footer */}
        <div style={{
          display: "flex",
          minHeight: "48px",
          width: "100%",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          paddingBottom: "12px",
        }}>
          <div style={{
            display: "flex",
            width: "100%",
            flexDirection: "column",
            gap: "8px",
          }}>
            {showPasskey ? (
              <>
            {step === "choose" ? (
              <>
                <button
                  style={primaryStyle}
                  onClick={() => {
                    setPasskeyError("");
                    setStep("create");
                  }}
                >
                  Create account
                </button>
                <button
                  style={{
                    ...secondaryStyle,
                    cursor: passkeyBusy ? "wait" : "pointer",
                  }}
                  onClick={handleSignIn}
                  disabled={passkeyBusy}
                >
                  {passkeyBusy ? "Waiting for passkey..." : "Sign in"}
                </button>
                {passkeyError && <div role="alert" style={errorStyle}>{passkeyError}</div>}
                <button style={tertiaryStyle} onClick={handleConnectWallet}>
                  I have my own wallet
                </button>
              </>
            ) : step === "avatar" ? (
              <>
                {/* NOTE: Tapping the picture picks another one. */}
                <div style={{ display: "flex", justifyContent: "center", margin: "0 16px 4px" }}>
                  <label
                    title="Choose a picture"
                    style={{
                      cursor: passkeyBusy ? "wait" : "pointer",
                      width: "96px",
                      height: "96px",
                      borderRadius: "50%",
                      overflow: "hidden",
                      border: "var(--border-thin)",
                      backgroundColor: "var(--color-badge-bg)",
                      color: "var(--color-badge-icon)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "36px",
                      fontWeight: 500,
                      textTransform: "uppercase",
                    }}
                  >
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt="Your profile picture"
                        width="96"
                        height="96"
                        style={{ width: "96px", height: "96px", objectFit: "cover" }}
                      />
                    ) : (
                      nickname.slice(0, 1)
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarFile}
                      disabled={passkeyBusy}
                      style={{ display: "none" }}
                    />
                  </label>
                </div>
                {avatarFile ? (
                  <button
                    style={{
                      ...primaryStyle,
                      cursor: passkeyBusy ? "wait" : "pointer",
                      opacity: passkeyBusy ? 0.5 : 1,
                    }}
                    onClick={handleAvatarSave}
                    disabled={passkeyBusy}
                  >
                    {passkeyBusy ? "Saving..." : "Save"}
                  </button>
                ) : (
                  <label style={{ ...primaryStyle, boxSizing: "border-box" }}>
                    Choose a picture
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarFile}
                      style={{ display: "none" }}
                    />
                  </label>
                )}
                {passkeyError && <div role="alert" style={errorStyle}>{passkeyError}</div>}
                <button
                  type="button"
                  onClick={finish}
                  disabled={passkeyBusy}
                  style={tertiaryStyle}
                >
                  Skip
                </button>
              </>
            ) : (
              <>
                <label
                  htmlFor="kiwi-signup-name"
                  style={{ margin: "0 16px", fontWeight: 600, fontSize: "15px" }}
                >
                  Pick a nickname
                </label>
                <input
                  id="kiwi-signup-name"
                  autoFocus
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="e.g. kiwi_fan"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value.trim())}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  disabled={passkeyBusy}
                  style={{
                    margin: "0 16px",
                    padding: "9px 10px",
                    fontSize: "16px",
                    fontFamily: "inherit",
                    border: "var(--border)",
                    borderRadius: "2px",
                    background: "var(--bg-white)",
                    color: "var(--text-primary)",
                  }}
                />
                <div style={{ margin: "-2px 16px 0", fontSize: "13px", minHeight: "18px", color: nameState === "available" ? "var(--accent-primary-dark, #5a7d0a)" : "var(--text-secondary)" }}>
                  {nameState === "available" && "Available"}
                  {nameState === "taken" && "That name is taken"}
                  {nameState === "checking" && "Checking..."}
                  {nameState === "invalid" && nameProblem(nickname)}
                </div>
                <button
                  style={{
                    ...primaryStyle,
                    cursor: passkeyBusy ? "wait" : "pointer",
                    opacity: nameState === "available" && !passkeyBusy ? 1 : 0.5,
                  }}
                  onClick={handleCreate}
                  disabled={nameState !== "available" || passkeyBusy}
                >
                  {passkeyBusy ? "Waiting for passkey..." : "Create account"}
                </button>
                {passkeyError && <div role="alert" style={errorStyle}>{passkeyError}</div>}
                {!created && (
                  <button
                    type="button"
                    onClick={() => setStep("choose")}
                    disabled={passkeyBusy}
                    style={tertiaryStyle}
                  >
                    ← Back
                  </button>
                )}
              </>
            )}

              </>
            ) : (
              <>
            {/* Primary button - Connect wallet */}
            <button
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                height: "38px",
                backgroundColor: isButtonHovered ? "var(--accent-primary-hover)" : "var(--accent-primary)",
                border: isButtonHovered ? "1px solid var(--accent-primary-hover)" : "1px solid var(--accent-primary)",
                color: "var(--bg-black)",
                borderRadius: "8px",
                fontSize: "15px",
                fontWeight: "normal",
                cursor: "pointer",
                transform: isButtonActive ? "translateY(1px)" : "translateY(0)",
                transition: "background-color 0.15s ease, border-color 0.15s ease, transform 0.05s ease",
                margin: "0 16px",
                whiteSpace: "nowrap",
              }}
              onClick={handleConnectWallet}
              onMouseEnter={() => setIsButtonHovered(true)}
              onMouseLeave={() => {
                setIsButtonHovered(false);
                setIsButtonActive(false);
              }}
              onMouseDown={() => setIsButtonActive(true)}
              onMouseUp={() => setIsButtonActive(false)}
            >
              <div style={{ display: "flex", alignItems: "center", height: "100%", gap: "8px" }}>
                <WalletIcon />
                <span>Connect wallet</span>
              </div>
            </button>

              </>
            )}

          </div>
        </div>
      </div>
    </Modal>
  );
});

LoginModal.displayName = "LoginModal";

export default LoginModal;
