import "vite/modulepreload-polyfill";
import "./request_monitor.js";
import PullToRefresh from "pulltorefreshjs";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import sdk from "@farcaster/frame-sdk";
import { Providers } from "./providers.jsx";

// Make SDK available globally for use in other parts of the app
window.sdk = sdk;

async function initFarcasterFrame() {
  // 1) Tell the host we’re live (no-op if not in a Farcaster client)
  try {
    await sdk.actions.ready();
  } catch {}

  // Enable back navigation for mini app
  try {
    const isMiniApp = await sdk.isInMiniApp();
    if (isMiniApp) {
      // Enable automatic web navigation handling
      await sdk.back.enableWebNavigation();
      // Show the native back button
      await sdk.back.show();
    }
  } catch (err) {
    console.log("Could not enable back navigation:", err);
  }

  // 2) Wire up the button (guarded)
  const btn = document.getElementById("frame-add-btn");
  if (btn) btn.addEventListener("click", () => sdk.actions.addFrame());
}

async function applySafeAreaInsets() {
  console.log("applySafeAreaInsets called");

  // Check if we're running in a mini app context
  const isMiniApp = await sdk.isInMiniApp();
  console.log("isMiniApp:", isMiniApp);

  if (!isMiniApp) {
    console.log("Not in mini app, returning");
    return;
  }

  try {
    console.log("Getting context...");
    const context = await sdk.context;
    console.log("Context:", context);

    const { safeAreaInsets } = context.client;
    console.log("Safe area insets:", safeAreaInsets);

    if (safeAreaInsets && safeAreaInsets.bottom > 0) {
      console.log(
        "Applying bottom inset to bottom navigation:",
        safeAreaInsets.bottom,
      );

      // Apply bottom inset to bottom navigation
      const bottomNav = document.querySelector(".bottom-nav");
      if (bottomNav) {
        bottomNav.style.paddingBottom = `${safeAreaInsets.bottom}px`;
        console.log("Bottom nav padding applied:", safeAreaInsets.bottom);
      } else {
        console.log("Bottom nav element not found");
      }
    } else {
      console.log("No bottom safe area inset needed");
    }
  } catch (error) {
    console.log("Could not apply safe area insets:", error);
  }
}

import { isIOS, isRunningPWA, getCookie, getLocalAccount } from "./session.mjs";
import theme from "./theme.jsx";
import posthog from "posthog-js";
window.posthog = posthog; // Make available globally but don't initialize

// Initialize PostHog by default unless user has explicitly opted out
const analyticsConsent = localStorage.getItem("kiwi-analytics-consent");
if (analyticsConsent !== "false") {
  // Initialize unless explicitly opted out
  posthog.init("phc_F3mfkyH5tKKSVxnMbJf0ALcPA98s92s3Jw8a7eqpBGw", {
    api_host: "https://eu.i.posthog.com",
    person_profiles: "identified_only",
  });
}

window.isSidebarOpen = false;

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

// Instead of a document-wide click handler, add specific handlers
document.addEventListener("DOMContentLoaded", () => {
  // Add click handler for sidebar toggle buttons
  const toggleButtons = document.querySelectorAll(".sidebar-toggle");
  toggleButtons.forEach((button) => {
    button.addEventListener("click", toggleSidebar);
  });

  // Add click handler for overlay to close sidebar
  const overlay = document.querySelector("#overlay");
  if (overlay) {
    overlay.addEventListener("click", toggleSidebar);
  }
});

async function addSubmitButton(allowlist, delegations, toast) {
  const submitButtonContainer = document.getElementById("submit-button");
  if (submitButtonContainer) {
    const SubmitButton = (await import("./SubmitButton.jsx")).default;

    createRoot(submitButtonContainer).render(
      <StrictMode>
        <Providers>
          <SubmitButton
            toast={toast}
            allowlist={allowlist}
            delegations={delegations}
          />
        </Providers>
      </StrictMode>,
    );
  }
}

