import React, { useState, useEffect } from "react";
import SwipeableDrawer from "@mui/material/SwipeableDrawer";
import { ConnectedProfile, ConnectedDisconnectButton } from "./Navigation.jsx";

const HomeSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
    <rect width="256" height="256" fill="none" />
    <path
      d="M152,208V160a8,8,0,0,0-8-8H112a8,8,0,0,0-8,8v48a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V115.54a8,8,0,0,1,2.62-5.92l80-75.54a8,8,0,0,1,10.77,0l80,75.54a8,8,0,0,1,2.62,5.92V208a8,8,0,0,1-8,8H160A8,8,0,0,1,152,208Z"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
    />
  </svg>
);

const HomeFullSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
    <rect width="256" height="256" fill="none" />
    <path
      d="M224,115.55V208a16,16,0,0,1-16,16H168a16,16,0,0,1-16-16V168a8,8,0,0,0-8-8H112a8,8,0,0,0-8,8v40a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V115.55a16,16,0,0,1,5.17-11.78l80-75.48.11-.11a16,16,0,0,1,21.53,0,1.14,1.14,0,0,0,.11.11l80,75.48A16,16,0,0,1,224,115.55Z"
      fill="currentColor"
    />
  </svg>
);

const AboutSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
    <rect width="256" height="256" fill="none" />
    <path
      d="M48,216a24,24,0,0,1,24-24H208V32H72A24,24,0,0,0,48,56Z"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
    />
    <polyline
      points="48 216 48 224 192 224"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
    />
  </svg>
);

const AboutFullSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
    <rect width="256" height="256" fill="none" />
    <path
      d="M216,32V192a8,8,0,0,1-8,8H72a16,16,0,0,0-16,16H192a8,8,0,0,1,0,16H48a8,8,0,0,1-8-8V56A32,32,0,0,1,72,24H208A8,8,0,0,1,216,32Z"
      fill="currentColor"
    />
  </svg>
);

const iOS =
  typeof navigator !== "undefined" &&
  /iPad|iPhone|iPod/.test(navigator.userAgent);

const SidebarDrawer = ({ delegations, toast }) => {
  const [open, setOpen] = useState(false);
  const path = window.location.pathname;

  useEffect(() => {
    window.openSidebar = () => setOpen(true);
    window.closeSidebar = () => setOpen(false);
    return () => {
      delete window.openSidebar;
      delete window.closeSidebar;
    };
  }, []);

  const isHome =
    path === "/" || path === "/new" || path === "/best" || path === "/stories";

  return (
    <SwipeableDrawer
      anchor="left"
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      disableBackdropTransition={!iOS}
      disableDiscovery={iOS}
      SwipeAreaProps={{ sx: { width: 20 } }}
      PaperProps={{
        sx: {
          width: "80%",
          maxWidth: 300,
          backgroundColor: "var(--header-beige)",
          color: "var(--text-primary)",
          paddingTop: "env(safe-area-inset-top, 0px)",
        },
      }}
    >
      <style>{`
        .sidebar-nav {
          display: flex;
          flex-direction: column;
          padding: 48px 16px 24px 0;
        }
        .sidebar-nav > a,
        .sidebar-nav > div {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 14px 24px;
          color: var(--text-primary);
          text-decoration: none;
          font-size: 1.25rem;
          cursor: pointer;
          border-radius: 0 32px 32px 0;
          transition: background-color 0.15s;
        }
        .sidebar-nav > a:active,
        .sidebar-nav > div:active {
          background-color: var(--button-bg);
        }
        .sidebar-nav .sidebar-div {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 14px 24px;
          font-size: 1.25rem;
          cursor: pointer;
          border-radius: 0 32px 32px 0;
          color: var(--text-primary);
          margin: 0;
          min-width: unset;
          font-variant: normal;
          transition: background-color 0.15s;
        }
        .sidebar-nav .sidebar-div:active {
          background-color: var(--button-bg);
        }
        .sidebar-nav svg {
          width: 28px;
          height: 28px;
          flex-shrink: 0;
          color: var(--text-primary);
        }
        .sidebar-nav .svg-container {
          width: 28px;
          height: 28px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .sidebar-nav a > div,
        .sidebar-nav .sidebar-div > div {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .sidebar-nav span {
          font-size: 1.25rem;
        }
        .sidebar-nav .active-nav {
          font-weight: bold;
          background-color: var(--button-bg);
        }
      `}</style>

      <div className="sidebar-nav">
        <a
          href="/"
          className={isHome ? "active-nav" : ""}
          onClick={() => setOpen(false)}
        >
          {isHome ? <HomeFullSVG /> : <HomeSVG />}
          <span>Home</span>
        </a>

        <ConnectedProfile toast={toast} delegations={delegations} />

        <a
          href="https://kiwistand.github.io/kiwi-docs/"
          target="_blank"
          rel="noopener noreferrer"
          className={path === "/welcome" ? "active-nav" : ""}
          onClick={() => setOpen(false)}
        >
          {path === "/welcome" ? <AboutFullSVG /> : <AboutSVG />}
          <span>Wiki</span>
        </a>

        <ConnectedDisconnectButton toast={toast} />
      </div>
    </SwipeableDrawer>
  );
};

export default SidebarDrawer;
