import React, {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useAccount, useDisconnect } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Wallet } from "@ethersproject/wallet";

import * as API from "../API.mjs";
import {
  setCookie,
  tenYearsInSeconds,
  isIOSApp,
  getLocalAccount,
  announceAccountChange,
} from "../session.mjs";
import { PROFILE_TYPES, nameProblem } from "../EditProfile.jsx";
import { uploadImage } from "../uploadImage.mjs";
import {
  useDesktop,
  Icon,
  Logo,
  Tile,
  Heading,
  Skip,
  ErrorText,
} from "./ui.jsx";

const DelegateStep = lazy(() => import("./Delegate.jsx"));

// NOTE: The same flow as the iOS app (OnboardingView.swift), minus "Get
// notified" (the website has no web push sign-up):
// Welcome → Join, then one of
// - Create account: Nickname (its "Create account" button makes the passkey,
//   named after the nickname, and saves the nickname) → Profile picture →
//   Replies by email → Done,
// - Sign in (an existing passkey) → Replies by email → Done,
// - I have my own wallet: the wallet picker (RainbowKit) → One-tap actions
//   (delegation; "Not now" closes) → Replies by email → Done.
// "Replies by email" is left out once it was done or skipped in this browser.
const AGREED = "kiwi-onboarding-agreed";
const EMAIL_DONE = "kiwi-onboarding-email-done";

const LABELS = {
  welcome: "Welcome",
  join: "Create account",
  nickname: "Nickname",
  avatar: "Profile picture",
  delegate: "One-tap actions",
  email: "Email replies",
};
const JOIN_LABELS = {
  create: "Create account",
  signin: "Sign in",
  wallet: "Your wallet",
};

function stepsFor(path, emailDone) {
  const email = emailDone ? [] : ["email"];
  if (path === "wallet") return ["welcome", "join", "delegate", ...email];
  if (path === "signin") return ["welcome", "join", ...email];
  return ["welcome", "join", "nickname", "avatar", ...email];
}

function canUsePasskey() {
  if (typeof window.PublicKeyCredential === "undefined") return false;
  // NOTE: The iOS app has its own native sign-in.
  try {
    if (isIOSApp()) return false;
  } catch (err) {}
  return true;
}

function agreedBefore() {
  try {
    return localStorage.getItem(AGREED) === "true";
  } catch (err) {
    return false;
  }
}

function agree() {
  try {
    localStorage.setItem(AGREED, "true");
  } catch (err) {}
}

function emailDoneBefore() {
  try {
    return localStorage.getItem(EMAIL_DONE) === "true";
  } catch (err) {
    return false;
  }
}

function markEmailDone() {
  try {
    localStorage.setItem(EMAIL_DONE, "true");
  } catch (err) {}
}