async function addAnalytics(allowlist) {
  // Run on feed pages, profile pages, and story pages
  const path = window.location.pathname;
  const isFeedPage = path === "/" || path === "/new" || path === "/best";
  const isProfilePage = path.startsWith("/upvotes");
  const isStoryPage = path.startsWith("/stories");
  
  // Check if there are any analytics elements on the page
  const analyticsElements = document.querySelectorAll(".story-analytics");
  if (analyticsElements.length > 0 && (isFeedPage || isProfilePage || isStoryPage)) {
    const Analytics = (await import("./Analytics.jsx")).default;
    
    // Create a container for the React component
    const container = document.createElement("div");
    container.style.display = "none";
    document.body.appendChild(container);
    
    createRoot(container).render(
      <StrictMode>
        <Providers>
          <Analytics allowlist={allowlist} />
        </Providers>
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
        <Providers>
          <Link initialPrice={price} />
        </Providers>
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
        <Providers>
          <InviteLink toast={toast} />
        </Providers>
      </StrictMode>,
    );
  }
}

async function addDynamicNavElements() {
  // Disabled: React components were replacing server-rendered navigation content
  // The server already renders complete navigation with SVGs and labels
  // This was causing the navigation to shrink when JS loaded
  return;
  
  // const navElements = document.querySelectorAll("[data-icon]");
  // if (navElements && navElements.length > 0) {
  //   const BottomNavElem = (await import("./BottomNavElem.jsx")).default;
  //
  //   navElements.forEach((elem) => {
  //     const icon = elem.getAttribute("data-icon");
  //     createRoot(elem).render(
  //       <StrictMode>
  //         <Providers>
  //           <BottomNavElem icon={icon} />
  //         </Providers>
  //       </StrictMode>,
  //     );
  //   });
  // }
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
      const hasPreview = arrow.getAttribute("data-has-preview") === "true";
      createRoot(arrow).render(
        <StrictMode>
          <Providers>
            <CommentSection
              commentCount={commentCount}
              storyIndex={storyIndex}
              hasPreview={hasPreview}
              allowlist={allowlist}
              delegations={delegations}
              toast={toast}
            />
          </Providers>
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
          <Providers>
            <ChatBubble
              allowlist={allowlist}
              delegations={delegations}
              storyIndex={storyIndex}
              commentCount={commentCount}
            />
          </Providers>
        </StrictMode>,
      );
    });
  }
}

async function addVotes(allowlist, delegations, toast) {
  const voteArrows = document.querySelectorAll(".like-button-container");
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
              <Providers>
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
              </Providers>
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
        <Providers>
          <BuyButton toast={toast} allowlist={allowlist} />
        </Providers>
      </StrictMode>,
    );
  }
}

async function addEmailSubscriptionForm(allowlist, delegations, toast) {
  const elem = document.querySelector("email-subscription-form");
  if (elem) {
    const { ConnectedEmailSubscriptionForm } = await import("./Bell.jsx");
    createRoot(elem).render(
      <StrictMode>
        <Providers>
          <ConnectedEmailSubscriptionForm
            allowlist={allowlist}
            delegations={delegations}
            toast={toast}
            onSuccess={() => {
              window.location.href = "/demonstration";
            }}
          />
        </Providers>
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
        <Providers>
          <BuyButton
            allowlist={allowlist}
            delegations={delegations}
            toast={toast}
          />
        </Providers>
      </StrictMode>,
    );
  }
}

async function addProfileDisplay() {
  const profileContainer = document.querySelector("#user-profile");
  if (profileContainer) {
    // Clear the placeholder content before mounting React
    profileContainer.innerHTML = "";

    const ProfileWithConfig = (await import("./ProfileWithConfig.jsx")).default;
    createRoot(profileContainer).render(
      <StrictMode>
        <Providers>
          <ProfileWithConfig />
        </Providers>
      </StrictMode>,
    );
  }
}

async function addCommentInput(toast, allowlist, delegations) {
  const commentInput = document.querySelector("nav-comment-input");
  if (commentInput) {
    const CommentInputComponent = (await import("./CommentInput.jsx")).default;

    const storyIndex = commentInput.getAttribute("data-story-index");
    const customStyleAttr = commentInput.getAttribute("data-custom-style");
    let customStyle = {};
    if (customStyleAttr) {
      try {
        customStyle = JSON.parse(customStyleAttr);
      } catch (e) {
        console.error("Failed to parse custom style", e);
      }
    }

    createRoot(commentInput).render(
      <StrictMode>
        <Providers>
          <CommentInputComponent
            storyIndex={storyIndex}
            toast={toast}
            allowlist={allowlist}
            delegations={delegations}
            style={customStyle}
          />
        </Providers>
      </StrictMode>,
    );
  }
}

