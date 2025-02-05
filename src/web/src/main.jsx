import "vite/modulepreload-polyfill";
import "@rainbow-me/rainbowkit/styles.css";
import PullToRefresh from "pulltorefreshjs";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { isIOS, isRunningPWA, getCookie, getLocalAccount } from "./session.mjs";
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

window.isSidebarOpen = false;
function handleClick(event) {
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.querySelector("#overlay");
  if (!sidebar) return;
  const isClickOutside = !sidebar.contains(event.target);
  const isSidebarToggle = event.target.closest(".sidebar-toggle") !== null;
  const isClickOnOverlay = event.target === overlay;

  if (
    isSidebarToggle ||
    (isClickOutside && window.isSidebarOpen) ||
    isClickOnOverlay
  ) {
    toggleSidebar();
  }
}

function toggleSidebar() {
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.querySelector("#overlay");
  var sidebarWidth;
  window.isSidebarOpen = !window.isSidebarOpen;

  if (window.innerWidth >= 1200) {
    sidebarWidth = window.isSidebarOpen ? "-25%" : "0";
  } else if (window.innerWidth >= 768 && window.innerWidth < 1200) {
    sidebarWidth = window.isSidebarOpen ? "-40%" : "0";
  } else {
    sidebarWidth = window.isSidebarOpen ? "-75%" : "0";
  }

  sidebar.style.left = sidebarWidth;

  // If the sidebar is open, show the overlay, else hide it
  overlay.style.display = window.isSidebarOpen ? "none" : "block";
  document.body.style.overflow = window.isSidebarOpen ? "auto" : "hidden";
}

document.addEventListener("click", handleClick);

async function addSubmitButton(allowlist, delegations, toast) {
  const submitButtonContainer = document.getElementById("submit-button");
  if (submitButtonContainer) {
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

async function addDecayingPriceLink() {
  const linkContainer = document.querySelector(".decaying-price-link");
  if (linkContainer) {
    const price = linkContainer.getAttribute("data-price");
    const Link = (await import("./DecayingPrice.jsx")).default;

    createRoot(linkContainer).render(
      <StrictMode>
        <Link initialPrice={price} />
      </StrictMode>,
    );
  }
}

async function addInviteLink(toast) {
  const linkContainer = document.querySelector("#invitelink-container");
  if (linkContainer) {
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
    const ChatBubble = (await import("./ChatBubble.jsx")).default;

    chatBubbles.forEach((arrow) => {
      const storyIndex = arrow.getAttribute("data-story-index");
      const commentCount = arrow.getAttribute("data-comment-count");
      createRoot(arrow).render(
        <StrictMode>
          <ChatBubble
            allowlist={allowlist}
            delegations={delegations}
            storyIndex={storyIndex}
            commentCount={commentCount}
          />
        </StrictMode>,
      );
    });
  }
}

async function addVotes(allowlist, delegations, toast) {
  const voteArrows = document.querySelectorAll(".vote-button-container");
  if (voteArrows.length === 0) return;

  const [{ default: Vote }, { default: DOMPurify }] = await Promise.all([
    import("./Vote.jsx"),
    import("isomorphic-dompurify"),
  ]);
  const observer = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const arrow = entry.target;
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
          observer.unobserve(arrow); // Stop observing after rendering
        }
      });
    },
    { threshold: 0.1 },
  );

  voteArrows.forEach((arrow) => observer.observe(arrow));
}

