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
  };

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: isDesktop ? 0 : 'calc(50px + env(safe-area-inset-bottom, 0px))', // Positioned above bottom nav on mobile
      left: 0,
      right: 0,
      backgroundColor: '#f6f6ef',
      borderTop: '1px solid #ff6600',
      padding: '12px 15px',
      zIndex: 1000,
      boxShadow: '0 -2px 5px rgba(0, 0, 0, 0.05)'
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
          <p style={{ margin: 0, fontSize: '14px' }}>
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
            style={{
              backgroundColor: 'white',
              color: 'black',
              border: '1px solid #c6c6c6',
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#f0f0f0';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'white';
            }}
          >
            Opt Out
          </button>
          <button 
            onClick={acceptAnalytics}
            style={{
              backgroundColor: 'black',
              color: 'white',
              border: '1px solid #c6c6c6',
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'white';
              e.currentTarget.style.color = 'black';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'black';
              e.currentTarget.style.color = 'white';
            }}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
