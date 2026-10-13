import React, { Suspense, lazy, useEffect, useState } from "react";

import { getCookie, getLocalAccount, logout } from "./session.mjs";
import {
  TRACKING_CHANGE_EVENT,
  analyticsOffReason,
  readTrackingState,
  setAnalyticsConsent,
  trackingAllowed,
} from "./tracking.mjs";
import LoginButton from "./LoginButton.jsx";

const PrivateRpcSetting = lazy(() => import("./PrivateRpcSetting.jsx"));

const short = (address) => `${address.slice(0, 6)}…${address.slice(-4)}`;

const Section = ({ label, hint, children }) => (
  <section className="n2-set-section">
    <div className="n2-set-label">
      <span>{label}</span>
    </div>
    <div className="n2-set-group">{children}</div>
    {hint && <p className="n2-set-hint">{hint}</p>}
  </section>
);

// NOTE: The same choice as the cookie banner (AnalyticsConsent.jsx), see
// setAnalyticsConsent. Whether anything is tracked is decided by
// tracking.mjs, which also counts anon mode and anon-rpc, so the switch shows
// that answer and not just the stored consent. It follows the stored choices,
// also when anon-rpc is toggled on this page.
const useTrackingState = () => {
  const [state, setState] = useState(readTrackingState);
  useEffect(() => {
    const refresh = () => setState(readTrackingState());
    const events = [TRACKING_CHANGE_EVENT, "analyticsConsentChange", "storage"];
    events.forEach((e) => window.addEventListener(e, refresh));
    return () => events.forEach((e) => window.removeEventListener(e, refresh));
  }, []);
  return [state, () => setState(readTrackingState())];
};

const Switch = ({ label, checked, disabled, onChange }) => (
  <span className="n2-toggle">
    <input
      type="checkbox"
      role="switch"
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
    />
    <span className="n2-toggle-track" />
  </span>
);

// NOTE: The account and privacy sections of /settings (views/settings.mjs),
// which depend on this browser.
export default function Settings({ delegations, toast }) {
  const local = getLocalAccount();
  const identity = local?.identity || getCookie("identity");
  const [tracking, refreshTracking] = useTrackingState();
  const analyticsOff = analyticsOffReason(tracking);

  return (
    <>
      <Section label="Account">
        {identity ? (
          <>
            <div className="n2-set-row">
              <span>Logged in as</span>
              <a
                className="n2-set-value n2-mono"
                href={`/upvotes?address=${identity}`}
                title={identity}
              >
                {short(identity)}
              </a>
            </div>
            <button
              type="button"
              className="n2-set-row n2-set-danger"
              onClick={logout}
            >
              Log out
            </button>
          </>
        ) : (
          <LoginButton
            className="n2-set-row n2-set-action"
            delegations={delegations}
            toast={toast}
          >
            Log in
          </LoginButton>
        )}
      </Section>
      <Section
        label="Privacy"
        hint="Anonymous usage data (screens viewed, likes, comments) helps us improve Kiwi News. Once you’re logged in it’s linked to your address. No ads, no cross-app tracking."
      >
        <label
          className={`n2-set-row n2-set-analytics${analyticsOff ? " n2-set-disabled" : ""}`}
        >
          <span className="n2-set-text">
            <span>Share usage analytics</span>
            {analyticsOff && <span className="n2-set-note">{analyticsOff}</span>}
          </span>
          <Switch
            label="Share usage analytics"
            checked={trackingAllowed(tracking)}
            disabled={Boolean(analyticsOff)}
            onChange={(on) => {
              setAnalyticsConsent(on);
              refreshTracking();
            }}
          />
        </label>
      </Section>
      <Section
        label="anon-rpc"
        hint="Chain reads go through Tor so RPC providers can’t tie them to your IP. Slower. While it’s on, analytics and session recording are off too. Wallet transactions are unaffected."
      >
        <div className="n2-set-row n2-set-rpc">
          <Suspense fallback={<span>anon-rpc</span>}>
            <PrivateRpcSetting variant="settings" />
          </Suspense>
        </div>
      </Section>
    </>
  );
}