async function addDelegateButton(allowlist, delegations, toast) {
  const delegateButtonContainer = document.querySelector(".delegate-button");
  if (delegateButtonContainer) {
    const DelegateButton = (await import("./DelegateButton.jsx")).default;
    const showRedirect =
      delegateButtonContainer.getAttribute("redirect-button") !== "false";
    const isAppOnboarding =
      delegateButtonContainer.getAttribute("is-app-onboarding") === "true";
    createRoot(delegateButtonContainer).render(
      <StrictMode>
        <Providers>
          <DelegateButton
            allowlist={allowlist}
            delegations={delegations}
            toast={toast}
            showRedirect={showRedirect}
            isAppOnboarding={isAppOnboarding}
          />
        </Providers>
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
        <Providers>
          <ConnectedTextConnectButton
            allowlist={allowlist}
            delegations={delegations}
            toast={toast}
          />
        </Providers>
      </StrictMode>,
    );
  }

  // Check if we're on mobile based on the breakpoint in news.css (max-width: 640px)
  const isMobileView = window.innerWidth <= 640;

  if (!isMobileView) {
    const bellButton = document.querySelector("#bell");
    if (bellButton) {
      const Bell = (await import("./Bell.jsx")).default;
      bellButton.style = "";
      createRoot(bellButton).render(
        <StrictMode>
          <Providers>
            <Bell toast={toast} allowlist={allowlist} delegations={delegations} />
          </Providers>
        </StrictMode>,
      );
    }
  }

  const searchButton = document.querySelector("#search");
  if (searchButton) {
    const Search = (await import("./Search.jsx")).default;
    searchButton.style = "";
    createRoot(searchButton).render(
      <StrictMode>
        <Providers>
          <Search />
        </Providers>
      </StrictMode>,
    );
  }
  const desktopSearchContainer = document.querySelector(
    "#static-desktop-search",
  );
  if (desktopSearchContainer) {
    import("./DesktopSearch.jsx").then((module) => {
      createRoot(desktopSearchContainer).render(
        <StrictMode>
          <Providers>
            <module.default />
          </Providers>
        </StrictMode>,
      );
    });
  }

  if (isMobileView) {
    const mobileBellButton = document.querySelector(".mobile-bell-container");
    if (mobileBellButton) {
      const Bell = (await import("./Bell.jsx")).default;
      createRoot(mobileBellButton).render(
        <StrictMode>
          <Providers>
            <Bell
              toast={toast}
              mobile
              allowlist={allowlist}
              delegations={delegations}
            />
          </Providers>
        </StrictMode>,
      );
    }
  }

  const profileLink = document.querySelector("#nav-profile");
  if (profileLink) {
    const { ConnectedProfile } = await import("./Navigation.jsx");
    createRoot(profileLink).render(
      <StrictMode>
        <Providers>
          <ConnectedProfile
            toast={toast}
            allowlist={allowlist}
            delegations={delegations}
          />
        </Providers>
      </StrictMode>,
    );
  }

  const disconnect = document.querySelector("#nav-disconnect");
  if (disconnect) {
    const { ConnectedDisconnectButton } = await import("./Navigation.jsx");
    createRoot(disconnect).render(
      <StrictMode>
        <Providers>
          <ConnectedDisconnectButton toast={toast} />
        </Providers>
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
        <Providers>
          <ConnectedSimpleDisconnectButton toast={toast} />
        </Providers>
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
        <Providers>
          <ConnectedSimpleDisconnectButton label="Disconnect" toast={toast} />
        </Providers>
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
        <Providers>
          <TelegramLink allowlist={allowlist} />
        </Providers>
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
        <Providers>
          <NFTModal />
        </Providers>
      </StrictMode>,
    );
  }

  const delegationModal = document.querySelector("nav-delegation-modal");
  if (delegationModal) {
    const DelegationModal = (await import("./DelegationModal.jsx")).default;
    createRoot(delegationModal).render(
      <StrictMode>
        <Providers>
          <DelegationModal
            toast={toast}
            allowlist={allowlist}
            delegations={delegations}
          />
        </Providers>
      </StrictMode>,
    );
  }

  const onboarding = document.querySelector(".nav-onboarding-modal");
  if (onboarding) {
    const OnboardingModal = (await import("./OnboardingModal.jsx")).default;
    createRoot(onboarding).render(
      <StrictMode>
        <Providers>
          <OnboardingModal />
        </Providers>
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
      <Providers>
        <Toaster
          toastOptions={{
            success: {
              iconTheme: {
                primary: "rgb(175, 192, 70)",
              },
            },
          }}
        />
      </Providers>
    </StrictMode>,
  );
  return toast;
}

async function addAnalyticsConsent() {
  if (!document.getElementById("analytics-consent-container")) {
    const container = document.createElement("div");
    container.id = "analytics-consent-container";
    document.body.appendChild(container);
  }

  const AnalyticsConsent = (await import("./AnalyticsConsent.jsx")).default;
  createRoot(document.getElementById("analytics-consent-container")).render(
    <StrictMode>
      <Providers>
        <AnalyticsConsent />
      </Providers>
    </StrictMode>,
  );
}

// TestFlight QR code removed - no longer supported
// async function addTestFlightQR() {
//   if (!document.getElementById("testflight-qr-container")) {
//     const container = document.createElement("div");
//     container.id = "testflight-qr-container";
//     document.body.appendChild(container);
//   }
//
//   const TestFlightQR = (await import("./TestFlightQR.jsx")).default;
//   createRoot(document.getElementById("testflight-qr-container")).render(
//     <StrictMode>
//       <Providers>
//         <TestFlightQR />
//       </Providers>
//     </StrictMode>,
//   );
// }

async function addMinuteCountdown() {
  const elem = document.querySelector(".nav-countdown");
  if (elem) {
    const Countdown = (await import("./MinuteCountdown.jsx")).default;
    createRoot(elem).render(
      <StrictMode>
        <Providers>
          <Countdown />
        </Providers>
      </StrictMode>,
    );
  }
}

async function addTutorialDrawers() {
  const tutorialContainer = document.querySelector("#tutorial-drawers");
  if (tutorialContainer) {
    const TutorialDrawers = (await import("./TutorialDrawers.jsx")).default;
    createRoot(tutorialContainer).render(
      <StrictMode>
        <Providers>
          <TutorialDrawers />
        </Providers>
      </StrictMode>,
    );
  }
}

async function addEmbedDrawer(toast) {
  // Create container if it doesn't exist
  if (!document.getElementById("embed-drawer-container")) {
    const container = document.createElement("div");
    container.id = "embed-drawer-container";
    document.body.appendChild(container);
  }

  const EmbedDrawer = (await import("./EmbedDrawer.jsx")).default;
  createRoot(document.getElementById("embed-drawer-container")).render(
    <StrictMode>
      <Providers>
        <EmbedDrawer toast={toast} />
      </Providers>
    </StrictMode>,
  );
}

async function addRewardsDrawer() {
  // Create container if it doesn't exist
  if (!document.getElementById("rewards-drawer-container")) {
    const container = document.createElement("div");
    container.id = "rewards-drawer-container";
    document.body.appendChild(container);
  }

  const RewardsDrawer = (await import("./RewardsDrawer.jsx")).default;
  createRoot(document.getElementById("rewards-drawer-container")).render(
    <StrictMode>
      <Providers>
        <RewardsDrawer />
      </Providers>
    </StrictMode>,
  );
}

async function addAvatar(allowlist) {
  const avatarElem = document.querySelectorAll("nav-header-avatar");
  if (avatarElem && avatarElem.length > 0) {
    const Avatar = (await import("./Avatar.jsx")).default;
    avatarElem.forEach((element) => {
      createRoot(element).render(
        <StrictMode>
          <Providers>
            <Avatar allowlist={allowlist} />
          </Providers>
        </StrictMode>,
      );
    });
  }
}

async function addBackButton() {
  const backButtonElem = document.querySelector(".story-back-button");
  if (backButtonElem) {
    const BackButton = (await import("./BackButton.jsx")).default;
    createRoot(backButtonElem).render(
      <StrictMode>
        <Providers>
          <BackButton />
        </Providers>
      </StrictMode>,
    );
  }
}

async function addStoryEmojiReactions(allowlist, delegations, toast) {
  const reactionContainers = document.querySelectorAll(".reactions-container");
  if (reactionContainers && reactionContainers.length > 0) {
    const [commentSection, wagmi, tanstackQuery, rainbowKit, clientConfig] = await Promise.all(
      [
        import("./CommentSection.jsx"),
        import("wagmi"),
        import("@tanstack/react-query"),
        import("@rainbow-me/rainbowkit"),
        import("./client.mjs"),
      ],
    );

    const { EmojiReaction } = commentSection;
    const { WagmiProvider } = wagmi;
    const { QueryClient, QueryClientProvider } = tanstackQuery;
    const { RainbowKitProvider } = rainbowKit;
    const { client, chains } = clientConfig;
    const queryClient = new QueryClient();

    reactionContainers.forEach((container) => {
      const commentData = container.getAttribute("data-comment");
      if (commentData) {
        const comment = JSON.parse(commentData);
        const root = createRoot(container);

        // Keep existing content as fallback while React loads
        const existingContent = container.innerHTML;

        // Prepare the React component
        const reactComponent = (
          <StrictMode>
            <Providers>
              <QueryClientProvider client={queryClient}>
                <WagmiProvider config={client}>
                  <RainbowKitProvider chains={chains}>
                    <EmojiReaction
                      comment={comment}
                      allowlist={allowlist}
                      delegations={delegations}
                      toast={toast}
                    />
                  </RainbowKitProvider>
                </WagmiProvider>
              </QueryClientProvider>
            </Providers>
          </StrictMode>
        );

        // Render React component while preserving existing content
        root.render(reactComponent);
      }
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
          <Providers>
            <NFTPrice fee={fee} selector={selector} />
          </Providers>
        </StrictMode>,
      );
    });
  }
}

