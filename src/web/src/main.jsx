import "vite/modulepreload-polyfill";
import "@rainbow-me/rainbowkit/styles.css";
import PullToRefresh from "pulltorefreshjs";
import DOMPurify from "isomorphic-dompurify";
import { getAccount } from "@wagmi/core";

import { isRunningPWA, getCookie, getLocalAccount } from "./session.mjs";
import theme from "./theme.jsx";

function storeReferral() {
  if (!localStorage.getItem("--kiwi-news-original-referral")) {
    const urlParams = new URLSearchParams(window.location.search);
    const referral = urlParams.get("referral");
    if (referral) {
      localStorage.setItem("--kiwi-news-original-referral", referral);
    }
  }
}

function commentCountSignifier() {
  const isStoriesPage = window.location.pathname === "/stories";
  const indexQueryParam = new URLSearchParams(window.location.search).get(
    "index",
  );

  if (isStoriesPage && indexQueryParam) {
    const index = indexQueryParam.substring(2);
    // Update localStorage for a specific comment page
    const commentCountElement = document.querySelector(
      `[id^='comment-count-']`,
    );
    if (commentCountElement) {
      const currentCount = parseInt(commentCountElement.textContent, 10);
      localStorage.setItem(`commentCount-${index}`, currentCount.toString());
    }
    return;
  }

  document.querySelectorAll("[id^='chat-bubble-']").forEach((story) => {
    const index = story.id.split("-")[2];
    const commentCountElement = document.getElementById(
      `comment-count-${index}`,
    );
    const currentCount = parseInt(commentCountElement.textContent, 10);
    const storedCountKey = `commentCount-${index}`;
    const storedCount = parseInt(localStorage.getItem(storedCountKey), 10);

    if (isNaN(storedCount)) {
      localStorage.setItem(
        storedCountKey,
        isNaN(currentCount) ? "0" : currentCount.toString(),
      );
    } else if (currentCount > storedCount) {
      const svgElement = story.querySelector("svg");
      svgElement.style.color = theme.color;
    }
  });
}

async function checkNewStories() {
  let data;
  try {
    const response = await fetch("/api/v1/feeds/new");
    data = await response.json();
  } catch (error) {
    console.error("Error fetching new stories:", error);
    return;
  }

  if (data.status === "success" && data.data.stories.length > 0) {
    // TODO: This might now be broken with the updates to getLocalAccount that
    // need the allowlist and the connected account to be present. It probably
    // would then make more sense to replace the entire logic with a react
    // component.
    const account = getLocalAccount();
    const story = data.data.stories[0];
    const identity = story.identity;
    const latestTimestamp = story.timestamp;
    const localTimestamp = getCookie("newTimestamp");
    const elem = document.getElementById("new-dot");

    if (
      elem &&
      (!localTimestamp || latestTimestamp > Number(localTimestamp)) &&
      account &&
      account.identity !== identity
    ) {
      elem.style.display = "block";
    }
  }
}

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
    sidebarWidth = isSidebarOpen ? "-40%" : "0";
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

async function addInviteLink(toast) {
  const linkContainer = document.querySelector("#invitelink-container");
  if (linkContainer) {
    const { createRoot } = await import("react-dom/client");
    const { StrictMode } = await import("react");
    const InviteLink = (await import("./InviteLink.jsx")).default;

    createRoot(linkContainer).render(
      <StrictMode>
        <InviteLink toast={toast} />
      </StrictMode>,
    );
  }
}
async function addDynamicNavElements() {
  const navElements = document.querySelectorAll("[data-icon]");
  if (navElements && navElements.length > 0) {
    const { createRoot } = await import("react-dom/client");
    const { StrictMode } = await import("react");
    const BottomNavElem = (await import("./BottomNavElem.jsx")).default;

    navElements.forEach((elem) => {
      const icon = elem.getAttribute("data-icon");
      createRoot(elem).render(
        <StrictMode>
          <BottomNavElem icon={icon} />
        </StrictMode>,
      );
    });
  }
}

