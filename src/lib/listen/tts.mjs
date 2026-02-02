//@format
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { LRUCache } from "lru-cache";

// Use data directory for cache, consistent with other Kiwi data
const DATA_DIR = process.env.DATA_DIR || "data";
const CACHE_DIR = path.join(process.cwd(), DATA_DIR, "listen-cache");

// Maximum characters per chunk - ElevenLabs supports up to 10k
const MAX_CHUNK_SIZE = 10000;
// First chunk is small for fast initial playback (~2-3s instead of 10-20s)
const FIRST_CHUNK_SIZE = 1000;

// LRU cache for TTS metadata - audio files stay on disk, this is just the index
const cache = new LRUCache({
  max: 1000, // Max 1000 TTS entries in memory
  maxSize: 100 * 1024 * 1024, // 100MB max for timestamps arrays
  sizeCalculation: (value) => {
    // Estimate: timestamps array is the main memory consumer
    return JSON.stringify(value).length;
  },
});

// Track in-progress background generations: audioId -> { completed, total, timestamps, cacheKey }
const pendingGenerations = new Map();

export function initCache() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  // Load existing cache entries from disk on startup
  try {
    const files = fs.readdirSync(CACHE_DIR);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const meta = JSON.parse(
        fs.readFileSync(path.join(CACHE_DIR, file), "utf-8"),
      );

      // Check for new chunk-based format
      if (meta.chunks && meta.chunks.length > 0) {
        // Verify all chunk files exist
        let allChunksExist = true;
        for (let i = 0; i < meta.chunks.length; i++) {
          const chunkPath = path.join(CACHE_DIR, `${meta.audioId}_${i}.mp3`);
          if (!fs.existsSync(chunkPath)) {
            allChunksExist = false;
            break;
          }
        }
        if (allChunksExist) {
          const key = meta.cacheKey || meta.textHash;
          cache.set(key, meta);
        }
      } else {
        // Legacy single-file format - check if audio file exists
        const audioPath = path.join(CACHE_DIR, `${meta.audioId}.mp3`);
        if (fs.existsSync(audioPath)) {
          const key = meta.cacheKey || meta.textHash;
          cache.set(key, meta);
        }
      }
    }
    console.log(`Listen cache loaded: ${cache.size} entries`);
  } catch (err) {
    console.error("Listen cache load error:", err.message);
  }
}

function hashText(text) {
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
}

