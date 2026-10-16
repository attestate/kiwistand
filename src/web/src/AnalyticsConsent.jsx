import React, { useState, useEffect } from 'react';
import { isIOSApp } from './session.mjs';
import { disableAnalytics } from './analytics.mjs';

export default function AnalyticsConsent() {
  const [visible, setVisible] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 641);

  useEffect(() => {
    const checkConsentAndMiniApp = async () => {
      // Don't show analytics consent in iOS native app
      if (isIOSApp()) {
        return;
      }

      // Don't show analytics consent in anon mode
      const isAnonMode = localStorage.getItem('anon-mode') === 'true';
      if (isAnonMode) {
        return;
      }

      // Check if we're in a mini app context
      const isMiniApp = window.sdk ? await window.sdk.isInMiniApp() : false;

      // Check if analytics consent was already decided
      const analyticsConsent = localStorage.getItem('kiwi-analytics-consent');

      if (isMiniApp) {
        // Don't show analytics consent banner in mini app, but enable analytics by default
        enableAnalytics();
        return;
      }

      if (analyticsConsent === null) {
        // Analytics are enabled by default, but we still show the banner
        setVisible(true);
        enableAnalytics(); // Enable analytics by default
      } else if (analyticsConsent === 'false') {
        // User has explicitly opted out before, so don't enable analytics
      } else {
        // User has explicitly accepted
        enableAnalytics();
      }
    };

    checkConsentAndMiniApp().catch(console.error);
    
    // Add window resize listener to detect desktop/mobile
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 641);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const enableAnalytics = () => {
    // Send consent to Google Analytics
    if (window.gtag) {
      window.gtag('consent', 'update', {
        analytics_storage: 'granted'
      });
    }
    
    // Initialize PostHog if it exists
    if (window.posthog && typeof window.posthog.init === 'function') {
      window.posthog.init("phc_F3mfkyH5tKKSVxnMbJf0ALcPA98s92s3Jw8a7eqpBGw", {
        api_host: "https://eu.i.posthog.com",
        person_profiles: "identified_only",
      });
    }
  };

  const acceptAnalytics = () => {
    localStorage.setItem('kiwi-analytics-consent', 'true');
    setVisible(false);
    window.dispatchEvent(new Event('analyticsConsentChange'));
    // Analytics are already enabled by default
  };

  const declineAnalytics = () => {
    localStorage.setItem('kiwi-analytics-consent', 'false');
    setVisible(false);
    window.dispatchEvent(new Event('analyticsConsentChange'));
    
    // Disable analytics
    if (window.gtag) {
      window.gtag('consent', 'update', {
        analytics_storage: 'denied'
      });
    }
    
    // Disable PostHog
    if (window.posthog) {
      window.posthog.opt_out_capturing();
    }
    disableAnalytics();
  };

  if (!visible) return null;

  return (
    <div style={{
      // NOTE: A floating card like the redesign's tab bar; on phones it sits
      // above the tab bar (62px + 16px margin).
      position: 'fixed',
      bottom: isDesktop ? '16px' : 'calc(86px + env(safe-area-inset-bottom, 0px))', // Above the mobile tab bar
      left: '16px',
      right: '16px',
      maxWidth: isDesktop ? '720px' : 'none',
      margin: '0 auto',
      boxSizing: 'border-box',
      backgroundColor: 'var(--background-color0)',
      border: 'var(--border)',
      borderRadius: '8px',
      padding: isDesktop ? '14px 16px' : '14px 16px 16px 16px',
      zIndex: 1000,
      fontFamily: 'Inter, "Inter Fallback", -apple-system, BlinkMacSystemFont, sans-serif',
      boxShadow: '0 4px 20px rgba(54, 67, 32, 0.08)'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: isDesktop ? 'row' : 'column',
        alignItems: isDesktop ? 'center' : 'flex-start',
        justifyContent: 'space-between',
        gap: isDesktop ? '16px' : '12px'
      }}>
        <div>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-primary)' }}>
            We use analytics cookies to improve our site. You can opt out if you prefer.
            See our <a href="/privacy-policy">Privacy Policy</a>.
          </p>
        </div>
        <div style={{
          display: 'flex',
          gap: '10px',
          width: isDesktop ? 'auto' : '100%',
          justifyContent: isDesktop ? 'flex-end' : 'space-between'
        }}>
          <button
            onClick={declineAnalytics}
            className="analytics-consent-decline"
            style={{
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              border: 'var(--border)',
              height: '36px',
              padding: '0 14px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '14px',
              fontWeight: 500,
              borderRadius: '6px',
              flex: isDesktop ? 'none' : 1
            }}
          >
            Opt Out
          </button>
          <button
            onClick={acceptAnalytics}
            className="analytics-consent-accept"
            style={{
              backgroundColor: 'var(--button-primary-bg)',
              color: 'var(--button-primary-text)',
              border: '1px solid var(--button-primary-bg)',
              height: '36px',
              padding: '0 14px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '14px',
              fontWeight: 600,
              borderRadius: '6px',
              flex: isDesktop ? 'none' : 1
            }}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