async function addKarmaElements() {
  const karmaElements = document.querySelectorAll("nav-karma");
  if (karmaElements && karmaElements.length > 0) {
    const Karma = (await import("./Karma.jsx")).default;
    karmaElements.forEach((element) => {
      const address = element.getAttribute("data-address");
      const initial = element.getAttribute("data-initial");
      const initialContent = element.textContent.trim();

      createRoot(element).render(
        <StrictMode>
          <Providers>
            <Karma address={address} initial={initial}>
              {initialContent}
            </Karma>
          </Providers>
        </StrictMode>,
      );
    });
  }
}

async function addLeaderboardInteractions() {
  // Only add if we're on the leaderboard page
  if (window.location.pathname !== "/community") return;

  // Wait a bit for DOM to be ready
  setTimeout(() => {
    // Function to toggle user stories
    function toggleUserStories(userId) {
      const storiesDiv = document.getElementById(`stories-${userId}`);
      const expandIcon = document.getElementById(`expand-${userId}`);
      
      if (storiesDiv && (storiesDiv.style.display === 'none' || !storiesDiv.style.display)) {
        storiesDiv.style.display = 'block';
        if (expandIcon) {
          // Change to down arrow when expanded
          expandIcon.innerHTML = '<rect width="256" height="256" fill="none"/><polyline points="208 96 128 176 48 96" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>';
        }
      } else if (storiesDiv) {
        storiesDiv.style.display = 'none';
        if (expandIcon) {
          // Change to right arrow when collapsed
          expandIcon.innerHTML = '<rect width="256" height="256" fill="none"/><polyline points="96 48 176 128 96 208" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>';
        }
      }
    }

    // Add click handlers for expand buttons
    const expandButtons = document.querySelectorAll('.expand-button[data-user-id]');
    console.log('Found expand buttons:', expandButtons.length);
    
    expandButtons.forEach(button => {
      button.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const userId = this.getAttribute('data-user-id');
        toggleUserStories(userId);
      });
    });

    // Add click handlers for expandable rows (clicking anywhere on the row)
    const expandableRows = document.querySelectorAll('.leaderboard-user-row.expandable-row');
    console.log('Found expandable rows:', expandableRows.length);
    
    expandableRows.forEach(row => {
      row.addEventListener('click', function(e) {
        // Only expand if we didn't click on a link or button
        if (!e.target.closest('a') && !e.target.closest('button')) {
          const userId = this.getAttribute('data-user-id');
          toggleUserStories(userId);
        }
      });
    });

    // Function to toggle story contributors
    function toggleStoryContributors(storyId) {
      const contributorsDiv = document.getElementById(`contributors-${storyId}`);
      const expandIcon = document.getElementById(`expand-${storyId}`);
      
      if (contributorsDiv && (contributorsDiv.style.display === 'none' || !contributorsDiv.style.display)) {
        contributorsDiv.style.display = 'block';
        if (expandIcon) {
          // Change to down arrow when expanded
          expandIcon.innerHTML = '<rect width="256" height="256" fill="none"/><polyline points="208 96 128 176 48 96" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>';
        }
      } else if (contributorsDiv) {
        contributorsDiv.style.display = 'none';
        if (expandIcon) {
          // Change to right arrow when collapsed
          expandIcon.innerHTML = '<rect width="256" height="256" fill="none"/><polyline points="96 48 176 128 96 208" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>';
        }
      }
    }

    // Add click handlers for story expand buttons
    const storyExpandButtons = document.querySelectorAll('.story-expand-button[data-story-id]');
    console.log('Found story expand buttons:', storyExpandButtons.length);
    
    storyExpandButtons.forEach(button => {
      button.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const storyId = this.getAttribute('data-story-id');
        toggleStoryContributors(storyId);
      });
    });

    // Add click handlers for expandable story rows (clicking anywhere on the row)
    const expandableStoryRows = document.querySelectorAll('.expandable-story-row[data-story-id]');
    console.log('Found expandable story rows:', expandableStoryRows.length);
    
    expandableStoryRows.forEach(row => {
      row.addEventListener('click', function(e) {
        // Only expand if we didn't click on a link or button
        if (!e.target.closest('a') && !e.target.closest('button')) {
          const storyId = this.getAttribute('data-story-id');
          toggleStoryContributors(storyId);
        }
      });
    });
  }, 200); // Small delay to ensure DOM is ready
}

