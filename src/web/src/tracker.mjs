// @format
import { messageFab, toDigest, send } from "./API.mjs";
import { getCookie, getLocalAccount } from "./session.mjs";
import { Wallet } from "@ethersproject/wallet";

// Queue for batching interactions
let impressionQueue = [];
let clickQueue = [];
let batchTimer = null;
let isProcessing = false;

// Configuration
const BATCH_INTERVAL = 5000; // Send batch every 5 seconds
const MAX_BATCH_SIZE = 50; // Maximum items per batch

// Track which content has been impressed to avoid duplicates in this session
const sessionImpressions = new Set();

// Track content IDs where comment sections are open (should not be greyed out)
const openCommentSections = new Set();

// Store the signer that will be passed from main.jsx
let globalSigner = null;
let globalIdentity = null;

// Track if already initialized to prevent multiple initializations
let isInitialized = false;

// Optionally include Farcaster Quick Auth JWT for mini apps
async function getAuthHeadersIfAvailable() {
  try {
    if (window.sdk && window.sdk.quickAuth && typeof window.sdk.quickAuth.getToken === 'function') {
      const tokenResponse = await window.sdk.quickAuth.getToken();
      const token = typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token;
      if (token) {
        return { Authorization: `Bearer ${token}` };
      }
    }
  } catch (err) {
    // Silently ignore token issues; EIP-712 flow will still work
  }
  return {};
}

// Resolve a stable identity for client-side storage/styling
// Prefers wallet identity; falls back to mini app FID when available
async function getEffectiveIdentity() {
  if (globalIdentity) return globalIdentity;
  try {
    if (window.sdk && window.sdk.context) {
      const ctx = await window.sdk.context;
      const fid = ctx?.user?.fid;
      if (fid) return `fid:${fid}`;
    }
  } catch (_) {}
  return null;
}

// Set the signer and identity (called from main.jsx after startWatchAccount)
export function setSigner(signer, identity) {
  const currentAddr = globalSigner?.address?.toLowerCase?.() ?? null;
  const nextAddr = signer?.address?.toLowerCase?.() ?? null;
  const same = currentAddr === nextAddr && globalIdentity === identity;

  if (same) {
    // Avoid noisy logs and unnecessary resets if nothing changed
    return;
  }

  globalSigner = signer;
  globalIdentity = identity;

  console.log("Tracker: Signer and identity set", {
    signer,
    hasS: !!signer,
    identity,
  });
}

// Create a signed interaction message
async function createInteractionMessage(
  contentId,
  contentType,
  interactionType,
) {
  // If we have a signer, use EIP-712 like Vote.jsx
  if (!globalSigner) {
    // If in a Farcaster Mini App with Quick Auth available, allow unsigned message
    // and rely on server-side JWT validation.
    const authHeaders = await getAuthHeadersIfAvailable();
    const hasJwt = !!authHeaders.Authorization;
    if (!hasJwt) {
      // No signer and no JWT → skip
      return null;
    }
  }

  // Use the standard messageFab to create the message
  // This ensures we're using the same structure as the rest of the app
  const API = await import("./API.mjs");
  const title = `${interactionType}-${contentType}`; // e.g., "impression-submission"
  const href = contentId; // The content being interacted with
  const type = interactionType; // "impression" or "click"
  
  // Use messageFab to create the message with proper structure
  const message = API.messageFab(title, href, type);

  // If a signer is available, sign like Vote.jsx. Otherwise, omit signature
  // and let the backend accept JWT-authenticated interactions.
  let signature = undefined;
  if (globalSigner) {
    signature = await globalSigner._signTypedData(
      API.EIP712_DOMAIN,
      API.EIP712_TYPES,
      message,
    );
  }

  return {
    contentId,
    contentType,
    message,
    signature,
  };
}

