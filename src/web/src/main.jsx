import './polyfills';
import React from 'react'
import ReactDOM from 'react-dom/client'
import { getAccount } from '@wagmi/core'
import { WagmiConfig } from "wagmi";
import { Avatar, ConnectKitProvider } from "connectkit";

import Navigation from './Navigation.jsx'
import SubmitButton from './SubmitButton.jsx'
import Vote from './Vote.jsx'
import EnsName from './EnsName.jsx'
import Bell from './Bell.jsx'
import NFTPrice from './NFTPrice.jsx'
import PaidFeature from './PaidFeature.jsx'
import { loadTheme } from "./theme.mjs";
import { showMessage } from "./message.mjs";
import client from "./client.mjs";

loadTheme();

const navigation = document.getElementById('navigation');
ReactDOM.createRoot(navigation).render(
  <React.StrictMode>
    <Navigation />
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
  const response = await fetch('/api/v1/allowlist');
  const data = await response.json();
  const allowList = data.data;

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
                  Share on Warpcast [paid]
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
                Share on Warpcast
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
    ReactDOM.createRoot(elem).render(
      <React.StrictMode>
        <WagmiConfig client={client}>
          <ConnectKitProvider>
            <Avatar name={address} size={15} radius={0} />
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

const processLink = async (link) => {
  let url = new URL(link.href);
  if(url.hostname !== 'app.spinamp.xyz' || !url.pathname.startsWith('/track/')) return;
  
  const trackSlug = url.pathname.split('/').pop();
  
  const response = await fetch('https://spindex-api.spinamp.xyz/v1/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        query {
          allProcessedTracks(filter: {slug: {equalTo: "${trackSlug}"}}) {
            edges {
              node {
                title
                artistByArtistId {
                  name
                }
                lossyAudioIpfsHash
              }
            }
          }
        }`
    }),
  });
  
  const data = await response.json();
  const trackData = data.data.allProcessedTracks.edges[0].node;
  
  const player = document.createElement('span');
  player.style.background = '#ecdcca';
  player.style.border = 'solid 1px #1f4a4f';
  player.style.padding = '2px 5px';
  player.style.borderRadius = '5px';
  player.style.display = 'inline-block';
  player.style.marginLeft = '10px';
  
  const playButton = document.createElement('span');
  const timeMarker = document.createElement('span');
  timeMarker.textContent = '...'; // temporary placeholder
  
  const audioElement = document.createElement('audio');
  audioElement.src = `https://media.spinamp.xyz/v1/${trackData.lossyAudioIpfsHash}?resource_type=video`;
  audioElement.style.display = 'none';
  
  playButton.textContent = '▶'; // unicode play symbol
  playButton.style.cursor = 'pointer';
  playButton.style.marginRight = '10px';
  playButton.onclick = () => {
    if(audioElement.paused) {
      audioElement.play();
      playButton.textContent = '⏸'; // unicode pause symbol
    } else {
      audioElement.pause();
      playButton.textContent = '▶'; // unicode play symbol
    }
  };
  
  audioElement.onloadedmetadata = () => {
    const totalMinutes = Math.floor(audioElement.duration / 60);
    const totalSeconds = Math.floor(audioElement.duration % 60);
    timeMarker.textContent = `${totalMinutes}:${totalSeconds < 10 ? '0' + totalSeconds : totalSeconds}`;
  };

  audioElement.ontimeupdate = () => {
    const remainingSeconds = audioElement.duration - audioElement.currentTime;
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = Math.floor(remainingSeconds % 60);
    timeMarker.textContent = `${minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
  };

  player.appendChild(playButton);
  player.appendChild(timeMarker);
  player.appendChild(audioElement);
  
  link.parentNode.insertBefore(player, link.nextSibling);
};

document.querySelectorAll('a').forEach(processLink);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    await navigator.serviceWorker.register('/serviceWorker.js')
  });
}