async function addLeaderboardStats(allowlist, delegations) {
  // Only add if we're on the leaderboard page
  if (window.location.pathname !== "/community") return;
  
  // Check if the elements exist
  const karmaEl = document.querySelector('.user-karma-value');
  if (!karmaEl) return;

  // Get the current account if available
  const [{ getAccount }, { client, chains }] = await Promise.all([
    import("@wagmi/core"),
    import("./client.mjs"),
  ]);
  
  let address;
  try {
    const account = await getAccount(client);
    if (account && account.address) {
      address = account.address;
    }
  } catch (err) {
    // Try to get from local storage
    const localAccount = getLocalAccount(null, allowlist);
    if (localAccount && localAccount.identity) {
      address = localAccount.identity;
    }
  }

  // Create a hidden container for the React component
  const container = document.createElement('div');
  container.style.display = 'none';
  document.body.appendChild(container);

  const [LeaderboardStats, wagmi, tanstackQuery, rainbowKit] = await Promise.all([
    import("./LeaderboardStats.jsx").then(m => m.default),
    import("wagmi"),
    import("@tanstack/react-query"),
    import("@rainbow-me/rainbowkit"),
  ]);
  
  const { WagmiProvider } = wagmi;
  const { QueryClient, QueryClientProvider } = tanstackQuery;
  const { RainbowKitProvider } = rainbowKit;
  const queryClient = new QueryClient();

  createRoot(container).render(
    <StrictMode>
      <Providers>
        <QueryClientProvider client={queryClient}>
          <WagmiProvider config={client}>
            <RainbowKitProvider chains={chains}>
              <LeaderboardStats 
                allowlist={allowlist} 
                delegations={delegations} 
                address={address}
              />
            </RainbowKitProvider>
          </WagmiProvider>
        </QueryClientProvider>
      </Providers>
    </StrictMode>,
  );
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

  const intervalId = setInterval(async () => {
    const [allowList, delegations] = await Promise.all([
      fetchAllowList(),
      fetchDelegations(),
    ]);

    if (
      !allowList.has(address) &&
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
    window.location.href = "/";
  }, 3000);
}

async function startWatchAccount(allowlist, delegations) {
  const [{ client }, { getAccount }] = await Promise.all([
    import("./client.mjs"),
    import("@wagmi/core"),
  ]);

  const account = await getAccount(client);
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
  if (identity) {
    posthog.identify(identity);
    
    // Initialize interaction tracking with the signer and identity
    if (signer) {
      import("./tracker.mjs").then((tracker) => {
        tracker.initializeTracking(signer, identity);
        console.log("Interaction tracking initialized with signer");
      }).catch((err) => {
        console.error("Failed to initialize interaction tracking:", err);
      });
    } else {
      // Initialize without signer (read-only mode)
      import("./tracker.mjs").then((tracker) => {
        tracker.initializeTracking();
        console.log("Interaction tracking initialized without signer (read-only)");
      }).catch((err) => {
        console.error("Failed to initialize interaction tracking:", err);
      });
    }
  } else {
    hideDesktopLinks();
    // Still initialize tracker but without signer (for non-logged in users)
    import("./tracker.mjs").then((tracker) => {
      tracker.initializeTracking();
      console.log("Interaction tracking initialized (no auth)");
    }).catch((err) => {
      console.error("Failed to initialize interaction tracking:", err);
    });
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
        console.log("Vote sent:", response);

        const element = document.querySelector(
          `.like-button-container[data-href="${href}"]`,
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
      ".story-link-container a, .mobile-row-image, .tweet-preview-container",
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

function initTerminalAds() {
  const terminalAds = document.querySelectorAll('[data-terminal-ad="true"]');
  if (terminalAds.length === 0) return;

  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.3
  };
  
  const terminalObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !entry.target.classList.contains('terminal-ad-active')) {
        entry.target.classList.add('terminal-ad-active');
        // Also add class to parent container for border animation
        const container = entry.target.closest('.terminal-container');
        if (container) {
          container.classList.add('terminal-ad-active');
        }
      }
    });
  }, observerOptions);
  
  terminalAds.forEach(ad => {
    terminalObserver.observe(ad);
  });
}

