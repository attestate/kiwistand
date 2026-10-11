import React, { useEffect, useState } from "react";

import { readRpcSettings, writeRpcSettings } from "./rpc.mjs";

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

const statusText = (status, allowFallback) => {
  if (status.state === "connecting") return "Connecting to Tor…";
  if (status.state === "ready" && status.network?.anonymizes === false)
    return `Connected via ${status.network.label}`;
  if (status.state === "ready") return "Connected via Tor";
  if (status.state === "error")
    return allowFallback
      ? "Couldn't connect to Tor. Chain reads go direct until it works."
      : "Couldn't connect to Tor. Chain reads fail until it works.";
  return "";
};

const PrivateRpcSetting = () => {
  const [settings, setSettings] = useState(() => readRpcSettings());
  const status = useWorkerStatus(settings.privateRpc);

  const update = (patch) => setSettings(writeRpcSettings(patch));

  return (
    <div className="private-rpc-setting">
      <style>{`
        .sidebar-nav > .private-rpc-setting {
          flex-direction: column;
          align-items: stretch;
          gap: 8px;
          cursor: default;
        }
        .sidebar-nav > .private-rpc-setting:active {
          background-color: transparent;
        }
        .private-rpc-setting label.private-rpc-row {
          display: flex;
          align-items: center;
          gap: 16px;
          cursor: pointer;
        }
        .private-rpc-setting .private-rpc-title {
          flex: 1;
          font-size: 1.25rem;
        }
        .private-rpc-setting .private-rpc-switch {
          position: relative;
          width: 44px;
          height: 26px;
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
          border-radius: 13px;
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
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: white;
          box-shadow: 0 1px 2px rgba(0,0,0,0.3);
          transition: transform 0.15s;
        }
        .private-rpc-setting input:checked + .private-rpc-track {
          background-color: var(--accent-primary);
        }
        .private-rpc-setting input:checked + .private-rpc-track::after {
          transform: translateX(18px);
        }
        .private-rpc-setting input:focus-visible + .private-rpc-track {
          outline: 2px solid var(--text-primary);
          outline-offset: 2px;
        }
        .private-rpc-setting .private-rpc-details {
          margin-left: 44px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          font-size: 0.85rem;
          line-height: 1.35;
          color: var(--text-secondary);
        }
        .private-rpc-setting .private-rpc-details span {
          font-size: 0.85rem;
        }
        .private-rpc-setting .private-rpc-fallback {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          cursor: pointer;
        }
        .private-rpc-setting .private-rpc-fallback input {
          margin: 2px 0 0 0;
        }
        .private-rpc-setting .private-rpc-status-error {
          color: var(--color-alert);
        }
      `}</style>
      <label className="private-rpc-row">
        <ShieldSVG filled={settings.privateRpc} />
        <span className="private-rpc-title">Private RPC (slower)</span>
        <span className="private-rpc-switch">
          <input
            type="checkbox"
            role="switch"
            aria-label="Private RPC (slower)"
            checked={settings.privateRpc}
            onChange={(e) => update({ privateRpc: e.target.checked })}
          />
          <span className="private-rpc-track" />
        </span>
      </label>
      <div className="private-rpc-details">
        <span>
          {settings.privateRpc
            ? "Chain reads go through Tor (anon-rpc), so RPC providers can't tie them to your IP. Your wallet's transactions are unaffected."
            : "Send chain reads through Tor (anon-rpc) so RPC providers can't tie them to your IP."}
        </span>
        {settings.privateRpc && (
          <>
            {status.state !== "idle" && (
              <span
                className={
                  status.state === "error" ? "private-rpc-status-error" : ""
                }
                title={status.state === "error" ? status.message : undefined}
              >
                {statusText(status, settings.allowFallback)}
              </span>
            )}
            <label className="private-rpc-fallback">
              <input
                type="checkbox"
                checked={settings.allowFallback}
                onChange={(e) => update({ allowFallback: e.target.checked })}
              />
              <span>If Tor fails, read directly instead of showing an error</span>
            </label>
          </>
        )}
      </div>
    </div>
  );
};

export default PrivateRpcSetting;
