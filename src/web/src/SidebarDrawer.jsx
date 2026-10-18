import React, { useState, useEffect, Suspense, lazy } from "react";
import SwipeableDrawer from "@mui/material/SwipeableDrawer";
import { ConnectedProfile, ConnectedDisconnectButton } from "./Navigation.jsx";
import { getCookie } from "./session.mjs";
import MS from "./ms.jsx";

// NOTE: Rendered only while the drawer is open (the drawer itself is mounted
// on every page), so these chunks load on first open, not with the page.
const LoginModal = lazy(() => import("./LoginModal.jsx"));

const iOS =
  typeof navigator !== "undefined" &&
  /iPad|iPhone|iPod/.test(navigator.userAgent);

const phoneQuery = "(max-width: 640px)";

const Item = ({ href, icon, label, active, external, onClick }) => (
  <a
    href={href}
    className={`kn-menu-item${active ? " kn-menu-item-active" : ""}`}
    aria-current={active ? "page" : undefined}
    target={external ? "_blank" : undefined}
    rel={external ? "noopener noreferrer" : undefined}
    onClick={onClick}
  >
    <MS name={icon} size={22} />
    <span>{label}</span>
  </a>
);

// The NEU 2 menu (iOS "Menu" frames): a bottom sheet on phones, a panel from
// the right on wider screens. Home, Profile, Saved stories, Settings; then
// Guidelines, Privacy Policy, Wiki; then Log out (or Log in). The anon-rpc
// switch lives only on /settings (Settings is the first group's last item).
const SidebarDrawer = ({ delegations, toast }) => {
  const [open, setOpen] = useState(false);
  const [login, setLogin] = useState(false);
  const [isPhone, setIsPhone] = useState(
    () => window.matchMedia(phoneQuery).matches,
  );
  const path = window.location.pathname;

  useEffect(() => {
    window.openSidebar = () => setOpen(true);
    window.closeSidebar = () => setOpen(false);
    const media = window.matchMedia(phoneQuery);
    const onChange = () => setIsPhone(media.matches);
    media.addEventListener?.("change", onChange);
    return () => {
      delete window.openSidebar;
      delete window.closeSidebar;
      media.removeEventListener?.("change", onChange);
    };
  }, []);

  const isHome =
    path === "/" || path === "/new" || path === "/best" || path === "/stories";
  const loggedIn = Boolean(getCookie("identity"));
  const close = () => setOpen(false);

  return (
    <>
      <SwipeableDrawer
        anchor={isPhone ? "bottom" : "right"}
        open={open}
        onOpen={() => setOpen(true)}
        onClose={close}
        disableBackdropTransition={!iOS}
        disableDiscovery={iOS}
        disableSwipeToOpen={isPhone}
        SwipeAreaProps={{ sx: { width: isPhone ? 0 : 20 } }}
        PaperProps={{
          className: `kn-menu-paper${isPhone ? " kn-menu-sheet" : ""}`,
        }}
      >
        <nav className="kn-menu sidebar-nav" aria-label="Menu">
          {isPhone && <span className="kn-menu-grabber" aria-hidden="true" />}
          <div className="kn-menu-group">
            <Item
              href="/"
              icon="house"
              label="Home"
              active={isHome}
              onClick={close}
            />
            <ConnectedProfile toast={toast} delegations={delegations} />
            {loggedIn && (
              <Item
                href="/saved"
                icon="bookmark-simple"
                label="Saved stories"
                active={path === "/saved"}
                onClick={close}
              />
            )}
            <Item
              href="/settings"
              icon="gear-six"
              label="Settings"
              active={path === "/settings"}
              onClick={close}
            />
          </div>
          <div className="kn-menu-group">
            <Item
              href="/guidelines"
              icon="book-open"
              label="Guidelines"
              active={path === "/guidelines"}
              onClick={close}
            />
            <Item
              href="/privacy-policy"
              icon="lock-simple"
              label="Privacy Policy"
              active={path === "/privacy-policy"}
              onClick={close}
            />
            <Item
              href="https://kiwistand.github.io/kiwi-docs/"
              icon="book"
              label="Wiki"
              external
              onClick={close}
            />
          </div>
          <div className="kn-menu-group kn-menu-account">
            {loggedIn ? (
              <ConnectedDisconnectButton toast={toast} />
            ) : (
              <button
                type="button"
                className="kn-menu-item"
                onClick={() => {
                  close();
                  setLogin(true);
                }}
              >
                <MS name="user-circle" size={22} />
                <span>Log in</span>
              </button>
            )}
          </div>
        </nav>
      </SwipeableDrawer>
      {login && (
        <Suspense fallback={null}>
          <LoginModal
            defaultOpen={true}
            delegations={delegations}
            toast={toast}
            onClose={() => setLogin(false)}
          />
        </Suspense>
      )}
    </>
  );
};

export default SidebarDrawer;
