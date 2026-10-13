import React, { useEffect, useState } from "react";

import { readRpcSettings, writeRpcSettings } from "./rpc.mjs";

const ABOUT_URL = "https://ethereum.github.io/anon-rpc/";

const ShieldSVG = ({ filled }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
    <rect width="256" height="256" fill="none" />
    <path
      d="M216,112V56a8,8,0,0,0-8-8H48a8,8,0,0,0-8,8v56c0,96,88,120,88,120S216,208,216,112Z"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
    />
  </svg>
);

// NOTE: Only loads the anon-rpc harness when the setting is on; reading the
// status boots the worker (opt-in visitors only), which also warms it up for
// the first chain read.
const useWorkerStatus = (enabled) => {
  const [status, setStatus] = useState({ state: "idle" });
  useEffect(() => {
    if (!enabled) {
      setStatus({ state: "idle" });
      return;
    }
    let cancelled = false;
    setStatus({ state: "connecting" });
    import("./anon-transport.mjs")
      .then(async (m) => {
        const network = m.selectNetwork();
        await m.getWorker(network);
        if (!cancelled) setStatus({ state: "ready", network });
      })
      .catch((err) => {
        console.error("Private RPC:", err);
        if (!cancelled) setStatus({ state: "error", message: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return status;
};

// NOTE: One short line under the title, so the row stays the height of the
// other menu items. The fallback choice only shows up once Tor actually fails.
const subtitle = (enabled, status, allowFallback) => {
  if (!enabled) return "Read the chain via Tor";
  if (status.state === "connecting") return "Connecting to Tor…";
  if (status.state === "ready" && status.network?.anonymizes === false)
    return `On · via ${status.network.label}`;
  if (status.state === "ready") return "On · via Tor";
  if (status.state === "error")
    return allowFallback ? "Tor failed · reading directly" : "Tor failed";
  return "On";
};

const PrivateRpcSetting = ({ variant }) => {
  const [settings, setSettings] = useState(() => readRpcSettings());
  const status = useWorkerStatus(settings.privateRpc);

  const update = (patch) => setSettings(writeRpcSettings(patch));
  // NOTE: Turning it off also forgets "read directly", so the next time it's
  // on, a Tor failure is visible again.
  const toggle = (on) =>
    update(on ? { privateRpc: true } : { privateRpc: false, allowFallback: false });
  const failed = settings.privateRpc && status.state === "error";

  return (
    <div
      className={`private-rpc-setting${variant === "compact" ? " compact" : ""}`}
    >
      <style>{`
        .sidebar-nav > .private-rpc-setting {
          cursor: default;
        }
        .sidebar-nav > .private-rpc-setting:active {
          background-color: transparent;
        }
        .private-rpc-setting label.private-rpc-row {
          display: flex;
          align-items: center;
          gap: 16px;
          flex: 1;
          min-width: 0;
          cursor: pointer;
        }
        .private-rpc-setting .private-rpc-text {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-width: 0;
        }
        .private-rpc-setting .private-rpc-title {
          font-size: 1.25rem;
          line-height: 1.2;
        }
        .sidebar-nav .private-rpc-setting .private-rpc-sub,
        .private-rpc-setting.compact .private-rpc-sub {
          font-size: 0.8rem;
          line-height: 1.3;
          color: var(--text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sidebar-nav .private-rpc-setting .private-rpc-sub.error,
        .private-rpc-setting.compact .private-rpc-sub.error {
          color: var(--color-alert);
          white-space: normal;
        }
        .private-rpc-setting.compact label.private-rpc-row {
          gap: 10px;
        }
        .private-rpc-setting.compact svg {
          width: 20px;
          height: 20px;
          flex-shrink: 0;
        }
        .private-rpc-setting.compact .private-rpc-title {
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-primary);
        }
        .private-rpc-setting.compact svg {
          color: var(--text-primary);
        }
        .private-rpc-setting .private-rpc-direct {
          background: none;
          border: none;
          padding: 0;
          margin: 0;
          font: inherit;
          font-size: 0.8rem;
          color: var(--text-secondary);
          text-decoration: underline;
          cursor: pointer;
        }
        .private-rpc-setting .private-rpc-about {
          color: inherit;
          text-decoration: underline;
        }
        .private-rpc-setting .private-rpc-switch {
          position: relative;
          width: 36px;
          height: 20px;
          flex-shrink: 0;
        }
        .private-rpc-setting .private-rpc-switch input {
          position: absolute;
          opacity: 0;
          width: 100%;
          height: 100%;
          margin: 0;
          cursor: pointer;
        }
        .private-rpc-setting .private-rpc-track {
          position: absolute;
          inset: 0;
          border-radius: 10px;
          background-color: var(--button-bg);
          border: var(--border-subtle);
          transition: background-color 0.15s;
          pointer-events: none;
        }
        .private-rpc-setting .private-rpc-track::after {
          content: "";
          position: absolute;
          top: 2px;
          left: 2px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: white;
          box-shadow: 0 1px 2px rgba(0,0,0,0.3);
          transition: transform 0.15s;
        }
        .private-rpc-setting input:checked + .private-rpc-track {
          background-color: var(--accent-primary);
        }
        .private-rpc-setting input:checked + .private-rpc-track::after {
          transform: translateX(16px);
        }
        .private-rpc-setting input:focus-visible + .private-rpc-track {
          outline: 2px solid var(--text-primary);
          outline-offset: 2px;
        }
      `}</style>
      <label
        className="private-rpc-row"
        title="Chain reads go through Tor (anon-rpc) so RPC providers can't tie them to your IP. Slower. Wallet transactions are unaffected."
      >
        <ShieldSVG filled={settings.privateRpc} />
        <span className="private-rpc-text">
          <span className="private-rpc-title">anon-rpc</span>
          <span
            className={`private-rpc-sub${failed ? " error" : ""}`}
            title={failed ? status.message : undefined}
          >
            {subtitle(settings.privateRpc, status, settings.allowFallback)}
            {failed && !settings.allowFallback && (
              <>
                {" · "}
                <button
                  type="button"
                  className="private-rpc-direct"
                  onClick={(e) => {
                    e.preventDefault();
                    update({ allowFallback: true });
                  }}
                >
                  read directly
                </button>
              </>
            )}
            {/* NOTE: A link inside a <label> doesn't toggle the switch (it's
                interactive content), and stopPropagation keeps the row's
                handlers out of it too. */}
            {!failed && (
              <>
                {" · "}
                <a
                  className="private-rpc-about"
                  href={ABOUT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="What's anon-rpc? (opens in a new tab)"
                  onClick={(e) => e.stopPropagation()}
                >
                  about
                </a>
              </>
            )}
          </span>
        </span>
        <span className="private-rpc-switch">
          <input
            type="checkbox"
            role="switch"
            aria-label="anon-rpc"
            checked={settings.privateRpc}
            onChange={(e) => toggle(e.target.checked)}
          />
          <span className="private-rpc-track" />
        </span>
      </label>
    </div>
  );
};

export default PrivateRpcSetting;