async function addDynamicComments(allowlist, delegations, toast) {
  const sections = document.querySelectorAll(".comment-section");
  if (sections && sections.length > 0) {
    const { createRoot } = await import("react-dom/client");
    const { StrictMode } = await import("react");
    const CommentSection = (await import("./CommentSection.jsx")).default;

    sections.forEach((arrow) => {
      const storyIndex = arrow.getAttribute("data-story-index");
      const commentCount = parseInt(
        arrow.getAttribute("data-comment-count"),
        10,
      );
      createRoot(arrow).render(
        <StrictMode>
          <CommentSection
            commentCount={commentCount}
            storyIndex={storyIndex}
            allowlist={allowlist}
            delegations={delegations}
            toast={toast}
          />
        </StrictMode>,
      );
    });
  }

  const chatBubbles = document.querySelectorAll(".chat-bubble-container");
  if (chatBubbles && chatBubbles.length > 0) {
    const { createRoot } = await import("react-dom/client");
    const { StrictMode } = await import("react");
    const ChatBubble = (await import("./ChatBubble.jsx")).default;

    chatBubbles.forEach((arrow) => {
      const storyIndex = arrow.getAttribute("data-story-index");
      const commentCount = arrow.getAttribute("data-comment-count");
      createRoot(arrow).render(
        <StrictMode>
          <ChatBubble storyIndex={storyIndex} commentCount={commentCount} />
        </StrictMode>,
      );
    });
  }
}

async function addVotes(allowlist, delegations, toast) {
  const voteArrows = document.querySelectorAll(".vote-button-container");
  if (voteArrows && voteArrows.length > 0) {
    const { createRoot } = await import("react-dom/client");
    const { StrictMode } = await import("react");
    const Vote = (await import("./Vote.jsx")).default;

    voteArrows.forEach((arrow) => {
      const title = DOMPurify.sanitize(arrow.getAttribute("data-title"));
      const href = DOMPurify.sanitize(arrow.getAttribute("data-href"));
      const isad = DOMPurify.sanitize(arrow.getAttribute("data-isad"));
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
            isad={isad}
            title={title}
            href={href}
            allowlist={allowlist}
            delegations={delegations}
            upvoters={upvoters}
            toast={toast}
            editorPicks={editorPicks}
          />
        </StrictMode>,
      );
    });
  }
}

