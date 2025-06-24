import { useState, useEffect } from 'react';

export default function AnalyticsConsent() {
  const [visible, setVisible] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 641);
  
  useEffect(() => {
    const checkConsentAndMiniApp = async () => {
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
    // Analytics are already enabled by default
  };

  const declineAnalytics = () => {
    localStorage.setItem('kiwi-analytics-consent', 'false');
    setVisible(false);
    
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
  };

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: isDesktop ? 0 : 'calc(50px + env(safe-area-inset-bottom, 0px))', // Positioned above bottom nav on mobile
      left: 0,
      right: 0,
      backgroundColor: 'var(--header-beige)',
      borderTop: '1px solid var(--button-primary-bg)',
      padding: '12px 15px',
      zIndex: 1000,
      boxShadow: '0 -2px 5px var(--shadow-color)'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: isDesktop ? 'row' : 'column',
        alignItems: isDesktop ? 'center' : 'flex-start',
        justifyContent: 'space-between',
        gap: isDesktop ? '0' : '10px'
      }}>
        <div>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-primary)' }}>
            We use analytics cookies to improve our site. You can opt out if you prefer.
            See our <a href="/privacy-policy" style={{ color: 'var(--link-color)' }}>Privacy Policy</a>.
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
            style={{
              backgroundColor: 'var(--bg-off-white)',
              color: 'var(--text-primary)',
              border: 'var(--border-thin)',
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--hover-bg)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-off-white)';
            }}
          >
            Opt Out
          </button>
          <button 
            onClick={acceptAnalytics}
            style={{
              backgroundColor: 'var(--button-primary-bg)',
              color: 'var(--button-primary-text)',
              border: 'var(--border-thin)',
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--button-hover-bg)';
              e.currentTarget.style.color = 'var(--button-hover-text)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--button-primary-bg)';
              e.currentTarget.style.color = 'var(--button-primary-text)';
            }}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
