import React from 'react';

const TestFlightQR = () => {
  const testflightUrl = 'https://testflight.apple.com/join/6jyvYECH';

  // Check if mobile - hide on mobile views
  if (window.innerWidth <= 640) {
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