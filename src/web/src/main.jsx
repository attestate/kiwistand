import './polyfills';
import React from 'react'
import ReactDOM from 'react-dom/client'
import Navigation from './Navigation.jsx'
import SubmitButton from './SubmitButton.jsx'
import BuyButton from './BuyButton.jsx'
import Vote from './Vote.jsx'
import EnsName from './EnsName.jsx'
import { loadTheme } from "./theme.mjs";
import { showMessage } from "./message.mjs";

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

const buyButtonContainer = document.getElementById('buy-button');
if (buyButtonContainer) {
  ReactDOM.createRoot(buyButtonContainer).render(
    <React.StrictMode>
      <BuyButton />
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

