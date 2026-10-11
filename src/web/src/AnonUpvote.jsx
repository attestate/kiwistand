// The "Upvote anonymously" sheet: the one-time join step, then proving and
// sending an anonymous upvote. Loaded lazily from Vote.jsx; the Semaphore
// prover (anon-upvote.mjs) is loaded only once the sheet is open.
import React, { useEffect, useRef, useState } from "react";
import Modal from "react-modal";

const loadProver = () => import("./anon-upvote.mjs");

const API_PORT = 8443;
function apiUrl(endpoint) {
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:${API_PORT}${endpoint}`;
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
const textStyle = {
  fontSize: "15px",
  color: "var(--text-primary)",
  lineHeight: "22px",
  margin: 0,
};
const noteStyle = {
  fontSize: "13px",
  color: "var(--text-secondary)",
  lineHeight: "18px",
  margin: 0,
};
const errorStyle = {
  margin: "0 16px",
  fontSize: "13px",
  lineHeight: "18px",
  color: "var(--color-error, #c0392b)",
};

const MaskIcon = () => (
  <svg viewBox="0 0 256 256" style={{ width: "18px", height: "18px" }}>
    <rect width="256" height="256" fill="none" />
    <path
      d="M216,56V120c0,64-88,104-88,104S40,184,40,120V56a8,8,0,0,1,8-8c36,0,58-16,80-16s44,16,80,16A8,8,0,0,1,216,56Z"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
    />
    <circle cx="96" cy="104" r="12" fill="currentColor" />
    <circle cx="160" cy="104" r="12" fill="currentColor" />
    <path
      d="M96,152c8,12,20,16,32,16s24-4,32-16"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="16"
    />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" style={{ width: "18px", height: "18px" }}>
    <path
      fill="currentColor"
      d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12 5.7 16.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4z"
    />
  </svg>
);

const STEPS = [
  { id: "group", label: "Loading the group" },
  { id: "download", label: "Loading the prover" },
  { id: "prove", label: "Generating your proof" },
  { id: "send", label: "Sending your upvote" },
];

function formatMB(bytes) {
  return (bytes / 1024 / 1024).toFixed(1);
}

function Progress({ progress }) {
  const current = STEPS.findIndex((s) => s.id === progress.step);
  const downloading = progress.step === "download" && progress.total > 0;
  const percent = downloading
    ? Math.min(100, Math.round((progress.loaded / progress.total) * 100))
    : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <style>{`
        @keyframes kiwi-anon-indeterminate {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(250%); }
        }
      `}</style>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
        style={{
          position: "relative",
          height: "6px",
          borderRadius: "3px",
          overflow: "hidden",
          backgroundColor: "var(--bg-hover)",
        }}
      >
        <div
          style={
            percent === null
              ? {
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  width: "40%",
                  backgroundColor: "var(--accent-primary)",
                  animation:
                    "kiwi-anon-indeterminate 1.1s ease-in-out infinite",
                }
              : {
                  height: "100%",
                  width: `${percent}%`,
                  backgroundColor: "var(--accent-primary)",
                  transition: "width 0.2s ease",
                }
          }
        />
      </div>
      <ol
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        {STEPS.map((step, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li
              key={step.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "14px",
                color: active
                  ? "var(--text-primary)"
                  : done
                  ? "var(--text-secondary)"
                  : "var(--text-tertiary)",
                fontWeight: active ? 500 : 400,
              }}
            >
              <span style={{ width: "16px", textAlign: "center" }}>
                {done ? "✓" : active ? "•" : "○"}
              </span>
              <span>
                {step.label}
                {active && downloading
                  ? ` (${formatMB(progress.loaded)} / ${formatMB(progress.total)} MB)`
                  : ""}
                {active && step.id === "prove" ? "…" : ""}
              </span>
            </li>
          );
        })}
      </ol>
      <p style={noteStyle}>
        Your proof is made on this device. It shows you're in the group
        without showing who you are.
      </p>
    </div>
  );
}

export default function AnonUpvote(props) {
  const { account, storyIndex, onClose, onUpvoted } = props;
  // "loading" | "ineligible" | "join" | "joining" | "settling" | "ready" |
  // "proving" | "done" | "error"
  const [state, setState] = useState("loading");
  const [status, setStatus] = useState(null);
  const [progress, setProgress] = useState({ step: "group" });
  const [error, setError] = useState("");
  const mounted = useRef(true);

  useEffect(() => {
    Modal.setAppElement("body");
    // NOTE: Start fetching the prover while the user reads the sheet.
    loadProver().catch(() => {});
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = async () => {
    try {
      const response = await fetch(
        apiUrl(`/api/v1/anon/status?address=${account.identity}`),
      );
      const body = await response.json();
      if (body.status !== "success") throw new Error(body.details);
      if (!mounted.current) return;
      const data = body.data;
      setStatus(data);
      if (!data.member) {
        setState(data.eligible ? "join" : "ineligible");
      } else if (!data.member.settled) {
        setState("settling");
      } else {
        setState("ready");
      }
    } catch (err) {
      setError("Couldn't load your anonymous voting status.");
      setState("error");
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleJoin = async () => {
    setError("");
    setState("joining");
    try {
      const prover = await loadProver();
      let { secret, source } = prover.secretFor(account);
      if (source === "key" && prover.isPasskeyAccount(account)) {
        // NOTE: Passkey accounts derive the secret from the passkey, so it's
        // the same on every device.
        secret = await prover.secretFromPasskey(account);
      }
      await prover.join({ account, secret });
      await refresh();
    } catch (err) {
      setError(err.message || "Joining failed");
      setState("join");
    }
  };

  const handleUpvote = async () => {
    setError("");
    setState("proving");
    setProgress({ step: "group" });
    try {
      const prover = await loadProver();
      const { secret } = prover.secretFor(account);
      await prover.upvote({
        secret,
        storyIndex,
        onProgress: (p) => mounted.current && setProgress(p),
      });
      try {
        localStorage.setItem(`-kiwi-news-anon-upvoted-${storyIndex}`, "true");
      } catch (err) {}
      setState("done");
      onUpvoted?.();
    } catch (err) {
      setError(err.message || "Upvote failed");
      setState("ready");
    }
  };

  const minutesLeft = status?.member
    ? Math.max(1, Math.ceil((status.member.settlesAt - Date.now() / 1000) / 60))
    : 0;

  let title = "Upvote anonymously";
  let body = null;
  let actions = null;

  if (state === "loading") {
    body = <p style={noteStyle}>Loading…</p>;
  } else if (state === "ineligible") {
    body = (
      <p style={textStyle}>
        Anonymous upvotes are open to accounts with at least{" "}
        {status.minKarma} karma, so they can't come from throwaway accounts.
        You have {status.karma}.
      </p>
    );
    actions = (
      <button style={secondaryStyle} onClick={onClose}>
        OK
      </button>
    );
  } else if (state === "join" || state === "joining") {
    title = "Join anonymous voting";
    body = (
      <>
        <p style={textStyle}>
          Join once to upvote without showing your name. Your upvote still
          counts for the story and its submitter's karma.
        </p>
        <p style={noteStyle}>
          Joining is public: others can see that you can vote anonymously,
          but not which stories you upvote that way.
        </p>
      </>
    );
    actions = (
      <button
        style={{ ...primaryStyle, cursor: state === "joining" ? "wait" : "pointer" }}
        onClick={handleJoin}
        disabled={state === "joining"}
      >
        {state === "joining" ? "Joining…" : "Join anonymous voting"}
      </button>
    );
  } else if (state === "settling") {
    title = "You've joined";
    body = (
      <p style={textStyle}>
        You can upvote anonymously in about {minutesLeft} minute
        {minutesLeft === 1 ? "" : "s"}, once every Kiwi node has your
        membership.
      </p>
    );
    actions = (
      <button style={secondaryStyle} onClick={onClose}>
        OK
      </button>
    );
  } else if (state === "ready") {
    body = (
      <p style={textStyle}>
        Your upvote counts for the story and its submitter's karma, but it
        won't show your name, earn you curator karma or appear on your
        profile.
      </p>
    );
    actions = (
      <button style={primaryStyle} onClick={handleUpvote}>
        Upvote anonymously
      </button>
    );
  } else if (state === "proving") {
    title = "Upvoting anonymously";
    body = <Progress progress={progress} />;
  } else if (state === "done") {
    title = "Upvoted anonymously";
    body = <p style={textStyle}>Thanks! Nobody can tell it was you.</p>;
    actions = (
      <button style={secondaryStyle} onClick={onClose}>
        Close
      </button>
    );
  } else if (state === "error") {
    body = null;
  }

  const mobile = typeof window !== "undefined" && window.innerWidth < 480;
  const style = {
    overlay: { backgroundColor: "rgba(0, 0, 0, 0.5)", zIndex: 1000 },
    content: {
      fontSize: "15px",
      lineHeight: "1.325",
      fontFamily:
        "ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'",
      backgroundColor: "var(--bg-white)",
      border: "var(--border-subtle)",
      overflow: "hidden",
      borderRadius: "2px",
      outline: "none",
      padding: 0,
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
      ...(mobile
        ? {
            top: "auto",
            left: 0,
            right: 0,
            bottom: 0,
            transform: "none",
            maxWidth: "460px",
            minWidth: 0,
            margin: "0 auto",
            borderBottom: "none",
          }
        : {}),
    },
  };

  return (
    <Modal
      isOpen={true}
      contentLabel={title}
      shouldCloseOnOverlayClick={state !== "proving"}
      onRequestClose={() => state !== "proving" && onClose()}
      style={style}
      closeTimeoutMS={0}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "33px",
          borderBottom: "var(--border-thin)",
          padding: "0 0 0 12px",
          fontSize: "13px",
          color: "var(--text-secondary)",
          backgroundColor: "var(--bg-white)",
        }}
      >
        <span>Anonymous upvote</span>
        <button
          onClick={onClose}
          disabled={state === "proving"}
          aria-label="Close"
          style={{
            height: "100%",
            padding: "0 6px",
            background: "transparent",
            border: "none",
            cursor: state === "proving" ? "not-allowed" : "pointer",
            color: "var(--text-primary)",
          }}
        >
          <CloseIcon />
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", padding: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingBottom: "12px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              backgroundColor: "var(--color-badge-bg)",
              color: "var(--color-badge-icon)",
            }}
          >
            <MaskIcon />
          </div>
          <div style={{ fontSize: "18px", fontWeight: 500, color: "var(--text-primary)" }}>
            {title}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {body}
        </div>
      </div>
      {(actions || error) && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            paddingBottom: "12px",
          }}
        >
          {error && (
            <div role="alert" style={errorStyle}>
              {error}
            </div>
          )}
          {actions}
        </div>
      )}
    </Modal>
  );
}
