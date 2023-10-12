import "vite/modulepreload-polyfill";
import "@rainbow-me/rainbowkit/styles.css";
import { watchAccount } from "@wagmi/core";

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

async function addSubmitButton(allowlist, delegations, toast) {
  const submitButtonContainer = document.getElementById("submit-button");
  if (submitButtonContainer) {
    const { createRoot } = await import("react-dom/client");
    const { StrictMode } = await import("react");
    const SubmitButton = (await import("./SubmitButton.jsx")).default;
    createRoot(submitButtonContainer).render(
      <StrictMode>
        <SubmitButton
          toast={toast}
          allowlist={allowlist}
          delegations={delegations}
        />
      </StrictMode>,
    );
  }
}

async function addVotes(allowlistPromise, delegationsPromise, toast) {
  const voteArrows = document.querySelectorAll(".votearrowcontainer");
  if (voteArrows && voteArrows.length > 0) {
    const { createRoot } = await import("react-dom/client");
    const { StrictMode } = await import("react");
    const Vote = (await import("./Vote.jsx")).default;

    voteArrows.forEach((arrow) => {
      const title = arrow.getAttribute("data-title");
      const href = arrow.getAttribute("data-href");
      const editorPicks = arrow.getAttribute("data-editorpicks");
      let upvoters;
      try {
        upvoters = JSON.parse(arrow.getAttribute("data-upvoters"));
      } catch (err) {
        console.log("Couldn't parse upvoters", err);
      }
      createRoot(arrow).render(
        <StrictMode>
          <Vote
            title={title}
            href={href}
            allowlistPromise={allowlistPromise}
            delegationsPromise={delegationsPromise}
            upvoters={upvoters}
            toast={toast}
            editorPicks={editorPicks}
          />
        </StrictMode>,
      );
    });
  }
}

async function addBuyButton(allowlistPromise, delegationsPromise, toast) {
  const buyButtonContainer = document.querySelector("#buy-button-container");
  if (buyButtonContainer) {
    const allowlist = await allowlistPromise;
    const delegations = await delegationsPromise;
    const { createRoot } = await import("react-dom/client");
    const { StrictMode } = await import("react");
    const BuyButton = (await import("./BuyButton.jsx")).default;
    createRoot(buyButtonContainer).render(
      <StrictMode>
        <BuyButton
          allowlist={allowlist}
          delegations={delegations}
          toast={toast}
        />
      </StrictMode>,
    );
  }
}

async function addDelegateButton(allowlist, delegations) {
  const delegateButtonContainer = document.querySelector("delegate-button");
  if (delegateButtonContainer) {
    const { createRoot } = await import("react-dom/client");
    const { StrictMode } = await import("react");
    const DelegateButton = (await import("./DelegateButton.jsx")).default;
    createRoot(delegateButtonContainer).render(
      <StrictMode>
        <DelegateButton allowlist={allowlist} delegations={delegations} />
      </StrictMode>,
    );
  }
}

async function addConnectedComponents(allowlist, delegations) {
  const { createRoot } = await import("react-dom/client");
  const { StrictMode } = await import("react");
  const {
    ConnectedSettings,
    ConnectedProfile,
    ConnectedLearnMore,
    ConnectedDisconnectButton,
    ConnectedConnectButton,
    RefreshButton,
    ConnectedBuyAdvert,
  } = await import("./Navigation.jsx");
  const Bell = (await import("./Bell.jsx")).default;

  const connectButton = document.querySelector("#connectButton");
  connectButton.style = "";
  createRoot(connectButton).render(
    <StrictMode>
      <ConnectedBuyAdvert allowlist={allowlist} delegations={delegations} />
      <Bell allowlist={allowlist} delegations={delegations} />
      <ConnectedConnectButton allowlist={allowlist} delegations={delegations} />
    </StrictMode>,
  );

  const settings = document.querySelector("#nav-settings");
  createRoot(settings).render(
    <StrictMode>
      <ConnectedSettings allowlist={allowlist} delegations={delegations} />
    </StrictMode>,
  );
  const profileLink = document.querySelector("#nav-profile");
  createRoot(profileLink).render(
    <StrictMode>
      <ConnectedProfile allowlist={allowlist} delegations={delegations} />
    </StrictMode>,
  );
  const refreshButton = document.querySelector("a.nav-refresh-button");
  if (refreshButton) {
    createRoot(refreshButton).render(
      <StrictMode>
        <RefreshButton />
      </StrictMode>,
    );
  }
  const learnMore = document.querySelector("nav-learn-more");
  if (learnMore) {
    createRoot(learnMore).render(
      <StrictMode>
        <ConnectedLearnMore allowlist={allowlist} delegations={delegations} />
      </StrictMode>,
    );
  }
  const disconnect = document.querySelector("#nav-disconnect");
  createRoot(disconnect).render(
    <StrictMode>
      <ConnectedDisconnectButton />
    </StrictMode>,
  );
}

