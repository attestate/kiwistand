import { fetchCache as fetchCacheFactory } from "./utils.mjs";
import { fetchBuilder, FileSystemCache } from "node-fetch-cache";
import path from "path";
import { env } from "process";

const fetchCache = new FileSystemCache({
  cacheDirectory: path.resolve(env.CACHE_DIR, "youtube-api"),
  ttl: 86400000, // 24 hours
});

const fetch = fetchBuilder.withCache(fetchCache);
const fetchStaleWhileRevalidate = fetchCacheFactory(fetch, fetchCache);

const API_BASE_URL = "https://www.googleapis.com/youtube/v3";
const API_KEY = process.env.YOUTUBE_API_KEY;

export async function getVideoMetadata(videoId) {
  if (!API_KEY) {
    console.warn("YouTube API key not configured, falling back to basic metadata");
    return null;
  }

  try {
    const url = `${API_BASE_URL}/videos?part=snippet,contentDetails,statistics&id=${videoId}&key=${API_KEY}`;
    
    const response = await fetchStaleWhileRevalidate(url, {
      headers: {
        "User-Agent": process.env.USER_AGENT || "KiwiNewsBot/1.0 (https://news.kiwistand.com)",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.error(`YouTube API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      return null;
    }

    const video = data.items[0];
    const snippet = video.snippet;
    const statistics = video.statistics;
    const contentDetails = video.contentDetails;

    return {
      title: snippet.title,
      description: snippet.description,
      thumbnail: getBestThumbnail(snippet.thumbnails),
      channelTitle: snippet.channelTitle,
      publishedAt: snippet.publishedAt,
      duration: parseDuration(contentDetails.duration),
      viewCount: statistics.viewCount ? parseInt(statistics.viewCount) : 0,
      likeCount: statistics.likeCount ? parseInt(statistics.likeCount) : 0,
      embedAllowed: contentDetails.contentRating?.ytRating !== "ytAgeRestricted",
    };
  } catch (error) {
    console.error("Error fetching YouTube metadata:", error);
    return null;
  }
}

function getBestThumbnail(thumbnails) {
  // Priority: maxresdefault > standard > high > medium > default
  const priority = ["maxresdefault", "standard", "high", "medium", "default"];
  
  for (const size of priority) {
    if (thumbnails[size]?.url) {
      return thumbnails[size].url;
    }
  }
  
  return null;
}

function parseDuration(duration) {
  // Convert ISO 8601 duration to seconds
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  if (!match) return 0;
  
  const hours = (parseInt(match[1]) || 0);
  const minutes = (parseInt(match[2]) || 0);
  const seconds = (parseInt(match[3]) || 0);
  
  return hours * 3600 + minutes * 60 + seconds;
}

export function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function getEmbedUrl(videoId) {
  return `https://www.youtube.com/embed/${videoId}`;
}