async function addFriendBuyButton(toast, allowlist) {
  const buyButtonContainer = document.querySelector(
    "#friend-buy-button-container",
  );
  if (buyButtonContainer) {
    const { createRoot } = await import("react-dom/client");
    const { StrictMode } = await import("react");
    const BuyButton = (await import("./FriendBuyButton.jsx")).default;
    createRoot(buyButtonContainer).render(
      <StrictMode>
        <BuyButton toast={toast} allowlist={allowlist} />
      </StrictMode>,
    );
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

async function addCommentInput(toast, allowlist, delegations) {
  const commentInput = document.querySelector("nav-comment-input");
  if (commentInput) {
    const { createRoot } = await import("react-dom/client");
    const { StrictMode } = await import("react");
    const CommentInputComponent = (await import("./CommentInput.jsx")).default;
    const storyIndex = commentInput.getAttribute("data-story-index");
    createRoot(commentInput).render(
      <StrictMode>
        <CommentInputComponent
          storyIndex={storyIndex}
          toast={toast}
          allowlist={allowlist}
          delegations={delegations}
        />
      </StrictMode>,
    );
  }
}

async function addDelegateButton(allowlist, delegations, toast) {
  const delegateButtonContainer = document.querySelector(".delegate-button");
  if (delegateButtonContainer) {
    const { createRoot } = await import("react-dom/client");
    const { StrictMode } = await import("react");
    const DelegateButton = (await import("./DelegateButton.jsx")).default;
    createRoot(delegateButtonContainer).render(
      <StrictMode>
        <DelegateButton
          allowlist={allowlist}
          delegations={delegations}
          toast={toast}
        />
      </StrictMode>,
    );
  }
}

async function addConnectedComponents(allowlist, delegations, toast) {
  const { createRoot } = await import("react-dom/client");
  const { StrictMode } = await import("react");
  const {
    ConnectedSettings,
    ConnectedSubmit,
    ConnectedProfile,
    ConnectedDisconnectButton,
    ConnectedTextConnectButton,
    RefreshButton,
    ConnectedSimpleDisconnectButton,
  } = await import("./Navigation.jsx");

  const connectButton = document.querySelector(".connect-button-wrapper");
  if (connectButton) {
    createRoot(connectButton).render(
      <StrictMode>
        <ConnectedTextConnectButton
          allowlist={allowlist}
          delegations={delegations}
        />
      </StrictMode>,
    );
  }

  const Bell = (await import("./Bell.jsx")).default;
  const bellButton = document.querySelector("#bell");
  if (bellButton) {
    bellButton.style = "";
    createRoot(bellButton).render(
      <StrictMode>
        <Bell allowlist={allowlist} delegations={delegations} />
      </StrictMode>,
    );
  }

  const mobileBellButton = document.querySelector(".mobile-bell-container");
  if (mobileBellButton) {
    createRoot(mobileBellButton).render(
      <StrictMode>
        <Bell mobile allowlist={allowlist} delegations={delegations} />
      </StrictMode>,
    );
  }

  const profileLink = document.querySelector("#nav-profile");
  if (profileLink) {
    createRoot(profileLink).render(
      <StrictMode>
        <ConnectedProfile allowlist={allowlist} delegations={delegations} />
      </StrictMode>,
    );
  }

  const disconnect = document.querySelector("#nav-disconnect");
  if (disconnect) {
    createRoot(disconnect).render(
      <StrictMode>
        <ConnectedDisconnectButton />
      </StrictMode>,
    );
  }

  const simpledisconnect = document.querySelector(
    "nav-simple-disconnect-button",
  );
  if (simpledisconnect) {
    createRoot(simpledisconnect).render(
      <StrictMode>
        <ConnectedSimpleDisconnectButton />
      </StrictMode>,
    );
  }
}

async function addPasskeysDialogue(toast, allowlist) {
  const elem = document.querySelector("nav-passkeys-backup");
  if (elem) {
    const { createRoot } = await import("react-dom/client");
    const { StrictMode } = await import("react");
    const Passkeys = (await import("./Passkeys.jsx")).default;
    const RedirectButton = () => {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <p
            style={{
              color: "black",
              padding: "1rem 3rem 1rem 3rem",
              fontSize: "1rem",
              textAlign: "center",
              marginTop: "1rem",
            }}
          >
            Your next step:
          </p>
          <a href="/invite">
            <button
              className="button-secondary"
              style={{ width: "auto" }}
              id="button-onboarding"
            >
              Continue
            </button>
          </a>
        </div>
      );
    };
    createRoot(elem).render(
      <StrictMode>
        <Passkeys
          toast={toast}
          allowlist={allowlist}
          redirectButton={<RedirectButton />}
        />
      </StrictMode>,
    );
  }
}

async function addTGLink(allowlist) {
  const elem = document.querySelector("nav-invite-link");
  if (elem) {
    const { createRoot } = await import("react-dom/client");
    const { StrictMode } = await import("react");
    const TelegramLink = (await import("./TelegramLink.jsx")).default;
    createRoot(elem).render(
      <StrictMode>
        <TelegramLink allowlist={allowlist} />
      </StrictMode>,
    );
  }
}

async function addSubscriptionButton(allowlist) {
  const button = document.querySelector("push-subscription-button");
  if (button) {
    const { createRoot } = await import("react-dom/client");
    const { StrictMode } = await import("react");
    const PushSubscriptionButton = (
      await import("./PushSubscriptionButton.jsx")
    ).default;
    const wrapper = button.getAttribute("data-wrapper") === "true";
    createRoot(button).render(
      <StrictMode>
        <PushSubscriptionButton wrapper={wrapper} allowlist={allowlist} />
      </StrictMode>,
    );
  }

  const elem = document.querySelector("nav-push-notification-redirector");
  if (elem) {
    const { createRoot } = await import("react-dom/client");
    const { StrictMode } = await import("react");
    const { Redirector } = await import("./TelegramLink.jsx");
    createRoot(elem).render(
      <StrictMode>
        <Redirector />
      </StrictMode>,
    );
  }
}

async function addModals(allowlist, delegations, toast) {
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

  const delegationModal = document.querySelector("nav-delegation-modal");
  if (delegationModal) {
    const { createRoot } = await import("react-dom/client");
    const { StrictMode } = await import("react");
    const DelegationModal = (await import("./DelegationModal.jsx")).default;
    createRoot(delegationModal).render(
      <StrictMode>
        <DelegationModal
          toast={toast}
          allowlist={allowlist}
          delegations={delegations}
        />
      </StrictMode>,
    );
  }

  const onboarding = document.querySelector(".nav-onboarding-modal");
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

async function addAvatar(allowlist) {
  const avatarElem = document.querySelectorAll("nav-header-avatar");
  if (avatarElem && avatarElem.length > 0) {
    const { createRoot } = await import("react-dom/client");
    const { StrictMode } = await import("react");
    const Avatar = (await import("./Avatar.jsx")).default;
    avatarElem.forEach((element) => {
      createRoot(element).render(
        <StrictMode>
          <Avatar allowlist={allowlist} />
        </StrictMode>,
      );
    });
  }
}

async function addNFTPrice() {
  const nftPriceElements = document.querySelectorAll("nft-price");
  if (nftPriceElements && nftPriceElements.length > 0) {
    const { createRoot } = await import("react-dom/client");
    const { StrictMode } = await import("react");
    const NFTPrice = (await import("./NFTPrice.jsx")).default;
    nftPriceElements.forEach((element) => {
      const fee = element.getAttribute("data-fee");
      const selector = element.getAttribute("data-selector");
      createRoot(element).render(
        <StrictMode>
          <NFTPrice fee={fee} selector={selector} />
        </StrictMode>,
      );
    });
  }
}

async function share(toast, index) {
  const identity = getCookie("identity");

  const FCIcon = (await import("./fcicon.jsx")).default;
  const toastContent = (
    <div style={{ display: "flex", alignItems: "center" }}>
      <a
        style={{ display: "flex", alignItems: "center" }}
        href={`https://warpcast.com/~/compose?embeds[]=https://news.kiwistand.com/stories?index=${index}${
          identity ? `&referral=${identity}` : ""
        }`}
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

async function checkMintStatus(fetchAllowList, fetchDelegations) {
  const url = new URL(window.location.href);
  if (url.pathname !== "/indexing") return;

  const address = url.searchParams.get("address");
  const delegate = url.searchParams.get("delegate");
  const { supportsPasskeys } = await import("./session.mjs");
  const { testPasskeys } = await import("./Passkeys.jsx");
  const intervalId = setInterval(async () => {
    const allowList = await fetchAllowList();
    const delegations = await fetchDelegations();

    if (
      !allowList.includes(address) ||
      !Object.values(delegations).includes(address)
    ) {
      console.log("Waiting for mint to be picked up...");
      return;
    }
    if (delegate && !Object.keys(delegations).includes(delegate)) {
      console.log("Waiting for delegate to be picked up");
      return;
    }

    console.log("Mint has been picked up by the node.");
    clearInterval(intervalId);
    if (supportsPasskeys() && (await testPasskeys())) {
      window.location.href = "/passkeys";
    } else {
      window.location.href = "/invite";
    }
  }, 3000);
}

async function startWatchAccount(allowlist) {
  const { client } = await import("./client.mjs");

  const account = await getAccount();
  let signer;
  try {
    signer = await getSigner(account, allowlist);
  } catch (err) {
    // NOTE: Couldn't find a valid local signer, so we're returning and not
    // doing anything.
  }
  await processAndSendVotes(signer, account.address);
  window.addEventListener(
    "upvote-storage",
    async () => await processAndSendVotes(signer, account.address),
  );
}

async function getSigner(account, allowlist) {
  const { getLocalAccount } = await import("./session.mjs");
  const localAccount = getLocalAccount(account.address, allowlist);

  if (localAccount && localAccount.privateKey) {
    const { getProvider } = await import("./client.mjs");
    const { Wallet } = await import("@ethersproject/wallet");
    return new Wallet(localAccount.privateKey, getProvider());
  } else {
    throw new Error("Application key not found");
  }
}

async function processAndSendVotes(signer, identity) {
  const storiesString = localStorage.getItem("--kiwi-news-upvoted-stories");
  let stories = JSON.parse(storiesString);
  if (!stories) return;

  const removeDuplicates = (arr) => {
    const seen = new Set();
    return arr.filter(({ href }) => !seen.has(href) && seen.add(href));
  };
  stories = removeDuplicates(stories);

  const { messageFab, send, EIP712_DOMAIN, EIP712_TYPES } = await import(
    "./API.mjs"
  );
  for (const { href, title } of stories) {
    const value = messageFab(title, href);

    try {
      const signature = await signer._signTypedData(
        EIP712_DOMAIN,
        EIP712_TYPES,
        value,
      );
      const response = await send(value, signature);
      if (response && response.status === "success") {
        window.toast.success("Thanks for your upvote! Have a 🥝");
        console.log("Vote sent:", response);

        const element = document.querySelector(
          `.vote-button-container[data-href="${href}"]`,
        );
        if (element) {
          const upvoters = JSON.parse(element.getAttribute("data-upvoters"));
          upvoters.push(identity);
          element.setAttribute("data-upvoters", JSON.stringify(upvoters));
        }
      }
    } catch (error) {
      console.error("Error sending vote:", error);
    }
    localStorage.removeItem("--kiwi-news-upvoted-stories");
  }
}

async function start() {
  // NOTE: There are clients which had the identity cookie sent to 1 week and
  // they're now encountering the paywall. So in case this happens but their
  // local storage contains the respective private key, we want them to reload
  // the page. See the logic in CustomConnectButton to follow this flow.
  window.initialIdentityCookie = getCookie("identity");

  storeReferral();
  // NOTE: We don't want pull to refresh for the submission page as this could
  // mess up the user's input on an accidential scroll motion.
  if (isRunningPWA() && window.location.pathname !== "/submit") {
    PullToRefresh.init({
      mainElement: "body",
      onRefresh() {
        window.location.reload();
      },
    });
  }
  // TODO: Fix, this is currently broken because the ChatBubble react component
  // now takes over the rendering, but since we also couldn't figure out how we
  // can make this work together.
  //commentCountSignifier();

  const toast = await addToaster();
  window.toast = toast;

  const { fetchAllowList, fetchDelegations } = await import("./API.mjs");
  checkMintStatus(fetchAllowList, fetchDelegations);

  const allowlistPromise = fetchAllowList();
  const delegationsPromise = fetchDelegations();

  await startWatchAccount(await allowlistPromise);
  const results0 = await Promise.allSettled([
    addDynamicComments(await allowlistPromise, await delegationsPromise, toast),
    addVotes(await allowlistPromise, await delegationsPromise, toast),
  ]);

  const results1 = await Promise.allSettled([
    addDynamicNavElements(),
    addInviteLink(toast),
    addCommentInput(toast, await allowlistPromise, await delegationsPromise),
    addSubscriptionButton(await allowlistPromise),
    addTGLink(await allowlistPromise),
    addPasskeysDialogue(toast, await allowlistPromise),
    addModals(await allowlistPromise, await delegationsPromise, toast),
    addNFTPrice(),
    addAvatar(await allowlistPromise),
    addDelegateButton(await allowlistPromise, await delegationsPromise, toast),
    addBuyButton(allowlistPromise, delegationsPromise, toast),
    addFriendBuyButton(toast, await allowlistPromise),
    addConnectedComponents(
      await allowlistPromise,
      await delegationsPromise,
      toast,
    ),
    addSubmitButton(await allowlistPromise, await delegationsPromise, toast),
    checkNewStories(),
  ]);

  results0.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(`Error in promise at index ${index}:`, result.reason);
    }
  });
  results1.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(`Error in promise at index ${index}:`, result.reason);
    }
  });

  if (window.location.pathname === "/new") {
    let url = new URL(window.location.href);
    let index = url.searchParams.get("index");

    if (index) {
      share(toast, index);
      url.searchParams.delete("index");
      window.history.replaceState({}, "", url.href);
    }
  }

  // NOTE: We're setting this value here because there are inline scripts which
  // are only executing in case react has successfully loaded on the site,
  // which we consider to be the case when we've reached this part of the
  // application.
  window.reactHasLoaded = true;
}

start();
