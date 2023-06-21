import './polyfills';
import React from 'react'
import ReactDOM from 'react-dom/client'
import { getAccount, watchAccount } from '@wagmi/core'
import { WagmiConfig } from "wagmi";
import { Avatar, ConnectKitProvider } from "connectkit";

import {ConnectedProfile, ConnectedLearnMore, ConnectedDisconnectButton, ConnectedConnectButton} from './Navigation.jsx'
import SubmitButton from './SubmitButton.jsx'
import Vote from './Vote.jsx'
import Bell from './Bell.jsx'
import NFTPrice from './NFTPrice.jsx'
import { showMessage } from "./message.mjs";
import { fetchAllowList } from "./API.mjs";
import client from "./client.mjs";


async function updateLink(account) {
  const allowList = await fetchAllowList();
  const { address, isConnected } = account;

  const links = document.querySelectorAll('[data-premium], [data-free]');
  links.forEach((link) => {
    const premiumLink = link.getAttribute('data-premium');
    const freeLink = link.getAttribute('data-free');
    const targetLink = (isConnected && allowList.includes(address)) ? premiumLink : freeLink;

    link.setAttribute('href', targetLink);
  });
}

const unwatch = watchAccount(updateLink);

function handleClick(event) {
  const sidebar = document.querySelector('.sidebar');
  const isClickOutside = !sidebar.contains(event.target);
  const isSidebarOpen = sidebar.style.left === "0" || sidebar.style.left === "0px";
  const isSidebarToggle = event.target.closest(".sidebar-toggle") !== null;

  if (isSidebarToggle || (isClickOutside && isSidebarOpen)) {
    toggleSidebar();
  }
}

function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const isSidebarOpen = sidebar.style.left === "0" || sidebar.style.left === "0px";
  var sidebarWidth;

  if (window.innerWidth >= 1200) {
    sidebarWidth = isSidebarOpen ? '-15%' : '0';
  } else if (window.innerWidth >= 768 && window.innerWidth < 1200) {
    sidebarWidth = isSidebarOpen ? '-20%' : '0';
  } else {
    sidebarWidth = isSidebarOpen ? '-50%' : '0';
  }

  document.querySelector('.sidebar').style.left = sidebarWidth;
}

document.addEventListener("click", handleClick);

const profileLink = document.querySelector('nav-profile');
ReactDOM.createRoot(profileLink).render(
  <React.StrictMode>
    <ConnectedProfile />
  </React.StrictMode>,
)
const learnMore = document.querySelector('nav-learn-more');
if (learnMore) {
  ReactDOM.createRoot(learnMore).render(
    <React.StrictMode>
      <ConnectedLearnMore />
    </React.StrictMode>,
  )
}
const disconnect = document.querySelector('nav-disconnect');
ReactDOM.createRoot(disconnect).render(
  <React.StrictMode>
    <ConnectedDisconnectButton />
  </React.StrictMode>,
)

const connectButton = document.querySelector('#connectButton');
connectButton.style="";
ReactDOM.createRoot(connectButton).render(
  <React.StrictMode>
    <ConnectedConnectButton />
  </React.StrictMode>,
)

const submitButtonContainer = document.getElementById('submit-button');
if (submitButtonContainer) {
  ReactDOM.createRoot(submitButtonContainer).render(
    <React.StrictMode>
      <SubmitButton />
    </React.StrictMode>
  )
}

const voteArrows = document.querySelectorAll('.votearrowcontainer');
if (voteArrows && voteArrows.length > 0) {
  voteArrows.forEach(arrow => {
    const title = arrow.getAttribute("data-title");
    const href = arrow.getAttribute("data-href");
    ReactDOM.createRoot(arrow).render(
      <React.StrictMode>
        <Vote title={title} href={href} />
      </React.StrictMode>,
    )
  });
}

const nftPriceElements = document.querySelectorAll('nft-price');

if (nftPriceElements && nftPriceElements.length > 0) {
  nftPriceElements.forEach(element => {
    ReactDOM.createRoot(element).render(
      <React.StrictMode>
        <NFTPrice />
      </React.StrictMode>,
    )
  });
}

const avatars = document.querySelectorAll("ens-avatar");
if (avatars) {
  for (let elem of avatars) {
    const address = elem.getAttribute("address");
    const isLeaderboard = elem.hasAttribute("leaderboard");
    const size = isLeaderboard ? 35 : 15;
    ReactDOM.createRoot(elem).render(
      <React.StrictMode>
        <WagmiConfig client={client}>
          <ConnectKitProvider>
            <Avatar name={address} size={size} radius={0} />
          </ConnectKitProvider>
        </WagmiConfig>
      </React.StrictMode>,
    );
  }
}

let url = new URL(window.location.href);
let messageParam = url.searchParams.get('message');

if (messageParam) {
  showMessage(messageParam);
  url.searchParams.delete('message');
  window.history.replaceState({}, '', url.href);
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    await navigator.serviceWorker.register('/serviceWorker.js')
  });
}

