import React from 'react';

const TestFlightQR = () => {
  return (
    <div
      style={{
        backgroundColor: 'var(--bg-white)',
        borderRadius: '2px',
        border: 'var(--border)',
        padding: '16px',
      }}
    >
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px'
      }}>
        <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Get Kiwi App</span>

        <img
          src="/testflight-qr.png"
          alt="TestFlight QR Code"
          width="150"
          height="150"
          style={{ borderRadius: '4px' }}
        />

        <p style={{
          fontSize: '12px',
          color: 'var(--text-tertiary)',
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