// Add an impression to the queue
export async function trackImpression(contentId, contentType = "submission") {
  // Skip if already impressed in this session
  const key = `${contentType}-${contentId}`;
  if (sessionImpressions.has(key)) {
    return;
  }

  const interaction = await createInteractionMessage(
    contentId,
    contentType,
    "impression",
  );
  if (!interaction) return;

  sessionImpressions.add(key);
  impressionQueue.push(interaction);

  // Start batch timer if not already running
  scheduleBatch();
}

// Add a click to the queue
export async function trackClick(contentId, contentType = "submission") {
  // Update UI immediately before any async operations
  const timestamp = Date.now();

  // Apply styling immediately to this item (only on / and /new pages)
  try {
    const currentPath = window.location.pathname;
    if (currentPath === "/" || currentPath === "/new") {
      // Remove all last-clicked first
      document.querySelectorAll(".last-clicked").forEach((el) => {
        el.classList.remove("last-clicked");
      });

      const contentElement = document.querySelector(
        `[data-content-id="${contentId}"]`,
      );
      if (contentElement) {
        contentElement.classList.add("clicked-content");
        contentElement.classList.add("last-clicked");
        const linkContainer = contentElement.querySelector(
          ".story-link-container",
        );
        if (linkContainer) {
          linkContainer.classList.add("clicked-link");
        }
        // Disable hover effects
        disableHoverEffects(contentElement);
      }
    }
  } catch (err) {
    // non-fatal
  }

  // Persist to localStorage if we have an identity (wallet or mini app fid)
  try {
    const identityKey = await getEffectiveIdentity();
    if (identityKey) {
      const cached = localStorage.getItem(`interactions-${identityKey}`);
      let data = cached
        ? JSON.parse(cached)
        : { impressions: [], clicks: [], syncedAt: Date.now() };
      if (!data.clicks) data.clicks = [];
      data.clicks.push({
        content_id: contentId,
        content_type: contentType,
        timestamp: timestamp,
      });
      localStorage.setItem(
        `interactions-${identityKey}`,
        JSON.stringify(data),
      );
    }
  } catch (error) {
    console.error("Error updating localStorage with click:", error);
  }
  
  // Now do the async operations for server sync
  const interaction = await createInteractionMessage(
    contentId,
    contentType,
    "click",
  );
  if (!interaction) return;

  clickQueue.push(interaction);

  // Start batch timer if not already running
  scheduleBatch();
}

// Schedule batch sending
function scheduleBatch() {
  if (batchTimer || isProcessing) return;

  batchTimer = setTimeout(() => {
    sendBatch();
    batchTimer = null;
  }, BATCH_INTERVAL);
}

// Send the batch to the server
async function sendBatch() {
  if (isProcessing) return;

  // Check if we have anything to send
  if (impressionQueue.length === 0 && clickQueue.length === 0) {
    return;
  }

  isProcessing = true;

  // Take items from queues (up to MAX_BATCH_SIZE each)
  const impressions = impressionQueue.splice(0, MAX_BATCH_SIZE);
  const clicks = clickQueue.splice(0, MAX_BATCH_SIZE);

  try {
    const authHeaders = await getAuthHeadersIfAvailable();
    const response = await fetch("/api/v1/interactions/batch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({
        impressions,
        clicks,
      }),
      keepalive: true, // Ensure the request completes even if page unloads
    });

    const result = await response.json();

    if (result.status === "success") {
      console.log(
        `Sent ${impressions.length} impressions and ${clicks.length} clicks`,
      );
    } else {
      console.error("Failed to send interactions:", result);
      // Re-queue failed items
      impressionQueue.unshift(...impressions);
      clickQueue.unshift(...clicks);
    }
  } catch (error) {
    console.error("Error sending interactions batch:", error);
    // Re-queue failed items
    impressionQueue.unshift(...impressions);
    clickQueue.unshift(...clicks);
  } finally {
    isProcessing = false;

    // If there are more items, schedule another batch
    if (impressionQueue.length > 0 || clickQueue.length > 0) {
      scheduleBatch();
    }
  }
}