function trackLinkImpressions() {
  // Find all story links - both regular links and those with previews
  // Regular story links have class="story-link"
  // Preview links are in .story-link-container but may not have the class
  const storyLinks = document.querySelectorAll(
    ".story-link, .story-link-container a[data-external-link], .mobile-row-image, .tweet-preview-container"
  );
  if (storyLinks.length === 0) return;

  // Get current hostname for comparison
  const currentHostname = window.location.hostname;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const link = entry.target;
          let href = link.getAttribute("href");
          
          // For links with data-external-link, use that as the actual URL
          // This includes Cloudflare images which have internal href but external data-external-link
          if (link.hasAttribute("data-external-link")) {
            href = link.getAttribute("data-external-link");
          }

          if (!href) return;

          // Skip internal links UNLESS they have a data-external-link attribute
          // This allows Cloudflare images to be tracked
          if (!link.hasAttribute("data-external-link")) {
            if (
              href.startsWith("javascript:") ||
              href.startsWith("/") ||
              href.startsWith("#") ||
              href.startsWith("mailto:") ||
              href.startsWith("tel:") ||
              !href.includes("://")
            ) {
              return;
            }
          }

          // For URLs with protocol, check if they're external
          if (href.includes("://")) {
            try {
              const linkUrl = new URL(href);
              if (linkUrl.hostname === currentHostname) return;
            } catch (e) {
              return;
            }
          }

          // Check if this URL has already been tracked in this session
          const storageKey = `impression_${href}`;
          if (sessionStorage.getItem(storageKey)) return;

          // Mark this URL as tracked in this session
          sessionStorage.setItem(storageKey, "tracked");

          // Send impression beacon
          try {
            navigator.sendBeacon("/impression?url=" + encodeURIComponent(href));
          } catch (err) {
            console.log("Error tracking impression:", err);
          }

          // Stop observing this link
          observer.unobserve(link);
        }
      });
    },
    { threshold: 0.5 }, // Link must be 50% visible to count as an impression
  );

  storyLinks.forEach((link) => observer.observe(link));
}