async function addFriendBuyButton(toast, allowlist) {
  const buyButtonContainer = document.querySelector(
    "#friend-buy-button-container",
  );
  if (buyButtonContainer) {
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
    const [allowlist, delegations, { default: BuyButton }] = await Promise.all([
      allowlistPromise,
      delegationsPromise,
      import("./BuyButton.jsx"),
    ]);
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
  const connectButton = document.querySelector(".connect-button-wrapper");
  if (connectButton) {
    const { ConnectedTextConnectButton } = await import("./Navigation.jsx");
    createRoot(connectButton).render(
      <StrictMode>
        <ConnectedTextConnectButton
          allowlist={allowlist}
          delegations={delegations}
        />
      </StrictMode>,
    );
  }

  const bellButton = document.querySelector("#bell");
  if (bellButton) {
    const Bell = (await import("./Bell.jsx")).default;
    bellButton.style = "";
    createRoot(bellButton).render(
      <StrictMode>
        <Bell allowlist={allowlist} delegations={delegations} />
      </StrictMode>,
    );
  }

  const searchButton = document.querySelector("#search");
  if (searchButton) {
    const Search = (await import("./Search.jsx")).default;
    searchButton.style = "";
    createRoot(searchButton).render(
      <StrictMode>
        <Search />
      </StrictMode>,
    );
  }

  const mobileBellButton = document.querySelector(".mobile-bell-container");
  if (mobileBellButton) {
    const Bell = (await import("./Bell.jsx")).default;
    createRoot(mobileBellButton).render(
      <StrictMode>
        <Bell mobile allowlist={allowlist} delegations={delegations} />
      </StrictMode>,
    );
  }

  const profileLink = document.querySelector("#nav-profile");
  if (profileLink) {
    const { ConnectedProfile } = await import("./Navigation.jsx");
    createRoot(profileLink).render(
      <StrictMode>
        <ConnectedProfile allowlist={allowlist} delegations={delegations} />
      </StrictMode>,
    );
  }

  const disconnect = document.querySelector("#nav-disconnect");
  if (disconnect) {
    const { ConnectedDisconnectButton } = await import("./Navigation.jsx");
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
    const { ConnectedSimpleDisconnectButton } = await import(
      "./Navigation.jsx"
    );
    createRoot(simpledisconnect).render(
      <StrictMode>
        <ConnectedSimpleDisconnectButton />
      </StrictMode>,
    );
  }
  const headerdisconnect = document.querySelector(".header-disconnect");
  if (headerdisconnect) {
    const { ConnectedSimpleDisconnectButton } = await import(
      "./Navigation.jsx"
    );
    createRoot(headerdisconnect).render(
      <StrictMode>
        <ConnectedSimpleDisconnectButton label="Disconnect" />
      </StrictMode>,
    );
  }
}

async function addPasskeysDialogue(toast, allowlist) {
  const elem = document.querySelector("nav-passkeys-backup");
  if (elem) {
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
          <a href="/demonstration">
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
    const TelegramLink = (await import("./TelegramLink.jsx")).default;
    createRoot(elem).render(
      <StrictMode>
        <TelegramLink allowlist={allowlist} />
      </StrictMode>,
    );
  }
}

async function addSubscriptionButton(allowlist, toast) {
  const button = document.querySelector("push-subscription-button");
  if (button) {
    const PushSubscriptionButton = (
      await import("./PushSubscriptionButton.jsx")
    ).default;
    const wrapper = button.getAttribute("data-wrapper") === "true";
    createRoot(button).render(
      <StrictMode>
        <PushSubscriptionButton
          toast={toast}
          wrapper={wrapper}
          allowlist={allowlist}
        />
      </StrictMode>,
    );
  }
}

async function addModals(allowlist, delegations, toast) {
  const nftmodal = document.querySelector("nav-nft-modal");
  if (nftmodal) {
    const NFTModal = (await import("./NFTModal.jsx")).default;
    createRoot(nftmodal).render(
      <StrictMode>
        <NFTModal />
      </StrictMode>,
    );
  }

  const delegationModal = document.querySelector("nav-delegation-modal");
  if (delegationModal) {
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

  const { Toaster, toast } = await import("react-hot-toast");

  createRoot(newElement).render(
    <StrictMode>
      <Toaster
        toastOptions={{
          success: {
            iconTheme: {
              primary: "rgb(175, 192, 70)",
            },
          },
        }}
      />
    </StrictMode>,
  );
  return toast;
}

async function addMinuteCountdown() {
  const elem = document.querySelector(".nav-countdown");
  if (elem) {
    const Countdown = (await import("./MinuteCountdown.jsx")).default;
    createRoot(elem).render(
      <StrictMode>
        <Countdown />
      </StrictMode>,
    );
  }
}

async function addAvatar(allowlist) {
  const avatarElem = document.querySelectorAll("nav-header-avatar");
  if (avatarElem && avatarElem.length > 0) {
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

async function checkMintStatus(address) {
  const url = new URL(window.location.href);
  if (url.pathname !== "/indexing") return;

  const [{ fetchAllowList, fetchDelegations }, { Wallet }] = await Promise.all([
    import("./API.mjs"),
    import("@ethersproject/wallet"),
  ]);

  const delegatePk = localStorage.getItem(`-kiwi-news-${address}-key`);

  let delegate;
  if (delegatePk) {
    delegate = new Wallet(delegatePk).address;
  }

  const [{ supportsPasskeys }, { testPasskeys }] = await Promise.all([
    import("./session.mjs"),
    import("./Passkeys.jsx"),
  ]);
  const intervalId = setInterval(async () => {
    const [allowList, delegations] = await Promise.all([
      fetchAllowList(),
      fetchDelegations(),
    ]);

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
      window.location.href = "/demonstration";
    }
  }, 3000);
}

async function startWatchAccount(allowlist, delegations) {
  const [{ client }, { getAccount }] = await Promise.all([
    import("./client.mjs"),
    import("@wagmi/core"),
  ]);

  const account = await getAccount();
  let signer;
  try {
    signer = await getSigner(account, allowlist);
  } catch (err) {
    // NOTE: Couldn't find a valid local signer, so we're returning and not
    // doing anything.
  }

  checkMintStatus(account.address);
  await processAndSendVotes(signer, account.address);
  window.addEventListener(
    "upvote-storage",
    async () => await processAndSendVotes(signer, account.address),
  );

  const { eligible } = await import("@attestate/delegator2");
  const { getLocalAccount } = await import("./session.mjs");
  const localAccount = getLocalAccount(account.address, allowlist);
  let address;
  if (localAccount) {
    address = localAccount.identity;
  } else if (account.isConnected) {
    address = account.address;
  }
  const identity = address && eligible(allowlist, delegations, address);
  if (!identity) {
    hideDesktopLinks();
    return;
  }
  dynamicPrefetch(`https://api.ensdata.net/${identity}?farcaster=true`);
}

function hideDesktopLinks() {
  const desktopNav = document.querySelector(".desktop-nav");
  if (desktopNav) {
    const submitLink = desktopNav.querySelector('.meta-link[href="/submit"]');
    const profileLink = desktopNav.querySelector('.meta-link[href="/profile"]');

    [submitLink, profileLink].forEach((link) => {
      if (link) {
        link.style.pointerEvents = "none";
        link.style.cursor = "default";
        link.style.opacity = "0.2";
      }
    });
  }
}

async function getSigner(account, allowlist) {
  const { getLocalAccount } = await import("./session.mjs");
  const localAccount = getLocalAccount(account.address, allowlist);

  if (localAccount && localAccount.privateKey) {
    const [{ getProvider }, { Wallet }] = await Promise.all([
      import("./client.mjs"),
      import("@ethersproject/wallet"),
    ]);
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

// NOTE: There's a bug for PWAs running in production, maybe it is related to
// https (because on localhost it isn't happening), where opening a new link in
// target="_blank" and then closing it causes the page to "reload". I asked
// about this in the Apple forum
// (https://developer.apple.com/forums/thread/742095) months ago and didn't get
// an answer but I now finally seem to have figured out that the _blank
// statement causes the issue and that it doesn't happen for _self. So this is
// what we're setting for iPhone
function updateLinkTargetsForIOSPWA() {
  if (isIOS()) {
    const links = document.querySelectorAll(
      ".story-link-container a, .mobile-row-image",
    );
    links.forEach((link) => link.setAttribute("target", "_self"));
  }
}

function initKiwiRotation(selector) {
  const kiwi = document.querySelector(selector);
  if (!kiwi) return;

  kiwi.style.transition = "transform 0.3s";
  const val = () => Math.floor(Math.random() * 30);

  function rotateKiwi() {
    kiwi.style.transform = `rotate(-${val()}deg)`;
    setTimeout(() => {
      kiwi.style.transform = `rotate(${val()}deg)`;
      setTimeout(() => {
        kiwi.style.transform = "rotate(0deg)";
      }, Math.random() * 5000 + 1000); // Random delay for looking right
    }, Math.random() * 5000 + 1000); // Random delay for looking left
  }

  setInterval(rotateKiwi, Math.random() * 5000 + 10000);
}

function makeCommentsVisited() {
  if (!window.location.pathname.startsWith("/stories")) return;

  const hash = window.location.hash.slice(1);
  const origin = window.location.href;

  const link0 = `/new?cached=true#${hash}`;
  const link1 = `/#${hash}`;
  history.replaceState(null, "", link0);
  history.replaceState(null, "", link1);
  history.replaceState(null, "", origin);
}

function makeUpvoteNotificationsVisited() {
  if (!window.location.pathname.startsWith("/activity")) return;

  const links = document.querySelectorAll(".upvote-notification");
  if (!links.length) return;

  const origin = window.location.href;

  for (const link of links) {
    const href = link.getAttribute("href");
    history.replaceState(null, "", href);
  }

  history.replaceState(null, "", origin);
}

const prefetchedUrls = new Set();
export function dynamicPrefetch(url, priority = "auto") {
  if (prefetchedUrls.has(url)) return;
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.href = url;
  link.fetchPriority = priority;
  link.as = "document";
  document.head.appendChild(link);
  prefetchedUrls.add(url);
}

async function start() {
  // NOTE: There are clients which had the identity cookie sent to 1 week and
  // they're now encountering the paywall. So in case this happens but their
  // local storage contains the respective private key, we want them to reload
  // the page. See the logic in CustomConnectButton to follow this flow.
  const identity = getCookie("identity");
  window.initialIdentityCookie = identity;

  initKiwiRotation(".hnname span img");

  storeReferral();

  makeCommentsVisited();
  window.addEventListener("hashchange", makeCommentsVisited);
  window.addEventListener("beforeunload", makeUpvoteNotificationsVisited, {
    once: true,
  });

  updateLinkTargetsForIOSPWA();

  if (
    window.location.pathname === "/" &&
    !window.location.search.includes("identity=") &&
    !window.location.search.includes("custom=")
  ) {
    const personalizedFeedUrl = identity
      ? `${window.location.origin}/?identity=${identity}`
      : `${window.location.origin}/custom=true`;
    const priority = "high";
    dynamicPrefetch(personalizedFeedUrl, priority);
  }

  // NOTE: We don't want pull to refresh for the submission page as this could
  // mess up the user's input on an accidential scroll motion.
  if (
    window.location.pathname !== "/submit" &&
    !document.documentElement.classList.contains("kiwi-ios-app")
  ) {
    PullToRefresh.init({
      mainElement: "body",
      // NOTE: If the user is searching in the search drawer, we don't want
      // them to accidentially reload the page
      shouldPullToRefresh: () =>
        !window.isSidebarOpen && !window.drawerIsOpen && !window.scrollY,
      onRefresh: () => {
        if (window.location.pathname === "/") {
          if (identity) {
            window.location.href = `/?identity=${identity}`;
          } else {
            window.location.href = `/?custom=true`;
          }
        } else {
          window.location.reload();
        }
      },
    });
  }

  const toast = await addToaster();
  window.toast = toast;

  const { fetchAllowList, fetchDelegations } = await import("./API.mjs");

  const cached = true;
  const allowlistPromise = fetchAllowList(cached);
  const delegationsPromise = fetchDelegations(cached);

  await startWatchAccount(await allowlistPromise, await delegationsPromise);

  const results0 = await Promise.allSettled([
    addDynamicComments(await allowlistPromise, await delegationsPromise, toast),
    addVotes(await allowlistPromise, await delegationsPromise, toast),
  ]);

  const results1 = await Promise.allSettled([
    addDynamicNavElements(),
    addInviteLink(toast),
    addDecayingPriceLink(),
    addCommentInput(toast, await allowlistPromise, await delegationsPromise),
    addSubscriptionButton(await allowlistPromise, toast),
    addTGLink(await allowlistPromise),
    addPasskeysDialogue(toast, await allowlistPromise),
    addModals(await allowlistPromise, await delegationsPromise, toast),
    addNFTPrice(),
    addMinuteCountdown(),
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