export async function generateSpeech(text, apiKey, voiceId, storyIndex) {
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set");
  if (!voiceId) throw new Error("ELEVENLABS_VOICE_ID is not set");

  // Use story index as cache key if provided, otherwise fall back to text hash
  const cacheKey = storyIndex || (text ? hashText(text) : null);
  if (!cacheKey) throw new Error("No cache key available");

  // Return cached result if available
  const cachedEntry = cache.get(cacheKey);
  if (cachedEntry) {
    console.log(`Listen cache hit for ${cacheKey}`);
    // Handle both new chunk-based format and legacy single-file format
    if (cachedEntry.chunks) {
      // Reconstruct audioUrl for each chunk (not stored on disk)
      const chunksWithUrls = cachedEntry.chunks.map((chunk, i) => ({
        ...chunk,
        audioUrl: `/api/v1/listen/audio/${cachedEntry.audioId}_${i}`,
      }));
      return {
        audioId: cachedEntry.audioId,
        chunks: chunksWithUrls,
        timestamps: cachedEntry.timestamps,
        totalDuration: cachedEntry.totalDuration,
        cached: true,
      };
    }
    // Legacy format - convert to chunk-based response
    const duration =
      cachedEntry.timestamps.length > 0
        ? cachedEntry.timestamps[cachedEntry.timestamps.length - 1].end
        : 0;
    return {
      audioId: cachedEntry.audioId,
      chunks: [
        {
          audioUrl: `/api/v1/listen/audio/${cachedEntry.audioId}`,
          duration,
          startTime: 0,
          endTime: duration,
          startWord: 0,
          endWord: cachedEntry.timestamps.length - 1,
        },
      ],
      timestamps: cachedEntry.timestamps,
      totalDuration: duration,
      cached: true,
    };
  }

  // If no text provided, this was just a cache check
  if (!text) {
    throw new Error("Cache miss and no text provided");
  }

  console.log(`Listen cache miss for ${cacheKey}, calling ElevenLabs...`);
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  const textChunks = chunkText(text, MAX_CHUNK_SIZE);
  console.log(`Listen: generating ${textChunks.length} chunks in parallel...`);

  // Process all chunks in parallel for speed
  const chunkResults = await Promise.all(
    textChunks.map(async (chunk, i) => {
      console.log(`Listen: starting chunk ${i + 1}/${textChunks.length}`);
      const result = await callElevenLabs(chunk, apiKey, voiceId);
      console.log(`Listen: completed chunk ${i + 1}/${textChunks.length}`);
      return {
        audioBuffer: Buffer.from(result.audio_base64, "base64"),
        alignment: result.alignment,
        words: chunk.split(/\s+/),
      };
    }),
  );

  const audioId = crypto.randomBytes(8).toString("hex");

  // Save each chunk as a separate file and build chunk metadata
  const chunks = [];
  const allTimestamps = [];
  let globalTimeOffset = 0;
  let wordOffset = 0;

  for (let i = 0; i < chunkResults.length; i++) {
    const result = chunkResults[i];

    // Save chunk to separate file
    const chunkPath = path.join(CACHE_DIR, `${audioId}_${i}.mp3`);
    fs.writeFileSync(chunkPath, result.audioBuffer);
    console.log(
      `Listen: chunk ${i + 1} saved: ${result.audioBuffer.length} bytes`,
    );

    // Calculate word timestamps for this chunk (local time, then offset)
    const wordTimestamps = mapCharToWordTimestamps(
      result.alignment,
      result.words,
      wordOffset,
      globalTimeOffset,
    );

    // Calculate chunk duration from timestamps
    let chunkDuration = 0;
    if (wordTimestamps.length > 0) {
      const lastTs = wordTimestamps[wordTimestamps.length - 1];
      // Chunk duration is from start of this chunk to end of last word
      chunkDuration = lastTs.end - globalTimeOffset;
    }

    const startWord = wordOffset;
    const endWord = wordOffset + result.words.length - 1;

    chunks.push({
      audioUrl: `/api/v1/listen/audio/${audioId}_${i}`,
      duration: chunkDuration,
      startTime: globalTimeOffset,
      endTime: globalTimeOffset + chunkDuration,
      startWord,
      endWord,
    });

    allTimestamps.push(...wordTimestamps);

    wordOffset += result.words.length;
    globalTimeOffset += chunkDuration;

    console.log(
      `Listen: chunk ${i + 1} ends at ${globalTimeOffset.toFixed(1)}s`,
    );
  }

  const totalDuration = globalTimeOffset;
  console.log(
    `Listen: ${chunks.length} chunks saved, total duration: ${totalDuration.toFixed(1)}s`,
  );

  // Persist cache entry to disk with new chunk-based format
  const meta = {
    cacheKey,
    audioId,
    chunks: chunks.map((c) => ({
      duration: c.duration,
      startTime: c.startTime,
      endTime: c.endTime,
      startWord: c.startWord,
      endWord: c.endWord,
    })),
    timestamps: allTimestamps,
    totalDuration,
  };
  fs.writeFileSync(
    path.join(CACHE_DIR, `${cacheKey}.json`),
    JSON.stringify(meta),
  );
  cache.set(cacheKey, meta);

  return { audioId, chunks, timestamps: allTimestamps, totalDuration, cached: false };
}

