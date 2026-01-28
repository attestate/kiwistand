//@format
import fs from "node:fs";
import path from "node:path";

// Cache of domains that have failed extraction (bot blocking, etc.)
// Format: Map<domain, timestamp>
const failedDomains = new Map();

// Cache of story indices that have failed extraction (content too short, etc.)
// Format: Map<storyIndex, timestamp>
const failedStories = new Map();

// How long to remember a failed domain (24 hours)
const FAILURE_TTL_MS = 24 * 60 * 60 * 1000;

// File to persist failed domains/stories across restarts
const DATA_DIR = process.env.DATA_DIR || "data";
const CACHE_FILE = path.join(process.cwd(), DATA_DIR, "listen-failed-domains.json");
const STORIES_CACHE_FILE = path.join(process.cwd(), DATA_DIR, "listen-failed-stories.json");

// Load failed domains and stories from disk on startup
export function initFailedDomains() {
  // Load failed domains
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
      const now = Date.now();
      let loaded = 0;
      for (const [domain, timestamp] of Object.entries(data)) {
        if (now - timestamp < FAILURE_TTL_MS) {
          failedDomains.set(domain, timestamp);
          loaded++;
        }
      }
      console.log(`Listen failed domains loaded: ${loaded} entries`);
    }
  } catch (err) {
    console.error("Listen failed domains load error:", err.message);
  }

  // Load failed stories
  try {
    if (fs.existsSync(STORIES_CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STORIES_CACHE_FILE, "utf-8"));
      const now = Date.now();
      let loaded = 0;
      for (const [storyIndex, timestamp] of Object.entries(data)) {
        if (now - timestamp < FAILURE_TTL_MS) {
          failedStories.set(storyIndex, timestamp);
          loaded++;
        }
      }
      console.log(`Listen failed stories loaded: ${loaded} entries`);
    }
  } catch (err) {
    console.error("Listen failed stories load error:", err.message);
  }
}

// Save failed domains to disk
function saveFailedDomains() {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const data = Object.fromEntries(failedDomains);
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Listen failed domains save error:", err.message);
  }
}

// Save failed stories to disk
function saveFailedStories() {
  try {
    const dir = path.dirname(STORIES_CACHE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const data = Object.fromEntries(failedStories);
    fs.writeFileSync(STORIES_CACHE_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Listen failed stories save error:", err.message);
  }
}

// Mark a domain as failed
export function markDomainFailed(url) {
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname;
    failedDomains.set(domain, Date.now());
    saveFailedDomains();
    console.log(`Listen: marked domain as failed: ${domain}`);
  } catch {
    // Invalid URL, ignore
  }
}

// Check if a domain has failed recently
export function isDomainFailed(url) {
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname;
    const timestamp = failedDomains.get(domain);
    if (!timestamp) return false;
    if (Date.now() - timestamp >= FAILURE_TTL_MS) {
      failedDomains.delete(domain);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// Mark a story as failed (e.g., content too short)
export function markStoryFailed(storyIndex) {
  if (!storyIndex) return;
  failedStories.set(storyIndex, Date.now());
  saveFailedStories();
  console.log(`Listen: marked story as failed: ${storyIndex}`);
}

// Check if a story has failed recently
export function isStoryFailed(storyIndex) {
  if (!storyIndex) return false;
  const timestamp = failedStories.get(storyIndex);
  if (!timestamp) return false;
  if (Date.now() - timestamp >= FAILURE_TTL_MS) {
    failedStories.delete(storyIndex);
    return false;
  }
  return true;
}

// Get list of currently failed domains (for debugging)
export function getFailedDomains() {
  const now = Date.now();
  const result = [];
  for (const [domain, timestamp] of failedDomains) {
    if (now - timestamp < FAILURE_TTL_MS) {
      result.push({ domain, failedAt: new Date(timestamp).toISOString() });
    }
  }
  return result;
}

// Get list of currently failed stories (for debugging)
export function getFailedStories() {
  const now = Date.now();
  const result = [];
  for (const [storyIndex, timestamp] of failedStories) {
    if (now - timestamp < FAILURE_TTL_MS) {
      result.push({ storyIndex, failedAt: new Date(timestamp).toISOString() });
    }
  }
  return result;
}
