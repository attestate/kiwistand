import React, { useState, useEffect } from 'react';

const TestFlightQR = () => {
  const testflightUrl = 'https://testflight.apple.com/join/6jyvYECH';
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    const checkViewportWidth = () => {
      const viewportWidth = window.innerWidth;
      
      // Mobile breakpoint - never show on mobile
      if (viewportWidth <= 640) {
        setShouldShow(false);
        return;
      }

      // Calculate minimum required width for QR code display
      const qrCodeWidth = 200; // width of QR code container
      const rightMargin = 20; // right margin
      const minContentSpace = 400; // minimum space for main content
      
      // Get sidebar width based on breakpoints
      let sidebarWidth = 0;
      if (viewportWidth >= 641 && viewportWidth < 1200) {
        // Medium screens: sidebar takes 40% when open
        sidebarWidth = viewportWidth * 0.4;
      } else if (viewportWidth >= 1200) {
        // Large screens: sidebar takes 25% when open
        sidebarWidth = viewportWidth * 0.25;
      }
      
      // Calculate available space (accounting for sidebar when open)
      const availableSpace = viewportWidth - sidebarWidth;
      const requiredSpace = qrCodeWidth + rightMargin + minContentSpace;
      
      // Only show if there's enough space
      setShouldShow(availableSpace >= requiredSpace);
    };

    // Check on mount and resize
    checkViewportWidth();
    window.addEventListener('resize', checkViewportWidth);

    return () => window.removeEventListener('resize', checkViewportWidth);
  }, []);

  if (!shouldShow) {
    return null;
  }

  return (
    <div 
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 1000,
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        border: '1px solid #e0e0e0',
        padding: '16px',
        width: '200px',
      }}
    >
      <div style={{ 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px'
      }}>
        <span style={{ fontSize: '14px', fontWeight: 500 }}>Get Kiwi App</span>
        
        <img 
          src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(testflightUrl)}`}
          alt="TestFlight QR Code"
          width="150"
          height="150"
          style={{ borderRadius: '4px' }}
        />
        
        <p style={{ 
          fontSize: '12px', 
          color: '#666',
          textAlign: 'center',
          margin: 0,
          lineHeight: '1.4'
        }}>
          Scan with iPhone to join<br />TestFlight beta
        </p>
      </div>
    </div>
  );
};

export default TestFlightQR;