// Send any remaining interactions before page unload
export function flushInteractions() {
  if (impressionQueue.length === 0 && clickQueue.length === 0) {
    return;
  }

  // Cancel any pending timer
  if (batchTimer) {
    clearTimeout(batchTimer);
    batchTimer = null;
  }

  // Use sendBeacon for reliability on page unload
  const data = JSON.stringify({
    impressions: impressionQueue,
    clicks: clickQueue,
  });

  (async () => {
    try {
      const authHeaders = await getAuthHeadersIfAvailable();
      if (authHeaders.Authorization) {
        // Use fetch with keepalive to include auth header
        await fetch("/api/v1/interactions/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: data,
          keepalive: true,
        });
      } else if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/v1/interactions/batch", data);
      } else {
        // Fallback to fetch without auth
        await fetch("/api/v1/interactions/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: data,
          keepalive: true,
        });
      }
      console.log(
        `Flushed ${impressionQueue.length} impressions and ${clickQueue.length} clicks`,
      );
    } catch (e) {
      // Swallow
    }
  })();

  // Clear queues
  impressionQueue = [];
  clickQueue = [];
}

// Set up Intersection Observer for automatic impression tracking
let observer = null;

export function setupImpressionTracking() {
  if (observer) return; // Already set up

  // Create intersection observer
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const element = entry.target;
          const contentId = element.dataset.contentId;
          const contentType = element.dataset.contentType || "submission";

          if (contentId) {
            trackImpression(contentId, contentType);
          }
        }
      });
    },
    {
      threshold: 0.5, // Trigger when 50% visible
      rootMargin: "0px",
    },
  );

  // Observe all trackable elements
  observeElements();
}

// Find and observe trackable elements
function observeElements() {
  if (!observer) return;

  // Find all elements with data-content-id attribute
  const elements = document.querySelectorAll("[data-content-id]");
  elements.forEach((element) => {
    observer.observe(element);
  });
}

// Set up click tracking
export function setupClickTracking() {
  // Use event delegation on document body with capture to get it early
  document.body.addEventListener(
    "click",
    (event) => {
      // Check if this click was already tracked
      if (event._trackerProcessed) return;

      // Find the clicked element
      const clickedElement = event.target;
      
      // Check if user clicked on a comment-related element (comment button, preview, or chat bubble)
      const isCommentClick = clickedElement.closest(".comment-button, .comment-preview, .comment-button-container, .chat-bubble, .comment-section");
      
      if (isCommentClick) {
        // Find the parent row/content element
        const contentRow = clickedElement.closest("[data-content-id]");
        if (contentRow) {
          const contentId = contentRow.dataset.contentId;
          
          // Track that this comment section is open
          openCommentSections.add(contentId);
          
          // Remove the greyed-out styling when opening comments
          // This removes the CSS classes but keeps the data in localStorage
          contentRow.classList.remove("clicked-content");
          const linkContainer = contentRow.querySelector(".story-link-container");
          if (linkContainer) {
            linkContainer.classList.remove("clicked-link");
          }
        }
        return; // Don't track this as a regular click
      }

      // Ignore clicks on share UI so shares don't mark items as read
      // Covers: native share button + dropdown, and Farcaster share button
      const isShareClick = clickedElement.closest(
        
        ".share-button, .share-button-container, .share-dropdown, .share-dropdown-item, .farcaster-share-button, .farcaster-share-button-container, .share-link"
      );
      if (isShareClick) {
        return; // Do not track shares as clicks/read
      }

      // Check if we clicked on a clickable element (link, button, etc.)
      const isClickable = clickedElement.closest("a, button, [role='button']");
      if (!isClickable) return;

      // Find the closest trackable element from the clicked position
      const trackableElement = clickedElement.closest("[data-content-id]");

      if (trackableElement) {
        const contentId = trackableElement.dataset.contentId;
        const contentType =
          trackableElement.dataset.contentType || "submission";

        if (contentId) {
          // Mark this event as processed to prevent double tracking
          event._trackerProcessed = true;
          trackClick(contentId, contentType);
        }
      }
    },
    false,
  ); // Use bubbling phase (false) instead of capture
}

