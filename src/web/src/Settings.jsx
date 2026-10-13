import React, { Suspense, lazy, useState } from "react";

import { getCookie, getLocalAccount, logout } from "./session.mjs";
import { disableAnalytics } from "./analytics.mjs";
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

// NOTE: The same choice as the cookie banner (AnalyticsConsent.jsx): it
// stores "kiwi-analytics-consent", which main.jsx reads on every page load
// before it starts Google Analytics and PostHog. Opting out also stops them
// on this page, like the banner's "Opt Out".
const readAnalytics = () => {
  try {
    return localStorage.getItem("kiwi-analytics-consent") !== "false";
  } catch (err) {
    return true;
  }
};

function setAnalytics(on) {
  localStorage.setItem("kiwi-analytics-consent", on ? "true" : "false");
  window.dispatchEvent(new Event("analyticsConsentChange"));
  if (window.gtag) {
    window.gtag("consent", "update", {
      analytics_storage: on ? "granted" : "denied",
    });
  }
  if (on) {
    window.posthog?.opt_in_capturing?.();
  } else {
    window.posthog?.opt_out_capturing?.();
    disableAnalytics();
  }
}

const Switch = ({ label, checked, onChange }) => (
  <span className="n2-toggle">
    <input
      type="checkbox"
      role="switch"
      aria-label={label}
      checked={checked}
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
  const [analytics, setAnalyticsState] = useState(readAnalytics);

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
        <label className="n2-set-row">
          <span>Share usage analytics</span>
          <Switch
            label="Share usage analytics"
            checked={analytics}
            onChange={(on) => {
              setAnalyticsState(on);
              setAnalytics(on);
            }}
          />
        </label>
      </Section>
      <Section
        label="anon-rpc"
        hint="Chain reads go through Tor so RPC providers can’t tie them to your IP. Slower. Wallet transactions are unaffected."
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
