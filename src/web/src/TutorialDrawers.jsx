import { useState } from "react";
import SwipeableDrawer from "@mui/material/SwipeableDrawer";

const TutorialDrawers = () => {
  const [howToEarnOpen, setHowToEarnOpen] = useState(false);
  const [rewardTiersOpen, setRewardTiersOpen] = useState(false);

  const iOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);

  return (
    <>
      {/* Tutorial Boxes */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "20px" }}>
        {/* How to Earn Box */}
        <div 
          onClick={() => setHowToEarnOpen(true)}
          onMouseOver={(e) => e.target.style.backgroundColor = '#f5f5f5'}
          onMouseOut={(e) => e.target.style.backgroundColor = 'var(--table-bg)'}
          style={{
            backgroundColor: "var(--table-bg)",
            padding: "15px",
            border: "var(--border)",
            cursor: "pointer",
            transition: "background-color 0.2s",
            minHeight: "68px",
            display: "flex",
            alignItems: "center"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="20" height="20" style={{ marginRight: "10px", color: "#666" }}>
                <rect width="256" height="256" fill="none"/>
                <line x1="88" y1="232" x2="168" y2="232" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16"/>
                <path d="M78.7,167A79.87,79.87,0,0,1,48,104.45C47.76,61.09,82.72,25,126.07,24a80,80,0,0,1,51.34,142.9A24.3,24.3,0,0,0,168,186v6a8,8,0,0,1-8,8H96a8,8,0,0,1-8-8v-6A24.11,24.11,0,0,0,78.7,167Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16"/>
                <path d="M136,56c20,3.37,36.61,20,40,40" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16"/>
              </svg>
              <div>
                <h3 style={{ margin: "0 0 5px 0", fontSize: "16px", color: "black" }}>How to Earn</h3>
                <p style={{ margin: "0", color: "#666", fontSize: "13px" }}>Learn how karma works</p>
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: "#666" }}>
              <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        {/* Reward Tiers Box */}
        <div 
          onClick={() => setRewardTiersOpen(true)}
          onMouseOver={(e) => e.target.style.backgroundColor = '#f5f5f5'}
          onMouseOut={(e) => e.target.style.backgroundColor = 'var(--table-bg)'}
          style={{
            backgroundColor: "var(--table-bg)",
            padding: "15px",
            border: "var(--border)",
            cursor: "pointer",
            transition: "background-color 0.2s",
            minHeight: "68px",
            display: "flex",
            alignItems: "center"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="20" height="20" style={{ marginRight: "10px", color: "#666" }}>
                <rect width="256" height="256" fill="none"/>
                <line x1="96" y1="224" x2="160" y2="224" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16"/>
                <line x1="128" y1="184" x2="128" y2="224" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16"/>
                <path d="M58,128H48A32,32,0,0,1,16,96V80a8,8,0,0,1,8-8H56" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16"/>
                <path d="M198,128h10a32,32,0,0,0,32-32V80a8,8,0,0,0-8-8H200" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16"/>
                <path d="M56,48H200v63.1c0,39.7-31.75,72.6-71.45,72.9A72,72,0,0,1,56,112Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16"/>
              </svg>
              <div>
                <h3 style={{ margin: "0 0 5px 0", fontSize: "16px", color: "black" }}>Rewards Info</h3>
                <p style={{ margin: "0", color: "#666", fontSize: "13px" }}>100 USDC prize pool</p>
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: "#666" }}>
              <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </div>

      {/* How to Earn Drawer */}
      <SwipeableDrawer
        anchor="bottom"
        open={howToEarnOpen}
        onClose={() => setHowToEarnOpen(false)}
        onOpen={() => setHowToEarnOpen(true)}
        disableBackdropTransition={!iOS}
        disableDiscovery={iOS}
        PaperProps={{
          style: {
            borderTopLeftRadius: "8px",
            borderTopRightRadius: "8px",
            backgroundColor: "white",
            fontFamily: "var(--font-family)",
            maxHeight: "70vh",
            overflowY: "auto"
          },
        }}
      >
        <div style={{ padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
            <h2 style={{ margin: "0", fontSize: "18px", color: "black" }}>How to Earn</h2>
            <button 
              onClick={() => setHowToEarnOpen(false)} 
              style={{ background: "none", border: "none", fontSize: "24px", cursor: "pointer", color: "#666" }}
            >
              ×
            </button>
          </div>
          <div style={{ color: "#666", lineHeight: "1.6" }}>
            <p style={{ margin: "0 0 15px 0", fontSize: "16px", fontWeight: "500", color: "#333" }}>Earn karma by:</p>
            <ul style={{ margin: "0 0 20px 0", paddingLeft: "20px", fontSize: "15px" }}>
              <li style={{ marginBottom: "10px" }}>Getting upvotes on your story submissions</li>
              <li style={{ marginBottom: "10px" }}>Receiving emoji reactions on your comments</li>
            </ul>
            <p style={{ margin: "0", fontSize: "14px" }}>Rankings update weekly. The more engagement you receive, the higher your karma score!</p>
          </div>
        </div>
      </SwipeableDrawer>

      {/* Reward Tiers Drawer */}
      <SwipeableDrawer
        anchor="bottom"
        open={rewardTiersOpen}
        onClose={() => setRewardTiersOpen(false)}
        onOpen={() => setRewardTiersOpen(true)}
        disableBackdropTransition={!iOS}
        disableDiscovery={iOS}
        PaperProps={{
          style: {
            borderTopLeftRadius: "8px",
            borderTopRightRadius: "8px",
            backgroundColor: "white",
            fontFamily: "var(--font-family)",
            maxHeight: "70vh",
            overflowY: "auto"
          },
        }}
      >
        <div style={{ padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
            <h2 style={{ margin: "0", fontSize: "18px", color: "black" }}>Rewards Info</h2>
            <button 
              onClick={() => setRewardTiersOpen(false)} 
              style={{ background: "none", border: "none", fontSize: "24px", cursor: "pointer", color: "#666" }}
            >
              ×
            </button>
          </div>
          <div style={{ lineHeight: "1.6" }}>
            <div style={{ background: "#f5f5f5", padding: "20px", borderRadius: "6px", marginBottom: "20px", border: "1px solid #ddd" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", marginBottom: "16px" }}>
                <img src="/usdc-logo.svg" alt="USDC" style={{ width: "36px", height: "36px" }} />
                <div style={{ fontSize: "22px", fontWeight: "bold", color: "black" }}>100 USDC Weekly Prize Pool</div>
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginBottom: "20px" }}>
                <div style={{ textAlign: "center", padding: "12px 8px", background: "rgba(255, 215, 0, 0.1)", border: "1px solid #ffd700", borderRadius: "4px" }}>
                  <div style={{ fontSize: "11px", color: "#666", marginBottom: "4px" }}>1st Place</div>
                  <div style={{ fontSize: "20px", fontWeight: "700", color: "black" }}>50 USDC</div>
                </div>
                <div style={{ textAlign: "center", padding: "12px 8px", background: "rgba(192, 192, 192, 0.1)", border: "1px solid #c0c0c0", borderRadius: "4px" }}>
                  <div style={{ fontSize: "11px", color: "#666", marginBottom: "4px" }}>2nd Place</div>
                  <div style={{ fontSize: "20px", fontWeight: "700", color: "black" }}>30 USDC</div>
                </div>
                <div style={{ textAlign: "center", padding: "12px 8px", background: "rgba(205, 127, 50, 0.1)", border: "1px solid #cd7f32", borderRadius: "4px" }}>
                  <div style={{ fontSize: "11px", color: "#666", marginBottom: "4px" }}>3rd Place</div>
                  <div style={{ fontSize: "20px", fontWeight: "700", color: "black" }}>20 USDC</div>
                </div>
              </div>
            </div>
            
            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <p style={{ margin: "0 0 8px 0", fontSize: "16px", color: "#333", fontWeight: "500" }}>
                Top contributors earn weekly rewards
              </p>
              <p style={{ margin: "0", fontSize: "14px", color: "#666" }}>
                Competition ends July 7
              </p>
            </div>
          </div>
        </div>
      </SwipeableDrawer>
    </>
  );
};

export default TutorialDrawers;