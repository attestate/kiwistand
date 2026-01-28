//@format
import { extractArticle } from "./extract.mjs";
import { generateSpeech } from "./tts.mjs";

// Non-listenable domains
const nonListenableDomains = [
  // Social media (Twitter only - Farcaster handled via Neynar API)
  "x.com",
  "twitter.com",
  "xcancel.com",
  "nitter.net",
  "nitter.it",
  "nitter.at",
  "nitter.poast.org",
  // Video
  "youtube.com",
  "youtu.be",
  "m.youtube.com",
  // Code / markets
  "github.com",
  "polymarket.com",
  // Image CDNs
  "imagedelivery.net",
  "imgur.com",
  "i.imgur.com",
  "cloudinary.com",
  "imgbb.com",
  "pbs.twimg.com",
  "media.tenor.com",
  "giphy.com",
];

// Image/media file extensions
const nonListenableExtensions = [
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".bmp",
  ".mp4", ".webm", ".mov", ".avi", ".mp3", ".wav", ".ogg",
  ".pdf",
];

function isListenableUrl(href) {
  if (!href) return false;
  if (href.startsWith("data:")) return false;
  try {
    const url = new URL(href);
    // Check blocked domains
    const isBlockedDomain = nonListenableDomains.some(
      (d) => url.hostname === d || url.hostname.endsWith(`.${d}`),
    );
    if (isBlockedDomain) return false;
    // Check file extensions (case-insensitive)
    const pathname = url.pathname.toLowerCase();
    const hasBlockedExt = nonListenableExtensions.some((ext) => pathname.endsWith(ext));
    if (hasBlockedExt) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Pre-generate TTS audio for a story (fire-and-forget)
 * Called when new stories are submitted
 */
export async function generateTTS(storyIndex, href) {
  // Skip non-listenable URLs
  if (!isListenableUrl(href)) {
    console.log(`TTS skip: ${storyIndex} - URL not listenable`);
    return;
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  if (!apiKey || !voiceId) {
    console.log(`TTS skip: ${storyIndex} - ElevenLabs not configured`);
    return;
  }

  try {
    // Check cache first
    const cached = await generateSpeech(null, apiKey, voiceId, storyIndex);
    if (cached.cached) {
      console.log(`TTS pre-gen: ${storyIndex} - already cached`);
      return;
    }
  } catch {
    // Cache miss - continue to generate
  }

  console.log(`TTS pre-gen: ${storyIndex} - extracting article...`);
  const article = await extractArticle(href);

  if (article.plainText.length > 50000) {
    console.log(`TTS skip: ${storyIndex} - article too long`);
    return;
  }

  console.log(`TTS pre-gen: ${storyIndex} - generating audio...`);
  await generateSpeech(article.plainText, apiKey, voiceId, storyIndex);
  console.log(`TTS pre-gen: ${storyIndex} - complete`);
}