// Sync user interactions from server
export async function syncInteractions() {
  // Proceed if either we have a signer (EIP-712) or Quick Auth (JWT)
  const authHeaders = await getAuthHeadersIfAvailable();
  const hasJwt = !!authHeaders.Authorization;
  if (!globalSigner && !hasJwt) {
    console.log("No signer or Quick Auth for syncing interactions");
    return null;
  }

  try {
    // Create a sync message
    const { messageFab } = await import("./API.mjs");
    const message = messageFab("sync", "sync", "sync");

    const { EIP712_DOMAIN, EIP712_TYPES } = await import("./API.mjs");
    let signature = undefined;
    if (globalSigner) {
      signature = await globalSigner._signTypedData(
        EIP712_DOMAIN,
        EIP712_TYPES,
        message,
      );
    }

    // Fetch user's interaction history
    const params = new URLSearchParams({
      message: JSON.stringify(message),
      signature,
    });

    const response = await fetch(`/api/v1/interactions/sync?${params}`, {
      headers: { ...authHeaders },
    });
    const result = await response.json();

    if (result.status === "success") {
      const { impressions, clicks } = result.data;

      // Store in localStorage for offline access
      localStorage.setItem(
        `interactions-${globalIdentity}`,
        JSON.stringify({ impressions, clicks, syncedAt: Date.now() }),
      );

      // Add to session impressions to avoid re-tracking
      impressions.forEach((imp) => {
        sessionImpressions.add(`${imp.content_type}-${imp.content_id}`);
      });

      console.log(
        `Synced ${impressions.length} impressions and ${clicks.length} clicks`,
      );
      return result.data;
    } else {
      console.error("Failed to sync interactions:", result);
      return null;
    }
  } catch (error) {
    console.error("Error syncing interactions:", error);
    return null;
  }
}

// Load cached interactions from localStorage
export function loadCachedInteractions() {
  // Try wallet identity; fall back to fid identity
  // Note: this function is synchronous; if identity isn't ready yet, return null
  if (!globalIdentity) return null;

  try {
    const cached = localStorage.getItem(`interactions-${globalIdentity}`);
    if (cached) {
      const data = JSON.parse(cached);

      // Add to session impressions
      if (data.impressions) {
        data.impressions.forEach((imp) => {
          sessionImpressions.add(`${imp.content_type}-${imp.content_id}`);
        });
      }

      return data;
    }
  } catch (error) {
    console.error("Error loading cached interactions:", error);
  }

  return null;
}

// Get clicked content IDs from localStorage
export function getClickedContentIds() {
  if (!globalIdentity) return new Set();

  try {
    const cached = localStorage.getItem(`interactions-${globalIdentity}`);
    if (cached) {
      const data = JSON.parse(cached);
      const clickedIds = new Set();
      
      if (data.clicks) {
        data.clicks.forEach((click) => {
          clickedIds.add(click.content_id);
        });
      }
      
      return clickedIds;
    }
  } catch (error) {
    console.error("Error getting clicked content IDs:", error);
  }

  return new Set();
}

// Get content IDs that have been impressed multiple times
export function getFrequentlyImpressedContentIds(threshold = 3) {
  if (!globalIdentity) return new Set();

  try {
    const cached = localStorage.getItem(`interactions-${globalIdentity}`);
    if (cached) {
      const data = JSON.parse(cached);
      if (!data.impressions || data.impressions.length === 0) {
        return new Set();
      }

      const impressionCounts = new Map();
      data.impressions.forEach(impression => {
        const count = impressionCounts.get(impression.content_id) || 0;
        impressionCounts.set(impression.content_id, count + 1);
      });

      const frequentlyImpressedIds = new Set();
      for (const [contentId, count] of impressionCounts.entries()) {
        if (count >= threshold) {
          frequentlyImpressedIds.add(contentId);
        }
      }
      
      return frequentlyImpressedIds;
    }
  } catch (error) {
    console.error("Error getting frequently impressed content IDs:", error);
  }

  return new Set();
}

