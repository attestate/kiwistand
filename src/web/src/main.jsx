import './polyfills';
import React from 'react'
import ReactDOM from 'react-dom/client'
import { getAccount } from '@wagmi/core'
import { WagmiConfig } from "wagmi";
import { Avatar, ConnectKitProvider } from "connectkit";

import {ConnectedProfile, ConnectedActivity, ConnectedConnectButton} from './Navigation.jsx'
import SubmitButton from './SubmitButton.jsx'
import Vote from './Vote.jsx'
import EnsName from './EnsName.jsx'
import Bell from './Bell.jsx'
import NFTPrice from './NFTPrice.jsx'
import PaidFeature from './PaidFeature.jsx'
import { loadTheme } from "./theme.mjs";
import { showMessage } from "./message.mjs";
import { fetchAllowList } from "./API.mjs";
import client from "./client.mjs";

loadTheme();

const profileLink = document.querySelector('nav-profile');
ReactDOM.createRoot(profileLink).render(
  <React.StrictMode>
    <ConnectedProfile />
  </React.StrictMode>,
)

const activityLink = document.querySelector('nav-activity');
ReactDOM.createRoot(activityLink).render(
  <React.StrictMode>
    <ConnectedActivity />
  </React.StrictMode>,
)

const connectLink = document.querySelector('nav-connect');
ReactDOM.createRoot(connectLink).render(
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

const activityBell = document.querySelector('.activity-link');
if (activityBell) {
  ReactDOM.createRoot(activityBell).render(
    <React.StrictMode>
      <Bell to="/activity">
        <i class="icon">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M18.9,11.2s0-8.7-6.9-8.7-6.9,8.7-6.9,8.7v3.9L2.5,17.5h19l-2.6-2.4Z"
              fill="none"
              stroke="#000000"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
            />

            <path
              d="M14.5,20.5s-.5,1-2.5,1-2.5-1-2.5-1"
              fill="none"
              stroke="#000000"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
            />
          </svg> </i>
      </Bell>
    </React.StrictMode>
  )
}


async function renderPaidFeature() {
  const allowList = await fetchAllowList();

  const shareButtons = document.querySelectorAll('paid-share');
  if (shareButtons && shareButtons.length > 0) {
    shareButtons.forEach(button => {
      const href = button.getAttribute("href");
      ReactDOM.createRoot(button).render(
        <React.StrictMode>
          <PaidFeature
            allowList={allowList}
            freeFeature={
              <>
                <span> | </span>
                <a
                  href="/welcome"
                >
                  Share
                </a>
              </>
            }
          >
            <>
              <span> | </span>
              <a
                target="_blank"
                href={href}
              >
                Share
              </a>
            </>
          </PaidFeature>
        </React.StrictMode>,
      )
    });
  }


}
renderPaidFeature();

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

const ensNameComponents = document.querySelectorAll("ens-name");
if (ensNameComponents) {
  for (let elem of ensNameComponents) {
    const address = elem.getAttribute("address");
    ReactDOM.createRoot(elem).render(
      <React.StrictMode>
        <EnsName address={address} />
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