async function addModals() {
  const nftmodal = document.querySelector("nav-nft-modal");
  if (nftmodal) {
    const { createRoot } = await import("react-dom/client");
    const { StrictMode } = await import("react");
    const NFTModal = (await import("./NFTModal.jsx")).default;
    createRoot(nftmodal).render(
      <StrictMode>
        <NFTModal />
      </StrictMode>,
    );
  }

  const onboarding = document.querySelector("nav-onboarding-modal");
  if (onboarding) {
    const { createRoot } = await import("react-dom/client");
    const { StrictMode } = await import("react");
    const OnboardingModal = (await import("./OnboardingModal.jsx")).default;
    createRoot(onboarding).render(
      <StrictMode>
        <OnboardingModal />
      </StrictMode>,
    );
  }
}

async function addToaster() {
  const newElement = document.createElement("div");
  newElement.id = "new-element";
  document.body.appendChild(newElement);

  const { createRoot } = await import("react-dom/client");
  const { StrictMode } = await import("react");
  const { Toaster, toast } = await import("react-hot-toast");

  createRoot(newElement).render(
    <StrictMode>
      <Toaster />
    </StrictMode>,
  );
  return toast;
}

async function addNFTPrice() {
  const nftPriceElements = document.querySelectorAll("nft-price");
  if (nftPriceElements && nftPriceElements.length > 0) {
    const { createRoot } = await import("react-dom/client");
    const { StrictMode } = await import("react");
    const NFTPrice = (await import("./NFTPrice.jsx")).default;
    nftPriceElements.forEach((element) => {
      const fee = element.getAttribute("data-fee");
      createRoot(element).render(
        <StrictMode>
          <NFTPrice fee={fee} />
        </StrictMode>,
      );
    });
  }
}

async function share(toast, link) {
  const FCIcon = (await import("./fcicon.jsx")).default;
  const toastContent = (
    <div style={{ display: "flex", alignItems: "center" }}>
      <a
        style={{ display: "flex", alignItems: "center" }}
        href={`https://warpcast.com/~/compose?embeds[]=${link}&embeds[]=https://news.kiwistand.com`}
        target="_blank"
      >
        <FCIcon style={{ height: "15px", color: "white" }} />
        <span> </span>
        <span
          style={{
            marginLeft: "10px",
            textDecoration: "underline",
            color: "white",
          }}
        >
          Share your link on Warpcast
        </span>
      </a>
    </div>
  );

  const toastId = toast(toastContent, {
    duration: 10000,
    style: {
      position: "relative",
      top: `60px`,
      transform: "translate(-50%, -50%)", // You may need to adjust this
      backgroundColor: "#472a91",
    },
  });
}

function checkMintStatus(fetchAllowList, fetchDelegations) {
  const url = new URL(window.location.href);
  if (url.pathname !== "/indexing") return;

  const address = url.searchParams.get("address");
  // NOTE: For debugging
  if (url.searchParams.get("stop")) return;
  const intervalId = setInterval(async () => {
    const allowList = await fetchAllowList();
    const delegations = await fetchDelegations();

    if (
      !allowList.includes(address) &&
      !Object.values(delegations).includes(address)
    ) {
      console.log("Waiting for mint to be picked up...");
      return;
    }

    console.log("Mint has been picked up by the node.");
    clearInterval(intervalId);
    window.location.href = "/demonstration";
  }, 5000);
}

async function start() {
  await addModals();
  await addNFTPrice();
  const toast = await addToaster();

  const { fetchAllowList, fetchDelegations } = await import("./API.mjs");
  checkMintStatus(fetchAllowList, fetchDelegations);
  const allowlistPromise = fetchAllowList();
  const delegationsPromise = fetchDelegations();

  await addDelegateButton(await allowlistPromise, await delegationsPromise);
  await addBuyButton(allowlistPromise, delegationsPromise, toast);
  await addVotes(allowlistPromise, delegationsPromise, toast);
  await addConnectedComponents(
    await allowlistPromise,
    await delegationsPromise,
  );
  await addSubmitButton(
    await allowlistPromise,
    await delegationsPromise,
    toast,
  );

  let url = new URL(window.location.href);
  let link = url.searchParams.get("link");

  if (link) {
    share(toast, link);
    url.searchParams.delete("link");
    window.history.replaceState({}, "", url.href);
  }
}

start();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    await navigator.serviceWorker.register("/serviceWorker.js");
  });
}