// Apply greyed-out styling to clicked rows
export function applyClickedStyling() {
  // Only apply styling on / and /new pages
  const currentPath = window.location.pathname;
  if (currentPath !== "/" && currentPath !== "/new") {
    return;
  }
  
  const clickedIds = getClickedContentIds();
  
  if (clickedIds.size === 0) {
    return;
  }
  
  // Find all content rows with data-content-id
  const contentRows = document.querySelectorAll("[data-content-id]");
  
  // Find the most recently clicked item from the synced data
  let lastClickedId = null;
  let lastClickedTime = 0;
  
  if (globalIdentity) {
    try {
      const cached = localStorage.getItem(`interactions-${globalIdentity}`);
      if (cached) {
        const data = JSON.parse(cached);
        if (data.clicks && data.clicks.length > 0) {
          // Find the click with the most recent timestamp
          data.clicks.forEach(click => {
            const clickTime = click.timestamp || 0;
            if (clickTime > lastClickedTime) {
              lastClickedTime = clickTime;
              lastClickedId = click.content_id;
            }
          });
        }
      }
    } catch (error) {
      console.error("Error finding last clicked item:", error);
    }
  }
  
  // First, remove all existing last-clicked classes to ensure only one exists
  document.querySelectorAll(".last-clicked").forEach(el => {
    el.classList.remove("last-clicked");
  });
  
  contentRows.forEach((row) => {
    const contentId = row.dataset.contentId;
    
    // Skip if comment section is open for this content
    if (openCommentSections.has(contentId)) {
      return;
    }
    
    if (clickedIds.has(contentId)) {
      // Add a class to indicate this row has been clicked
      row.classList.add("clicked-content");
      
      // Add last-clicked class if this is the most recent
      if (contentId === lastClickedId) {
        row.classList.add("last-clicked");
      }
      
      // Also mark the link container if it exists
      const linkContainer = row.querySelector(".story-link-container");
      if (linkContainer) {
        linkContainer.classList.add("clicked-link");
      }
      
      // Disable hover effects by storing original handlers and preventing them
      disableHoverEffects(row);
    }
  });
}

// Disable hover effects on a specific element
function disableHoverEffects(element) {
  // Store original background color
  const originalBg = element.style.backgroundColor || "";
  
  // Override mouseover/mouseenter to prevent background changes
  element.addEventListener("mouseover", function(e) {
    if (this.classList.contains("clicked-content")) {
      e.stopPropagation();
      this.style.backgroundColor = originalBg;
    }
  }, true);
  
  element.addEventListener("mouseenter", function(e) {
    if (this.classList.contains("clicked-content")) {
      e.stopPropagation();
      this.style.backgroundColor = originalBg;
    }
  }, true);
  
  // Ensure background stays consistent on mouseout too
  element.addEventListener("mouseout", function(e) {
    if (this.classList.contains("clicked-content")) {
      this.style.backgroundColor = originalBg;
    }
  }, true);
}

// Remove clicked styling from a specific content item
export function removeClickedStyling(contentId) {
  // Remove visual styling
  const contentElement = document.querySelector(`[data-content-id="${contentId}"]`);
  if (contentElement) {
    contentElement.classList.remove("clicked-content");
    const linkContainer = contentElement.querySelector(".story-link-container");
    if (linkContainer) {
      linkContainer.classList.remove("clicked-link");
    }
  }
  
  // Remove from localStorage
  if (globalIdentity) {
    try {
      const cached = localStorage.getItem(`interactions-${globalIdentity}`);
      if (cached) {
        const data = JSON.parse(cached);
        if (data.clicks) {
          data.clicks = data.clicks.filter(click => click.content_id !== contentId);
          localStorage.setItem(`interactions-${globalIdentity}`, JSON.stringify(data));
        }
      }
    } catch (error) {
      console.error("Error removing click from localStorage:", error);
    }
  }
}