async function start() {
  initFarcasterFrame()
    .then()
    .catch((err) => console.log(err));

  // Apply safe area insets for mini app context
  console.log("Starting applySafeAreaInsets...");
  applySafeAreaInsets()
    .then(() => console.log("applySafeAreaInsets completed"))
    .catch((err) => console.log("applySafeAreaInsets error:", err));

  const urlParams = new URL(window.location.href).searchParams;
  if (urlParams.get("miniapp") === "true") {
    sdk.actions.addFrame();
  }
  // Spinner overlay initialization
  if (!document.getElementById("spinner-overlay")) {
    const overlay = document.createElement("div");
    overlay.id = "spinner-overlay";
    overlay.style.display = "none";
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.background = "rgba(255,255,255,0.7)";
    overlay.style.zIndex = "9999";
    document.body.appendChild(overlay);
  }

  // Initialize link impression tracking
  trackLinkImpressions();
  
  // Initialize terminal ad animations
  initTerminalAds();

  // Track A/B test variant via PostHog
  if (window.location.pathname === "/" && typeof posthog !== "undefined") {
    const variantMeta = document.querySelector('meta[name="kiwi-variant"]');
    const variant = variantMeta?.content || "unknown";
    posthog?.capture?.("feed_page_view", { variant });
    console.log("caputred", variant);
  }
  // NOTE: There are clients which had the identity cookie sent to 1 week and
  // they're now encountering the paywall. So in case this happens but their
  // local storage contains the respective private key, we want them to reload
  // the page. See the logic in CustomConnectButton to follow this flow.
  const identity = getCookie("identity");
  window.initialIdentityCookie = identity;

  window.addEventListener("DOMContentLoaded", () => {
    initKiwiRotation(".hnname span img");
  });

  makeCommentsVisited();
  window.addEventListener("hashchange", makeCommentsVisited);
  window.addEventListener("beforeunload", makeUpvoteNotificationsVisited, {
    once: true,
  });

  updateLinkTargetsForIOSPWA();

  // NOTE: We don't want pull to refresh for the submission page as this could
  // mess up the user's input on an accidential scroll motion.
  if (window.location.pathname !== "/submit") {
    PullToRefresh.init({
      mainElement: "body",
      // NOTE: If the user is searching in the search drawer, we don't want
      // them to accidentially reload the page
      shouldPullToRefresh: () =>
        !window.isSidebarOpen &&
        !window.drawerIsOpen &&
        !window.scrollY &&
        !document.documentElement.classList.contains("kiwi-ios-app"),
      onRefresh: () => {
        window.location.reload();
      },
    });
  }

  const toast = await addToaster();
  window.toast = toast;

  // Add the analytics consent banner
  await addAnalyticsConsent();

  // TestFlight QR code removed - no longer supported
  // await addTestFlightQR();

  const { fetchAllowList, fetchDelegations } = await import("./API.mjs");

  const cached = true;
  const allowlistPromise = fetchAllowList(cached);
  const delegationsPromise = fetchDelegations(cached);

  await startWatchAccount(await allowlistPromise, await delegationsPromise);

  const results0 = await Promise.allSettled([
    import("@rainbow-me/rainbowkit/styles.css"), // Load styles in parallel
    addDynamicComments(await allowlistPromise, await delegationsPromise, toast),
    addVotes(await allowlistPromise, await delegationsPromise, toast),
  ]);

  const results1 = await Promise.allSettled([
    addDynamicNavElements(),
    addInviteLink(toast),
    addStoryEmojiReactions(
      await allowlistPromise,
      await delegationsPromise,
      toast,
    ),
    addDecayingPriceLink(),
    addCommentInput(toast, await allowlistPromise, await delegationsPromise),
    addTGLink(await allowlistPromise),
    addEmailSubscriptionForm(
      await allowlistPromise,
      await delegationsPromise,
      toast,
    ),
    addModals(await allowlistPromise, await delegationsPromise, toast),
    addNFTPrice(),
    addKarmaElements(),
    addLeaderboardStats(await allowlistPromise, await delegationsPromise),
    addLeaderboardInteractions(),
    addMinuteCountdown(),
    addTutorialDrawers(),
    addEmbedDrawer(toast),
    addRewardsDrawer(),
    addAvatar(await allowlistPromise),
    addBackButton(),
    addDelegateButton(await allowlistPromise, await delegationsPromise, toast),
    addBuyButton(allowlistPromise, delegationsPromise, toast),
    addProfileDisplay(),
    addFriendBuyButton(toast, await allowlistPromise),
    addConnectedComponents(
      await allowlistPromise,
      await delegationsPromise,
      toast,
    ),
    addSubmitButton(await allowlistPromise, await delegationsPromise, toast),
    addAnalytics(await allowlistPromise),
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
  try {
    document.body.classList.add("react-loaded");
  } catch {}
}

start();
