import "./polyfills";
import "@rainbow-me/rainbowkit/styles.css";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  getAccount,
  watchAccount,
  fetchEnsAvatar,
  fetchEnsName,
} from "@wagmi/core";
import { WagmiConfig } from "wagmi";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";

import {
  ConnectedProfile,
  ConnectedLearnMore,
  ConnectedDisconnectButton,
  ConnectedConnectButton,
  ConnectedSettings,
} from "./Navigation.jsx";
import SubmitButton from "./SubmitButton.jsx";
import DelegateButton from "./DelegateButton.jsx";
import Vote from "./Vote.jsx";
import Bell from "./Bell.jsx";
import NFTPrice from "./NFTPrice.jsx";
import OnboardingModal from "./OnboardingModal.jsx";
import { showMessage } from "./message.mjs";
import { fetchAllowList } from "./API.mjs";
import { client, chains } from "./client.mjs";

async function updateLink(account) {
  const allowList = await fetchAllowList();
  const { address, isConnected } = account;

  const links = document.querySelectorAll("[data-premium], [data-free]");
  links.forEach((link) => {
    const premiumLink = link.getAttribute("data-premium");
    const freeLink = link.getAttribute("data-free");
    const targetLink =
      isConnected && allowList.includes(address) ? premiumLink : freeLink;

    link.setAttribute("href", targetLink);
  });
}

const unwatch = watchAccount(updateLink);

function handleClick(event) {
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.querySelector("#overlay");
  const isClickOutside = !sidebar.contains(event.target);
  const isSidebarOpen =
    sidebar.style.left === "0" || sidebar.style.left === "0px";
  const isSidebarToggle = event.target.closest(".sidebar-toggle") !== null;
  const isClickOnOverlay = event.target === overlay;

  if (
    isSidebarToggle ||
    (isClickOutside && isSidebarOpen) ||
    isClickOnOverlay
  ) {
    toggleSidebar();
  }
}

function toggleSidebar() {
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.querySelector("#overlay");
  const isSidebarOpen =
    sidebar.style.left === "0" || sidebar.style.left === "0px";
  var sidebarWidth;

  if (window.innerWidth >= 1200) {
    sidebarWidth = isSidebarOpen ? "-25%" : "0";
  } else if (window.innerWidth >= 768 && window.innerWidth < 1200) {
    sidebarWidth = isSidebarOpen ? "-30%" : "0";
  } else {
    sidebarWidth = isSidebarOpen ? "-75%" : "0";
  }

  sidebar.style.left = sidebarWidth;

  // If the sidebar is open, show the overlay, else hide it
  overlay.style.display = isSidebarOpen ? "none" : "block";
}

document.addEventListener("click", handleClick);

const delegateButtonContainer = document.querySelector("delegate-button");
if (delegateButtonContainer) {
  createRoot(delegateButtonContainer).render(
    <StrictMode>
      <DelegateButton />
    </StrictMode>
  );
}

const settings = document.querySelector("nav-settings");
createRoot(settings).render(
  <StrictMode>
    <ConnectedSettings />
  </StrictMode>
);
const profileLink = document.querySelector("nav-profile");
createRoot(profileLink).render(
  <StrictMode>
    <ConnectedProfile />
  </StrictMode>
);
const learnMore = document.querySelector("nav-learn-more");
if (learnMore) {
  createRoot(learnMore).render(
    <StrictMode>
      <ConnectedLearnMore />
    </StrictMode>
  );
}
const disconnect = document.querySelector("nav-disconnect");
createRoot(disconnect).render(
  <StrictMode>
    <ConnectedDisconnectButton />
  </StrictMode>
);
const onboarding = document.querySelector("nav-onboarding-modal");
if (onboarding) {
  createRoot(onboarding).render(
    <StrictMode>
      <OnboardingModal />
    </StrictMode>
  );
}

const nftmodal = document.querySelector("nav-nft-modal");
if (nftmodal) {
  createRoot(nftmodal).render(
    <StrictMode>
      <NFTModal />
    </StrictMode>
  );
}

const connectButton = document.querySelector("#connectButton");
connectButton.style = "";
createRoot(connectButton).render(
  <StrictMode>
    <ConnectedConnectButton />
  </StrictMode>
);

const submitButtonContainer = document.getElementById("submit-button");
if (submitButtonContainer) {
  createRoot(submitButtonContainer).render(
    <StrictMode>
      <SubmitButton />
    </StrictMode>
  );
}

const voteArrows = document.querySelectorAll(".votearrowcontainer");
if (voteArrows && voteArrows.length > 0) {
  voteArrows.forEach((arrow) => {
    const title = arrow.getAttribute("data-title");
    const href = arrow.getAttribute("data-href");
    createRoot(arrow).render(
      <StrictMode>
        <Vote title={title} href={href} />
      </StrictMode>
    );
  });
}

const nftPriceElements = document.querySelectorAll("nft-price");

if (nftPriceElements && nftPriceElements.length > 0) {
  nftPriceElements.forEach((element) => {
    createRoot(element).render(
      <StrictMode>
        <NFTPrice />
      </StrictMode>
    );
  });
}

let url = new URL(window.location.href);
let messageParam = url.searchParams.get("message");

if (messageParam) {
  showMessage(messageParam);
  url.searchParams.delete("message");
  window.history.replaceState({}, "", url.href);
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    await navigator.serviceWorker.register("/serviceWorker.js");
  });
}