// Initialize tracking when DOM is ready
// Now accepts signer and identity from main.jsx
export function initializeTracking(signer = null, identity = null) {
  // Prevent multiple initializations
  if (isInitialized) {
    // If we're just updating the signer, do that without re-initializing everything
    if (signer && identity) {
      setSigner(signer, identity);
    }
    console.log("Tracker already initialized, skipping re-initialization");
    return;
  }
  
  isInitialized = true;
  
  // Set the signer if provided
  if (signer && identity) {
    setSigner(signer, identity);
  }

  // If no wallet identity, try to derive a mini app identity from FID
  if (!globalIdentity) {
    (async () => {
      try {
        if (window.sdk && window.sdk.context) {
          const ctx = await window.sdk.context;
          const fid = ctx?.user?.fid;
          if (fid) {
            setSigner(null, `fid:${fid}`);
            // Re-load cached interactions and re-apply styling once identity is known
            loadCachedInteractions();
            applyClickedStyling();
          }
        }
      } catch (_) {}
    })();
  }

  // Set up automatic tracking
  setupImpressionTracking();
  setupClickTracking();
  
  // Listen for comment section toggle events
  // This handles when comment sections are opened/closed via the custom event
  const handleCommentToggle = (event) => {
    const match = event.type.match(/open-comments-(\d+)/);
    if (match) {
      const storyIndex = match[1];
      // Find the content row associated with this story
      const contentRow = document.querySelector(`[data-content-id]`);
      if (contentRow) {
        const contentId = contentRow.dataset.contentId;
        
        // Check if we're opening or closing (toggle state)
        if (openCommentSections.has(contentId)) {
          // Was open, now closing
          openCommentSections.delete(contentId);
          // Re-apply styling if this item was clicked
          applyClickedStyling();
        } else {
          // Was closed, now opening
          openCommentSections.add(contentId);
          // Remove styling
          contentRow.classList.remove("clicked-content");
          const linkContainer = contentRow.querySelector(".story-link-container");
          if (linkContainer) {
            linkContainer.classList.remove("clicked-link");
          }
        }
      }
    }
  };
  
  // Monitor DOM for story elements and add listeners
  const observedStoryIndices = new Set();
  const checkForStoryElements = () => {
    document.querySelectorAll('[data-story-index], .chat-bubble').forEach(el => {
      let storyIndex;
      if (el.dataset?.storyIndex) {
        storyIndex = el.dataset.storyIndex;
      } else if (el.id?.startsWith('chat-bubble-')) {
        storyIndex = el.id.replace('chat-bubble-', '');
      }
      
      if (storyIndex && !observedStoryIndices.has(storyIndex)) {
        observedStoryIndices.add(storyIndex);
        window.addEventListener(`open-comments-${storyIndex}`, handleCommentToggle);
      }
    });
  };

  // Load cached interactions
  loadCachedInteractions();
  
  // Apply greyed-out styling to clicked items
  applyClickedStyling();
  
  // Initial check for story elements
  checkForStoryElements();

  // Sync interactions from server (only if we have a signer and on / or /new pages)
  const currentPath = window.location.pathname;
  const shouldSync = currentPath === "/" || currentPath === "/new";
  
  if (globalSigner && shouldSync) {
    // Only sync on initial load, don't re-apply styling after sync
    // to avoid overwriting recent local changes
    syncInteractions();
  }

  // Set up page unload handler
  window.addEventListener("beforeunload", flushInteractions);
  window.addEventListener("pagehide", flushInteractions);

  // Re-observe elements when DOM changes (for dynamic content)
  const mutationObserver = new MutationObserver(() => {
    observeElements();
    checkForStoryElements();
    // Re-apply styling when new content is added
    applyClickedStyling();
  });

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });

  console.log("Interaction tracking initialized", {
    hasSigner: !!globalSigner,
    identity: globalIdentity,
  });
}

// Export for use in other modules
export default {
  setSigner,
  trackImpression,
  trackClick,
  flushInteractions,
  syncInteractions,
  loadCachedInteractions,
  getClickedContentIds,
  getFrequentlyImpressedContentIds,
  applyClickedStyling,
  removeClickedStyling,
  initializeTracking,
  setupImpressionTracking,
  setupClickTracking,
};