// Saves the profile: first the nickname, later maybe a picture. Returns the
// server's message when it fails, e.g. "That name is taken".
async function saveProfile(privateKey, name, avatar = "") {
  const value = {
    name,
    bio: "",
    avatar,
    timestamp: Math.floor(Date.now() / 1000),
  };
  const signature = await new Wallet(privateKey)._signTypedData(
    API.EIP712_DOMAIN,
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
  if (avatar) return body.details || "Couldn’t save your picture.";
  return body.details || "Couldn’t save your nickname. Please try another.";
}

// Same message as the email form in Bell.jsx (comment reply notifications).
async function subscribeReplies(email, privateKey) {
  const value = API.messageFab(email, email, "EMAILAUTH");
  const signature = await new Wallet(privateKey)._signTypedData(
    API.EIP712_DOMAIN,
    API.EIP712_TYPES,
    value,
  );
  const wait = null;
  const endpoint = "/api/v1/email-notifications";
  const port = window.location.port;
  const response = await API.send(value, signature, wait, endpoint, port);
  if (response.status !== "success") {
    throw new Error(response.details || "Couldn’t subscribe.");
  }
}

// Desktop: the welcome buttons sit at the bottom of the content panel.
function Wrap({ desk, children }) {
  if (!desk) return children;
  return <div className="kob-stack-end">{children}</div>;
}

const pad = (n) => String(n).padStart(2, "0");

function rules() {
  return [
    "No objectionable, abusive, hateful, sexual, violent or illegal content.",
    "No harassment, ad hominem attacks, spam or shilling.",
    "Everything you post is public, signed with your key and shared across Kiwi nodes; it can’t be edited.",
  ];
}

function Guidelines({ onDone }) {
  const bullet = (text) => (
    <div className="kob-doc-bullet" key={text}>
      <span>•</span>
      <span>{text}</span>
    </div>
  );
  return (
    <div className="kob-doc" role="dialog" aria-modal="true" aria-label="Guidelines">
      <div className="kob-doc-top">
        <button type="button" className="kob-doc-done" onClick={onDone}>
          Done
        </button>
      </div>
      <div className="kob-doc-body">
        <h2 className="kob-doc-title">Guidelines</h2>
        <section className="kob-doc-section">
          <h3>Community rules</h3>
          <p>These are the terms you agree to when using Kiwi&nbsp;News:</p>
          {[
            ...rules(),
            "Report posts, comments and people via the “…” menu, or block them. We review reports within 24 hours and remove violating content and accounts.",
          ].map(bullet)}
          <div className="kob-doc-contact">
            Contact:{" "}
            <a href="mailto:tim@daubenschuetz.de">tim@daubenschuetz.de</a>
          </div>
        </section>
        <section className="kob-doc-section">
          <h3>Why guidelines are important</h3>
          <p>
            We have an opportunity to build our own corner of the onchain
            internet. With awesome people, links, resources, and learning.
          </p>
          <p>
            To ensure this corner is valuable, we need to follow some
            submission&nbsp;guidelines.
          </p>
        </section>
        <section className="kob-doc-section">
          <h4>What to submit?</h4>
          <p>
            <strong>On&nbsp;topic:</strong>
          </p>
          <p>
            Anything that gratifies the intellectual curiosities of builders,
            engineers, hackers, and craftspeople in the&nbsp;community.
          </p>
          <p>That&nbsp;includes:</p>
          {[
            "Technical resources, hacking, and awesome git repos",
            "Dune dashboards, reports, data-driven articles",
            "Startups, cryptocurrencies, cryptography",
          ].map(bullet)}
          <a
            className="kob-doc-more"
            href="/guidelines"
            target="_blank"
            rel="noopener"
          >
            Read all guidelines
          </a>
        </section>
      </div>
    </div>
  );
}

// NOTE: start="delegate" opens it right at "Enable one-tap actions", for a
// wallet that is connected but has no key in this browser yet (it replaces
// the old delegation dialog, see DelegationModal.jsx).
export default function Onboarding({ onClose, start }) {
  const desk = useDesktop();
  const account = useAccount();
  const passkeys = canUsePasskey();
  const [step, setStep] = useState(() =>
    start === "delegate" ? "delegate" : agreedBefore() ? "join" : "welcome",
  );
  // "create", "signin" or "wallet"; without passkeys only the wallet works.
  const [path, setPath] = useState(
    passkeys && start !== "delegate" ? "create" : "wallet",
  );
  const [emailDone] = useState(emailDoneBefore);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [doc, setDoc] = useState(false);
  const { openConnectModal, connectModalOpen } = useConnectModal();
  const { disconnectAsync } = useDisconnect();
  const pickerPending = useRef(false);
  useEffect(() => {
    if (pickerPending.current && openConnectModal) {
      pickerPending.current = false;
      openConnectModal();
    }
  }, [openConnectModal]);
  // The account exists (passkey made, signed in or wallet delegated):
  // closing tells the page's islands, so it shows it signed in.
  const [made, setMade] = useState(false);
  // The passkey account (new or signed in); kept so a failed name save
  // doesn't make a second passkey.
  const [created, setCreated] = useState(null);
  const [nickname, setNickname] = useState("");
  // "", "invalid", "checking", "available" or "taken"
  const [nameState, setNameState] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [email, setEmail] = useState("");
  const fileInput = useRef(null);
  const indexed = useRef(false);
  const address = useRef("");
  address.current = account.address || "";

  const steps = stepsFor(path, emailDone);
  const index = steps.indexOf(step);

  // NOTE: No reload: the header's islands (bell, avatar, tab bar) re-read
  // the new account in place (announceAccountChange in session.mjs).
  // Forms that were rendered for a logged-out reader (the story page's
  // comment box, the submit form) only pick the account up on a fresh
  // mount, so those pages still reload, after the header has updated.
  const finish = useCallback(() => {
    if (made) {
      announceAccountChange();
      if (document.querySelector(".comment-input-host, #submit-button")) {
        window.location.reload();
        return;
      }
    }
    onClose();
  }, [made, onClose]);

  const go = (next) => {
    setError("");
    setBusy(false);
    setStep(next);
  };

  const after = (current, list = steps) => {
    const at = list.indexOf(current);
    return list[at + 1] || "done";
  };

  // The rest of the page stays put while this is open, and the delegation
  // dialog (DelegationModal.jsx) doesn't pop up on top of it.
  useEffect(() => {
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    window.kiwiOnboardingOpen = true;
    return () => {
      root.style.overflow = overflow;
      window.kiwiOnboardingOpen = false;
    };
  }, []);

  useEffect(() => {
    const keydown = (e) => {
      if (e.key !== "Escape" || busy || connectModalOpen) return;
      if (doc) return setDoc(false);
      if (desk && step !== "welcome") finish();
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [busy, doc, desk, step, finish, connectModalOpen]);

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

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // The private key that signs the profile and the email sign-up: the
  // passkey account, or the wallet's new app key.
  const signingKey = () => {
    if (created) return created.privateKey;
    const local = getLocalAccount(address.current);
    return local ? local.privateKey : "";
  };

  // Wallet path: the delegation is indexed (or this browser already had a
  // key for the wallet). Like on iOS, no nickname or picture is asked here.
  const delegated = useCallback(() => {
    if (indexed.current) return;
    indexed.current = true;
    setMade(true);
    go(after("delegate", stepsFor("wallet", emailDone)));
  }, [emailDone]);

  // "I have my own wallet" opens the wallet picker (RainbowKit); once a
  // wallet is connected, "Enable one-tap actions" follows, unless this
  // browser already has a key for it.
  useEffect(() => {
    if (step !== "join" || path !== "wallet") return;
    if (!account.isConnected || !account.address) return;
    if (getLocalAccount(account.address)) {
      delegated();
      return;
    }
    go("delegate");
  }, [step, path, account.isConnected, account.address]);

  const passkeyFailed = (passkey, err, fallback) => {
    setBusy(false);
    if (passkey && passkey.isCancellation(err)) {
      setError(fallback.cancelled);
      return;
    }
    if (passkey && err instanceof passkey.PrfUnsupportedError) {
      setError(err.message);
      return;
    }
    console.error("Passkey failed", err);
    setError(fallback.failed);
  };

  // "Sign in": an existing passkey, then "Replies by email". On a cancel or
  // an error it stays on Join with a short message.
  const handleSignIn = async () => {
    if (busy) return;
    setError("");
    setBusy(true);
    let passkey;
    try {
      passkey = await import("../passkey.mjs");
      const signedIn = await passkey.signIn();
      passkey.storeAccount(signedIn);
      setCookie("identity", signedIn.address, tenYearsInSeconds);
      setCreated(signedIn);
      setMade(true);
      setPath("signin");
      go(after("join", stepsFor("signin", emailDone)));
    } catch (err) {
      passkeyFailed(passkey, err, {
        cancelled: "Sign-in was cancelled.",
        failed: "Couldn’t sign in with your passkey. Please try again.",
      });
    }
  };

  // NOTE: "Create account" on the nickname page: makes the passkey under the
  // nickname ("<nickname>" on Kiwi News in the password manager) and saves
  // the nickname as the profile. If saving the name fails after the passkey
  // exists (someone took it in the meantime), only the profile save is
  // retried with a new name; no second passkey is made.
  const handleCreate = async () => {
    if (busy || nameState !== "available") return;
    setError("");
    setBusy(true);
    let passkey;
    try {
      let fresh = created;
      if (!fresh) {
        passkey = await import("../passkey.mjs");
        fresh = await passkey.create({ name: nickname });
        passkey.storeAccount(fresh);
        setCookie("identity", fresh.address, tenYearsInSeconds);
        // NOTE: The bell (Bell.jsx) stays hidden until there's a lastUpdate;
        // a brand-new account has nothing to catch up on.
        setCookie("lastUpdate", Math.floor(Date.now() / 1000));
        setCreated(fresh);
        setMade(true);
      }
      const problem = await saveProfile(fresh.privateKey, nickname);
      if (problem) {
        setBusy(false);
        if (/taken/i.test(problem)) setNameState("taken");
        setError(problem);
        return;
      }
      go("avatar");
    } catch (err) {
      passkeyFailed(passkey, err, {
        cancelled: "",
        failed: "Couldn’t create your passkey. Please try again.",
      });
    }
  };

  const chooseFile = () => {
    if (!busy && fileInput.current) fileInput.current.click();
  };

  const handleFile = (e) => {
    const picked = e.target.files[0];
    e.target.value = "";
    if (!picked) return;
    if (!picked.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    setError("");
    setFile(picked);
  };

  // NOTE: Re-signs the whole profile (name, empty bio, picture) with the new
  // account's key, the same way the old LoginModal.jsx and EditProfile.jsx
  // save it.
  const handleAvatar = async () => {
    if (busy || !file) return;
    setError("");
    setBusy(true);
    try {
      const url = await uploadImage(file);
      const problem = await saveProfile(signingKey(), nickname, url);
      if (problem) {
        setBusy(false);
        setError(problem);
        return;
      }
      go(after("avatar"));
    } catch (err) {
      console.error("Profile picture upload failed", err);
      setBusy(false);
      setError(`Couldn’t upload the picture: ${err.message}`);
    }
  };

  const emailValid = /.+@.+\..+/.test(email.trim());
  const handleEmail = async (e) => {
    e.preventDefault();
    if (busy || !emailValid) return;
    setError("");
    setBusy(true);
    try {
      await subscribeReplies(email.trim(), signingKey());
      markEmailDone();
      go("done");
    } catch (err) {
      console.error("Email sign-up failed", err);
      setBusy(false);
      setError("Couldn’t subscribe this email. Please try again.");
    }
  };
  const skipEmail = () => {
    markEmailDone();
    go("done");
  };

  const shownName = nickname;
  const letter = shownName.replace(/^@/, "").slice(0, 1);

  // --- Pages ---

  const welcome = (
    <>
      {!desk && <Logo />}
      <Heading
        title={
          desk ? (
            "Welcome to Kiwi News"
          ) : (
            <>
              Welcome to
              <br />
              Kiwi&nbsp;News
            </>
          )
        }
      >
        <p>
          Handpicked links for builders, engineers and crypto researchers,
          curated and discussed by the&nbsp;community.
        </p>
      </Heading>
      <div className="kob-rules">
        {desk ? (
          <div className="kob-rules-label">COMMUNITY RULES</div>
        ) : (
          <div className="kob-rules-title">Community rules</div>
        )}
        {[
          ...rules(),
          desk
            ? "Report posts, comments and people from their “…” menu, or block them. We review reports within 24 hours."
            : "Report posts, comments and people via the “…” menu, or block them. We review reports within 24 hours and remove violating content and accounts.",
        ].map((rule) => (
          <div className="kob-rule" key={rule}>
            <span className="kob-rule-mark">{desk ? "—" : "•"}</span>
            <span>{rule}</span>
          </div>
        ))}
        <div className="kob-links">
          <button type="button" className="kob-link" onClick={() => setDoc(true)}>
            Terms &amp; Guidelines
          </button>
          <a
            className="kob-link"
            href="/privacy-policy"
            target="_blank"
            rel="noopener"
          >
            Privacy Policy
          </a>
        </div>
      </div>
      <Wrap desk={desk}>
        <button
          type="button"
          className="kob-btn kob-btn-40"
          onClick={() => {
            agree();
            go("join");
          }}
        >
          I agree, continue
        </button>
        <button
          type="button"
          className="kob-skip"
          onClick={() => {
            agree();
            onClose();
          }}
        >
          I agree, just browse for now
        </button>
      </Wrap>
    </>
  );

  const startCreate = () => {
    setPath("create");
    go("nickname");
  };
  // NOTE: RainbowKit only offers its picker (openConnectModal) while wagmi
  // is disconnected. A wallet that is stuck reconnecting (e.g. two wallet
  // extensions fighting over window.ethereum) left "I have my own wallet"
  // doing nothing: reset that half-made connection, then open the picker.
  const startWallet = async () => {
    setError("");
    setPath("wallet");
    if (openConnectModal) {
      openConnectModal();
      return;
    }
    if (account.isConnected && account.address && account.status === "connected") {
      return; // The effect below continues to "Enable one-tap actions".
    }
    pickerPending.current = true;
    try {
      await disconnectAsync();
    } catch (err) {
      console.warn("Couldn't reset the wallet connection", err);
    }
  };
  const waiting = path === "wallet" && connectModalOpen;
  const walletLabel = waiting ? "Waiting for your wallet…" : null;

  const join = desk ? (
    <>
      <Tile icon="user-plus" desk />
      <Heading title={passkeys ? "Create your account" : "Join Kiwi News"}>
        <p>
          {passkeys
            ? "No wallet needed. Your account is secured with a passkey on this device, so there’s no password or seed phrase to remember."
            : "Connect your wallet. Reading never needs an account."}
        </p>
      </Heading>
      {/* NOTE: Tim's order and levels: "Create account" (primary), the
          passkey sign-in as an outlined button of the same size, then the
          wallet as a plain text link right below. */}
      <div className="kob-join-actions">
        <button
          type="button"
          className="kob-btn"
          onClick={passkeys ? startCreate : startWallet}
          disabled={busy}
        >
          {passkeys ? "Create account" : walletLabel || "Connect wallet"}
        </button>
        {passkeys && (
          <button
            type="button"
            className="kob-btn kob-btn-outline"
            onClick={handleSignIn}
            disabled={busy}
          >
            {busy
              ? "Waiting for your passkey…"
              : "Already have an account? Log in"}
          </button>
        )}
        {passkeys && (
          <button
            type="button"
            className="kob-textlink kob-join-wallet"
            onClick={startWallet}
            disabled={busy}
          >
            {walletLabel || "Have a wallet? Connect it instead"}
          </button>
        )}
      </div>
      <ErrorText>{error}</ErrorText>
    </>
  ) : (
    <>
      <Tile icon="user-plus" />
      <Heading title="Join Kiwi News">
        {passkeys && (
          <p>
            Create an account in a few seconds. You don’t need a wallet or a
            seed phrase.
          </p>
        )}
        <p>Reading never needs an account.</p>
      </Heading>
      {passkeys && (
        <>
          <button
            type="button"
            className="kob-btn"
            onClick={startCreate}
            disabled={busy}
          >
            Create account
          </button>
          <button
            type="button"
            className="kob-btn kob-btn-outline"
            onClick={handleSignIn}
            disabled={busy}
          >
            {busy ? "Waiting for your passkey…" : "Sign in"}
          </button>
        </>
      )}
      <button
        type="button"
        className={passkeys ? "kob-skip" : "kob-btn"}
        onClick={startWallet}
        disabled={busy}
      >
        {walletLabel || (passkeys ? "I have my own wallet" : "Connect wallet")}
      </button>
      <ErrorText>{error}</ErrorText>
    </>
  );

  const taken = nameState === "taken";
  const nicknamePage = (
    <>
      <Tile icon="at" desk={desk} />
      <Heading title="Pick a nickname">
        <p>
          This is how others see you on Kiwi News. You can change it later in
          Settings.
        </p>
      </Heading>
      <div className="kob-field">
        <div className="kob-input-wrap">
          <input
            className={`kob-input kob-mono${taken ? " kob-bad" : ""}`}
            aria-label="Nickname"
            aria-invalid={taken || nameState === "invalid"}
            autoFocus
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="e.g. kiwi_fan"
            value={nickname}
            onChange={(e) => {
              setError("");
              setNickname(e.target.value.trim());
            }}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            disabled={busy}
          />
          {nickname && !desk && (
            <button
              type="button"
              className="kob-clear"
              aria-label="Clear"
              onClick={() => setNickname("")}
            >
              <Icon name="x-circle-fill" size={20} />
            </button>
          )}
        </div>
        <div
          className={`kob-helper${taken || nameState === "invalid" ? " kob-bad" : ""}`}
          aria-live="polite"
        >
          {nameState === "available" && (
            <>
              <Icon name="check-circle-fill" size={16} />
              Available
            </>
          )}
          {taken && (
            <>
              <Icon name="warning-circle-fill" size={16} />
              That name is taken. Try another one.
            </>
          )}
          {nameState === "invalid" && (
            <>
              <Icon name="warning-circle-fill" size={16} />
              {nameProblem(nickname)}
            </>
          )}
          {nameState === "checking" && "Checking…"}
        </div>
      </div>
      <div className="kob-actions">
        <button
          type="button"
          className="kob-btn"
          onClick={handleCreate}
          disabled={nameState !== "available" || busy}
        >
          {busy ? "Creating account…" : "Create account"}
        </button>
      </div>
      {!taken && <ErrorText>{error}</ErrorText>}
    </>
  );

  const avatarPage = (
    <>
      <div className="kob-tile-wrap">
        <div
          className="kob-avatar"
          role="button"
          tabIndex={0}
          aria-label={preview ? "Choose another photo" : "Choose photo"}
          onClick={chooseFile}
          onKeyDown={(e) => e.key === "Enter" && chooseFile()}
        >
          <div className="kob-avatar-face">
            {preview ? <img src={preview} alt="Your profile picture" /> : letter}
          </div>
          <div className="kob-avatar-badge">
            <Icon name={preview ? "pencil-simple" : "camera"} size={18} />
          </div>
        </div>
        <input
          ref={fileInput}
          className="kob-file"
          type="file"
          accept="image/*"
          tabIndex={-1}
          aria-hidden="true"
          onChange={handleFile}
        />
      </div>
      {preview ? (
        <Heading title={shownName ? `Looking good, ${shownName}` : "Looking good"}>
          <p>
            This picture shows next to your stories and comments. You can
            change it anytime in Settings.
          </p>
        </Heading>
      ) : (
        <Heading title="Add a profile picture">
          <p>
            {desk
              ? "Optional. It shows next to your stories and comments. Until then, we show the first letter of your nickname."
              : "Optional. It shows next to your stories and comments. You can add one later."}
          </p>
        </Heading>
      )}
      <div className="kob-actions">
        {preview ? (
          <button type="button" className="kob-btn" onClick={handleAvatar} disabled={busy}>
            {busy ? "Saving…" : "Continue"}
          </button>
        ) : (
          <button type="button" className="kob-btn" onClick={chooseFile}>
            {desk && <Icon name="upload-simple" size={16} />}
            {desk ? "Upload picture" : "Choose photo"}
          </button>
        )}
      </div>
      <ErrorText>{error}</ErrorText>
      {preview ? (
        <Skip desk={desk} label="Choose another photo" onClick={chooseFile} disabled={busy} />
      ) : (
        <Skip
          desk={desk}
          label="Skip"
          deskLabel="Skip for now"
          onClick={() => go(after("avatar"))}
        />
      )}
    </>
  );

  const delegatePage = (
    <Suspense fallback={null}>
      <DelegateStep desk={desk} onIndexed={delegated} onSkip={finish} />
    </Suspense>
  );

  const emailPage = (
    <>
      <Tile icon="envelope-simple" desk={desk} />
      <Heading title="Replies by email">
        <p>
          Optional: get an email when someone replies to your comments
          or&nbsp;stories.
        </p>
      </Heading>
      <form className="kob-field" onSubmit={handleEmail} noValidate>
        <input
          className="kob-input"
          type="email"
          aria-label="Email"
          placeholder="Email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
        />
        <div className="kob-actions">
          <button type="submit" className="kob-btn" disabled={!emailValid || busy}>
            {busy ? "Subscribing…" : "Subscribe"}
          </button>
        </div>
      </form>
      <ErrorText>{error}</ErrorText>
      <Skip
        desk={desk}
        label="Skip"
        deskLabel="Skip for now"
        onClick={skipEmail}
        disabled={busy}
      />
    </>
  );

  const donePage = (
    <>
      <Tile icon="check-circle" desk={desk} />
      <Heading title="You’re all set!">
        <p>
          {path === "signin"
            ? "You’re signed in. Like, comment and submit stories right away."
            : "Your account is ready. Like, comment and submit stories right away."}
        </p>
      </Heading>
      <div className="kob-actions">
        <button type="button" className="kob-btn" onClick={finish}>
          Start reading
        </button>
      </div>
    </>
  );

  const pages = {
    welcome,
    join,
    nickname: nicknamePage,
    avatar: avatarPage,
    delegate: delegatePage,
    email: emailPage,
    done: donePage,
  };

  // --- Chrome ---

  const total = steps.length;
  const filled = step === "done" ? total : index + 1;
  const eyebrow =
    step === "done"
      ? "GET STARTED · ALL SET"
      : `GET STARTED · ${pad(index + 1)} / ${pad(total)}`;
  const foot =
    path === "create" && step !== "welcome"
      ? "No wallet needed.\nYou can add one later."
      : "Read freely.\nJoin when you’re ready.";

  return createPortal(
    <div
      className="kob"
      onMouseDown={(e) => {
        if (desk && e.target === e.currentTarget && !busy && step !== "welcome")
          finish();
      }}
    >
      <div
        className="kob-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Join Kiwi News"
        data-step={step}
      >
        <aside className="kob-side">
          <div className="kob-side-top">
            <Logo />
            <div className="kob-side-title">Your Kiwi setup</div>
            <ol className="kob-steps">
              {steps.map((name, i) => {
                const state =
                  step === "done" || i < index
                    ? "kob-done"
                    : i === index
                      ? "kob-now"
                      : "";
                return (
                  <li key={name} className={`kob-step ${state}`}>
                    <span className="kob-step-n">
                      {state === "kob-done" ? (
                        <Icon name="check-bold" size={12} />
                      ) : (
                        pad(i + 1)
                      )}
                    </span>
                    {name === "join" ? JOIN_LABELS[path] : LABELS[name]}
                  </li>
                );
              })}
            </ol>
          </div>
          <div className="kob-side-foot">{foot}</div>
        </aside>

        <div className={`kob-mhead${step === "welcome" ? " kob-mhead-welcome" : ""}`}>
          <div className="kob-bars" aria-hidden="true">
            {steps.map((name, i) => (
              <span key={name} className={`kob-bar${i < filled ? " kob-on" : ""}`} />
            ))}
          </div>
          {step !== "welcome" && (
            <button type="button" className="kob-mclose" onClick={finish} disabled={busy}>
              Close
            </button>
          )}
        </div>

        <div className="kob-main">
          <div className="kob-dhead">
            <div className="kob-eyebrow">{eyebrow}</div>
            {step !== "welcome" && (
              <button
                type="button"
                className="kob-dclose"
                aria-label="Close"
                onClick={finish}
                disabled={busy}
              >
                <Icon name="x" size={18} />
              </button>
            )}
          </div>
          {pages[step]}
        </div>

        {doc && <Guidelines onDone={() => setDoc(false)} />}
      </div>
    </div>,
    document.body,
  );
}