async function callElevenLabs(text, apiKey, voiceId) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_turbo_v2_5",
      output_format: "mp3_44100_128",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ElevenLabs API error ${res.status}: ${body}`);
  }

  return res.json();
}

function mapCharToWordTimestamps(alignment, words, wordOffset, timeOffset) {
  if (
    !alignment ||
    !alignment.characters ||
    !alignment.character_start_times_seconds
  ) {
    return [];
  }

  const {
    characters,
    character_start_times_seconds,
    character_end_times_seconds,
  } = alignment;
  const timestamps = [];
  let charIdx = 0;

  for (let w = 0; w < words.length; w++) {
    const word = words[w];
    while (charIdx < characters.length && characters[charIdx].trim() === "") {
      charIdx++;
    }

    const startCharIdx = charIdx;
    const endCharIdx = charIdx + word.length - 1;

    if (startCharIdx < characters.length && endCharIdx < characters.length) {
      timestamps.push({
        index: wordOffset + w,
        start: character_start_times_seconds[startCharIdx] + timeOffset,
        end: character_end_times_seconds[endCharIdx] + timeOffset,
      });
    }

    charIdx = endCharIdx + 1;
  }

  return timestamps;
}

function chunkText(text, maxLen) {
  if (text.length <= maxLen) return [text];

  const chunks = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }

    let splitAt = -1;
    for (let i = maxLen; i >= maxLen * 0.5; i--) {
      if (
        remaining[i] === "." ||
        remaining[i] === "!" ||
        remaining[i] === "?"
      ) {
        splitAt = i + 1;
        break;
      }
    }
    if (splitAt === -1) {
      splitAt = remaining.lastIndexOf(" ", maxLen);
    }
    if (splitAt === -1) {
      splitAt = maxLen;
    }

    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  return chunks;
}

// Progressive chunking: small first chunk for fast playback, normal size for rest
function chunkTextProgressive(text, firstChunkSize, maxLen) {
  if (text.length <= firstChunkSize) return [text];

  const chunks = [];
  let remaining = text;

  // First chunk: small for fast initial playback
  let splitAt = -1;
  for (let i = firstChunkSize; i >= firstChunkSize * 0.5; i--) {
    if (remaining[i] === "." || remaining[i] === "!" || remaining[i] === "?") {
      splitAt = i + 1;
      break;
    }
  }
  if (splitAt === -1) {
    splitAt = remaining.lastIndexOf(" ", firstChunkSize);
  }
  if (splitAt === -1) {
    splitAt = firstChunkSize;
  }

  chunks.push(remaining.slice(0, splitAt).trim());
  remaining = remaining.slice(splitAt).trim();

  // Rest: normal sized chunks
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }

    splitAt = -1;
    for (let i = maxLen; i >= maxLen * 0.5; i--) {
      if (remaining[i] === "." || remaining[i] === "!" || remaining[i] === "?") {
        splitAt = i + 1;
        break;
      }
    }
    if (splitAt === -1) {
      splitAt = remaining.lastIndexOf(" ", maxLen);
    }
    if (splitAt === -1) {
      splitAt = maxLen;
    }

    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  return chunks;
}

export function getAudioPath(audioId) {
  // Support both chunk format (audioId_chunkIndex) and legacy single-file format
  return path.join(CACHE_DIR, `${audioId}.mp3`);
}

// Progressive generation: generate chunk 0 first, return immediately, then generate remaining in background
export async function generateSpeechProgressive(
  text,
  apiKey,
  voiceId,
  storyIndex,
) {
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set");
  if (!voiceId) throw new Error("ELEVENLABS_VOICE_ID is not set");

  const cacheKey = storyIndex || (text ? hashText(text) : null);
  if (!cacheKey) throw new Error("No cache key available");

  // Return cached result if available
  const cachedEntry = cache.get(cacheKey);
  if (cachedEntry) {
    console.log(`Listen progressive: cache hit for ${cacheKey}`);
    const chunksWithUrls = cachedEntry.chunks.map((chunk, i) => ({
      ...chunk,
      audioUrl: `/api/v1/listen/audio/${cachedEntry.audioId}_${i}`,
    }));
    return {
      audioId: cachedEntry.audioId,
      chunks: chunksWithUrls,
      timestamps: cachedEntry.timestamps,
      totalDuration: cachedEntry.totalDuration,
      status: "complete",
      cached: true,
    };
  }

  if (!text) {
    throw new Error("Cache miss and no text provided");
  }

  console.log(`Listen progressive: cache miss for ${cacheKey}, starting generation...`);
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  // Use small first chunk for fast initial playback, then normal size for rest
  const textChunks = chunkTextProgressive(text, FIRST_CHUNK_SIZE, MAX_CHUNK_SIZE);
  const audioId = crypto.randomBytes(8).toString("hex");

  console.log(`Listen progressive: generating chunk 1/${textChunks.length}...`);

  // Generate first chunk immediately
  const firstResult = await callElevenLabs(textChunks[0], apiKey, voiceId);
  const firstAudioBuffer = Buffer.from(firstResult.audio_base64, "base64");
  const firstWords = textChunks[0].split(/\s+/);

  // Save first chunk
  const chunk0Path = path.join(CACHE_DIR, `${audioId}_0.mp3`);
  fs.writeFileSync(chunk0Path, firstAudioBuffer);
  console.log(`Listen progressive: chunk 1 saved: ${firstAudioBuffer.length} bytes`);

  // Calculate timestamps for first chunk
  const firstTimestamps = mapCharToWordTimestamps(
    firstResult.alignment,
    firstWords,
    0, // wordOffset
    0, // timeOffset
  );

  let chunk0Duration = 0;
  if (firstTimestamps.length > 0) {
    chunk0Duration = firstTimestamps[firstTimestamps.length - 1].end;
  }

  const chunk0 = {
    audioUrl: `/api/v1/listen/audio/${audioId}_0`,
    duration: chunk0Duration,
    startTime: 0,
    endTime: chunk0Duration,
    startWord: 0,
    endWord: firstWords.length - 1,
  };

  // If only one chunk, we're done
  if (textChunks.length === 1) {
    const meta = {
      cacheKey,
      audioId,
      chunks: [
        {
          duration: chunk0.duration,
          startTime: chunk0.startTime,
          endTime: chunk0.endTime,
          startWord: chunk0.startWord,
          endWord: chunk0.endWord,
        },
      ],
      timestamps: firstTimestamps,
      totalDuration: chunk0Duration,
    };
    fs.writeFileSync(
      path.join(CACHE_DIR, `${cacheKey}.json`),
      JSON.stringify(meta),
    );
    cache.set(cacheKey, meta);

    return {
      audioId,
      chunks: [chunk0],
      timestamps: firstTimestamps,
      totalDuration: chunk0Duration,
      status: "complete",
      cached: false,
    };
  }

  // Start background generation for remaining chunks (don't await)
  pendingGenerations.set(audioId, {
    completed: 1,
    total: textChunks.length,
    chunks: [
      {
        duration: chunk0.duration,
        startTime: chunk0.startTime,
        endTime: chunk0.endTime,
        startWord: chunk0.startWord,
        endWord: chunk0.endWord,
      },
    ],
    timestamps: firstTimestamps,
    wordOffset: firstWords.length,
    timeOffset: chunk0Duration,
    cacheKey,
  });

  generateRemainingChunks(
    textChunks.slice(1),
    apiKey,
    voiceId,
    audioId,
    cacheKey,
  );

  // Estimate total duration based on text length ratio
  // First chunk is ~1000 chars, total text is text.length
  const estimatedTotalDuration = (text.length / textChunks[0].length) * chunk0Duration;

  return {
    audioId,
    chunks: [chunk0],
    timestamps: firstTimestamps,
    totalDuration: estimatedTotalDuration,
    status: "partial",
    totalChunks: textChunks.length,
    cached: false,
  };
}

// Background generation for remaining chunks (non-blocking)
async function generateRemainingChunks(
  textChunks,
  apiKey,
  voiceId,
  audioId,
  cacheKey,
) {
  const pending = pendingGenerations.get(audioId);
  if (!pending) return;

  try {
    // Generate remaining chunks sequentially to maintain order
    for (let i = 0; i < textChunks.length; i++) {
      const chunkIndex = i + 1; // First chunk is 0
      console.log(
        `Listen progressive: generating chunk ${chunkIndex + 1}/${pending.total}...`,
      );

      const result = await callElevenLabs(textChunks[i], apiKey, voiceId);
      const audioBuffer = Buffer.from(result.audio_base64, "base64");
      const words = textChunks[i].split(/\s+/);

      // Save chunk
      const chunkPath = path.join(CACHE_DIR, `${audioId}_${chunkIndex}.mp3`);
      fs.writeFileSync(chunkPath, audioBuffer);
      console.log(
        `Listen progressive: chunk ${chunkIndex + 1} saved: ${audioBuffer.length} bytes`,
      );

      // Calculate timestamps
      const chunkTimestamps = mapCharToWordTimestamps(
        result.alignment,
        words,
        pending.wordOffset,
        pending.timeOffset,
      );

      let chunkDuration = 0;
      if (chunkTimestamps.length > 0) {
        chunkDuration =
          chunkTimestamps[chunkTimestamps.length - 1].end - pending.timeOffset;
      }

      const chunkMeta = {
        duration: chunkDuration,
        startTime: pending.timeOffset,
        endTime: pending.timeOffset + chunkDuration,
        startWord: pending.wordOffset,
        endWord: pending.wordOffset + words.length - 1,
      };

      // Update pending state
      pending.chunks.push(chunkMeta);
      pending.timestamps.push(...chunkTimestamps);
      pending.wordOffset += words.length;
      pending.timeOffset += chunkDuration;
      pending.completed++;

      console.log(
        `Listen progressive: chunk ${chunkIndex + 1} ends at ${pending.timeOffset.toFixed(1)}s`,
      );
    }

    // All chunks complete - save final metadata and update cache
    const totalDuration = pending.timeOffset;
    const meta = {
      cacheKey,
      audioId,
      chunks: pending.chunks,
      timestamps: pending.timestamps,
      totalDuration,
    };
    fs.writeFileSync(
      path.join(CACHE_DIR, `${cacheKey}.json`),
      JSON.stringify(meta),
    );
    cache.set(cacheKey, meta);

    console.log(
      `Listen progressive: all ${pending.total} chunks complete, total duration: ${totalDuration.toFixed(1)}s`,
    );
  } catch (err) {
    console.error(`Listen progressive: background generation error:`, err);
  } finally {
    pendingGenerations.delete(audioId);
  }
}

// Get current generation status for an audioId
export function getGenerationStatus(audioId) {
  const pending = pendingGenerations.get(audioId);
  if (!pending) {
    return { status: "complete" };
  }

  // Build chunks with URLs
  const chunksWithUrls = pending.chunks.map((chunk, i) => ({
    ...chunk,
    audioUrl: `/api/v1/listen/audio/${audioId}_${i}`,
  }));

  return {
    status: pending.completed < pending.total ? "generating" : "complete",
    completed: pending.completed,
    total: pending.total,
    chunks: chunksWithUrls,
    timestamps: pending.timestamps,
    totalDuration: pending.timeOffset,
  };
}

// Get list of available chunk files for an audioId
export function getAvailableChunks(audioId) {
  const chunks = [];
  let i = 0;
  while (true) {
    const chunkPath = path.join(CACHE_DIR, `${audioId}_${i}.mp3`);
    if (fs.existsSync(chunkPath)) {
      chunks.push(i);
      i++;
    } else {
      break;
    }
  }
  return chunks;
}
