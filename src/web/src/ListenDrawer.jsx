import React, { useState, useEffect, useRef, useCallback } from "react";
import SwipeableDrawer from "@mui/material/SwipeableDrawer";

const ListenDrawer = ({ toast }) => {
  const [open, setOpen] = useState(false);
  const [storyIndex, setStoryIndex] = useState("");
  const [articleHtml, setArticleHtml] = useState("");
  const [articleTitle, setArticleTitle] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [timestamps, setTimestamps] = useState([]);
  const [error, setError] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Chunk-based playback state
  const [chunks, setChunks] = useState([]); // Array of chunk info from server
  const [currentChunk, setCurrentChunk] = useState(0); // Index of currently playing chunk

  // Progressive loading state
  const [audioId, setAudioId] = useState(null); // Audio ID for polling status
  const [generationStatus, setGenerationStatus] = useState("complete"); // "partial", "generating", "complete"
  const [totalChunks, setTotalChunks] = useState(0); // Total expected chunks

  const chunkAudioRefs = useRef([]); // Array of preloaded Audio elements for each chunk
  const currentChunkRef = useRef(0); // Track current chunk for immediate access (state is async)
  const rafRef = useRef(null);
  const articleTextRef = useRef(null);
  const shouldAutoplayRef = useRef(false);
  const cacheRef = useRef(new Map()); // Cache: storyIndex -> { articleHtml, chunks, timestamps }
  const loadingRef = useRef(null); // Currently loading story index
  const totalDurationRef = useRef(0); // Server-provided total duration

  const iOS =
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent);

  // Calculate global current time across all chunks
  const getGlobalTime = useCallback(() => {
    if (chunks.length === 0) return 0;
    const chunkIdx = currentChunkRef.current;
    const chunk = chunks[chunkIdx];
    const audio = chunkAudioRefs.current[chunkIdx];
    if (!chunk || !audio) return 0;
    return chunk.startTime + audio.currentTime;
  }, [chunks]);

  // Keep ref in sync with state for immediate access
  useEffect(() => {
    currentChunkRef.current = currentChunk;
  }, [currentChunk]);

  // Seek to a global time position, handling chunk boundaries
  const seekTo = useCallback(
    (globalTime) => {
      if (chunks.length === 0) return;

      console.log("[seekTo] target:", globalTime, "chunks:", chunks.length);

      // Find which chunk contains target time
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`[seekTo] chunk ${i}: start=${chunk.startTime}, end=${chunk.endTime}`);

        // Use <= for endTime to handle boundary case
        if (globalTime >= chunk.startTime && globalTime <= chunk.endTime) {
          const wasPlaying = isPlaying;
          const prevChunk = currentChunkRef.current;

          console.log(`[seekTo] found chunk ${i}, prev=${prevChunk}, wasPlaying=${wasPlaying}`);

          // If switching to a different chunk
          if (i !== prevChunk) {
            // Pause current chunk
            const currentAudio = chunkAudioRefs.current[prevChunk];
            if (currentAudio) {
              currentAudio.pause();
              console.log(`[seekTo] paused chunk ${prevChunk}`);
            }

            // Update both ref (immediate) and state (for re-render)
            currentChunkRef.current = i;
            setCurrentChunk(i);

            // Seek within new chunk - handle iOS Safari which may not have preloaded
            const newAudio = chunkAudioRefs.current[i];
            if (newAudio) {
              const localTime = globalTime - chunk.startTime;
              console.log(`[seekTo] new chunk ${i} readyState=${newAudio.readyState}, seeking to localTime=${localTime}`);

              // iOS Safari fix: if audio isn't ready, wait for it
              if (newAudio.readyState < 1) {
                // Not enough data loaded - need to wait
                const onCanPlay = () => {
                  newAudio.removeEventListener("canplay", onCanPlay);
                  newAudio.currentTime = localTime;
                  console.log(`[seekTo] canplay fired, seeked to ${localTime}`);
                  if (wasPlaying) {
                    newAudio.play().catch(e => console.log("[seekTo] play error:", e));
                  }
                };
                newAudio.addEventListener("canplay", onCanPlay);
                // Trigger load
                newAudio.load();
                if (wasPlaying) {
                  // Try to play anyway - might work on some browsers
                  newAudio.play().catch(() => {});
                }
              } else {
                newAudio.currentTime = localTime;
                if (wasPlaying) {
                  newAudio.play().catch(e => console.log("[seekTo] play error:", e));
                }
              }
            }
          } else {
            // Same chunk, just seek
            const audio = chunkAudioRefs.current[i];
            if (audio) {
              const localTime = globalTime - chunk.startTime;
              console.log(`[seekTo] same chunk, seeking to localTime=${localTime}`);
              audio.currentTime = localTime;
            }
          }
          return;
        }
      }

      console.log("[seekTo] no chunk found for time", globalTime, "- seeking to end of last loaded chunk");

      // If past all loaded chunks, seek to end of last available chunk
      // User will hear more as chunks load (seamless transition handles this)
      const lastChunkIndex = chunks.length - 1;
      const lastChunk = chunks[lastChunkIndex];
      const wasPlaying = isPlaying;
      const prevChunk = currentChunkRef.current;

      if (lastChunkIndex !== prevChunk) {
        const currentAudio = chunkAudioRefs.current[prevChunk];
        if (currentAudio) currentAudio.pause();
        currentChunkRef.current = lastChunkIndex;
        setCurrentChunk(lastChunkIndex);
      }

      const audio = chunkAudioRefs.current[lastChunkIndex];
      if (audio) {
        // Seek to near end of last chunk - playback will continue when next chunk loads
        const seekPosition = Math.max(0, lastChunk.duration - 0.5);
        audio.currentTime = seekPosition;
        if (wasPlaying) {
          audio.play().catch((e) => console.log("[seekTo] play error:", e));
        }
      }
    },
    [chunks, isPlaying],
  );

  // Add styles for word highlighting
  useEffect(() => {
    const styleId = "listen-drawer-styles";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        @keyframes listen-drawer-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .listen-article .s {
          border-radius: 3px;
          transition: background-color 0.15s ease;
          padding: 2px 4px;
          margin: -2px -4px;
        }
        .listen-article .s.active {
          background-color: var(--listen-highlight, rgba(255, 235, 59, 0.35));
        }
        @media (prefers-color-scheme: dark) {
          .listen-article .s.active {
            background-color: var(--listen-highlight, rgba(255, 235, 59, 0.25));
          }
        }
        [data-theme="anon"] .listen-article .s.active {
          background-color: rgba(0, 255, 0, 0.15);
        }
      `;
      document.head.appendChild(style);
    }

    return () => {
      const style = document.getElementById(styleId);
      if (style) {
        style.remove();
      }
    };
  }, []);

  // Expose global open function
  useEffect(() => {
    window.openListenDrawer = async (index, title) => {
      // Prevent duplicate requests for same story
      if (loadingRef.current === index) {
        setOpen(true);
        window.drawerIsOpen = true;
        return;
      }

      setStoryIndex(index);
      setArticleTitle(title);
      setOpen(true);
      window.drawerIsOpen = true;
      setError("");
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setCurrentChunk(0);
      currentChunkRef.current = 0;
      totalDurationRef.current = 0;
      setAudioId(null);
      setGenerationStatus("complete");
      setTotalChunks(0);

      // Check cache first
      const cached = cacheRef.current.get(index);
      if (cached) {
        setArticleHtml(cached.articleHtml);
        setChunks(cached.chunks);
        setTimestamps(cached.timestamps);
        if (cached.totalDuration) {
          totalDurationRef.current = cached.totalDuration;
          setDuration(cached.totalDuration);
        }
        setIsExtracting(false);
        setIsGenerating(false);
        shouldAutoplayRef.current = true;
        return;
      }

      // Mark as loading - use this to detect if user switched articles
      loadingRef.current = index;
      setArticleHtml("");
      setChunks([]);
      setTimestamps([]);

      // Step 1: Extract article
      setIsExtracting(true);
      try {
        const res = await fetch("/api/v1/listen/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ index }),
        });

        // Check if user switched to different article while we were fetching
        if (loadingRef.current !== index) {
          console.log(`[listen] Stale extract response for ${index}, current is ${loadingRef.current}`);
          return;
        }

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.details || "Failed to extract article");
        }
        const data = await res.json();

        // Check again after parsing
        if (loadingRef.current !== index) {
          console.log(`[listen] Stale extract data for ${index}, current is ${loadingRef.current}`);
          return;
        }

        setArticleHtml(data.wrappedHtml);
        setIsExtracting(false);

        // Step 2: Generate/fetch TTS with progressive loading
        setIsGenerating(true);
        const ttsRes = await fetch("/api/v1/listen/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ index }),
        });

        // Check if user switched articles
        if (loadingRef.current !== index) {
          console.log(`[listen] Stale TTS response for ${index}, current is ${loadingRef.current}`);
          return;
        }

        if (!ttsRes.ok) {
          const ttsData = await ttsRes.json().catch(() => ({}));
          throw new Error(ttsData.details || "Failed to generate audio");
        }
        const ttsData = await ttsRes.json();

        // Final check before updating state
        if (loadingRef.current !== index) {
          console.log(`[listen] Stale TTS data for ${index}, current is ${loadingRef.current}`);
          return;
        }

        // Set initial chunks (may be just the first chunk for progressive loading)
        setChunks(ttsData.chunks);
        setTimestamps(ttsData.timestamps);
        if (ttsData.totalDuration) {
          totalDurationRef.current = ttsData.totalDuration;
          setDuration(ttsData.totalDuration);
        }

        // Progressive loading: set up polling if not complete
        if (ttsData.status === "partial" || ttsData.status === "generating") {
          setAudioId(ttsData.audioId);
          setGenerationStatus(ttsData.status);
          setTotalChunks(ttsData.totalChunks || 0);
        } else {
          setGenerationStatus("complete");
        }

        setIsGenerating(false);
        shouldAutoplayRef.current = true;

        // Only cache if fully complete
        if (ttsData.status === "complete") {
          cacheRef.current.set(index, {
            articleHtml: data.wrappedHtml,
            chunks: ttsData.chunks,
            timestamps: ttsData.timestamps,
            totalDuration: ttsData.totalDuration,
          });
        }
      } catch (err) {
        // Only show error if this is still the active request
        if (loadingRef.current === index) {
          setError(err.message);
          setIsExtracting(false);
          setIsGenerating(false);
        }
      } finally {
        // Only clear loading if this was the active request
        if (loadingRef.current === index) {
          loadingRef.current = null;
        }
      }
    };

    return () => {
      delete window.openListenDrawer;
    };
  }, []);

  // Audio player logic - highlightSentence must be defined before startHighlightLoop
  const highlightSentence = useCallback(
    (currentTime) => {
      // Find current word index based on timestamp
      let currentWordIndex = -1;
      for (let i = 0; i < timestamps.length; i++) {
        const ts = timestamps[i];
        if (currentTime >= ts.start && currentTime <= ts.end) {
          currentWordIndex = ts.index;
          break;
        }
        // If we're between timestamps, use the previous word
        if (currentTime < ts.start && i > 0) {
          currentWordIndex = timestamps[i - 1].index;
          break;
        }
      }

      if (currentWordIndex < 0 && timestamps.length > 0 && currentTime > 0) {
        // Past the last timestamp
        currentWordIndex = timestamps[timestamps.length - 1].index;
      }

      // Find which sentence contains this word
      const sentences = document.querySelectorAll(".listen-article .s");
      let activeSentence = null;

      for (const sentence of sentences) {
        const startWord = parseInt(sentence.dataset.startWord, 10);
        const wordCount = sentence.textContent.trim().split(/\s+/).length;
        const endWord = startWord + wordCount - 1;

        if (currentWordIndex >= startWord && currentWordIndex <= endWord) {
          activeSentence = sentence;
          break;
        }
      }

      const prev = document.querySelector(".listen-article .s.active");
      if (prev === activeSentence) return;

      if (prev) prev.classList.remove("active");

      if (activeSentence) {
        activeSentence.classList.add("active");
        activeSentence.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    },
    [timestamps],
  );

  // Poll for additional chunks during progressive generation
  useEffect(() => {
    if (!audioId || generationStatus === "complete") return;

    const currentAudioId = audioId; // Capture for closure
    const currentStoryIndex = storyIndex;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/listen/tts/status/${currentAudioId}`);
        if (!res.ok) return;
        const data = await res.json();

        // Verify we're still on the same article before updating state
        if (data.audioId !== currentAudioId) {
          console.log(`[progressive] Stale poll response, ignoring`);
          return;
        }

        // Update chunks if new ones are available
        if (data.chunks && data.chunks.length > chunks.length) {
          console.log(`[progressive] New chunks available: ${data.chunks.length} (was ${chunks.length})`);
          setChunks(data.chunks);
          setTimestamps(data.timestamps);
          if (data.totalDuration) {
            totalDurationRef.current = data.totalDuration;
            setDuration(data.totalDuration);
          }
        }

        // Check if complete
        if (data.status === "complete") {
          console.log("[progressive] Generation complete");
          setGenerationStatus("complete");

          // Cache the complete result
          const cached = cacheRef.current.get(currentStoryIndex);
          if (cached) {
            cacheRef.current.set(currentStoryIndex, {
              ...cached,
              chunks: data.chunks,
              timestamps: data.timestamps,
              totalDuration: data.totalDuration,
            });
          }
        }
      } catch (err) {
        console.error("[progressive] Poll error:", err);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [audioId, generationStatus, chunks.length, storyIndex]);

  const startHighlightLoop = useCallback(() => {
    function tick() {
      // Use ref for immediate access to current chunk (state may be stale)
      const chunkIdx = currentChunkRef.current;
      const currentAudio = chunkAudioRefs.current[chunkIdx];
      if (!currentAudio || currentAudio.paused) return;

      const chunk = chunks[chunkIdx];
      if (!chunk) return;
      const globalTime = chunk.startTime + currentAudio.currentTime;

      highlightSentence(globalTime);
      setCurrentTime(globalTime);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [highlightSentence, chunks]);

  const stopHighlightLoop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const clearHighlights = useCallback(() => {
    const active = document.querySelectorAll(".listen-article .s.active");
    active.forEach((el) => el.classList.remove("active"));
  }, []);

  const handlePlay = useCallback(() => {
    const currentAudio = chunkAudioRefs.current[currentChunkRef.current];
    if (currentAudio) {
      currentAudio.play();
      setIsPlaying(true);
      startHighlightLoop();
    }
  }, [startHighlightLoop]);

  const handlePause = useCallback(() => {
    const currentAudio = chunkAudioRefs.current[currentChunkRef.current];
    if (currentAudio) {
      currentAudio.pause();
      setIsPlaying(false);
      stopHighlightLoop();
    }
  }, [stopHighlightLoop]);

  const handleSkipBack = useCallback(() => {
    const globalTime = getGlobalTime();
    const newTime = Math.max(0, globalTime - 10);
    seekTo(newTime);
    highlightSentence(newTime);
    setCurrentTime(newTime);
  }, [getGlobalTime, seekTo, highlightSentence]);

  const handleSkipForward = useCallback(() => {
    const globalTime = getGlobalTime();
    const totalDur = totalDurationRef.current;
    const newTime = Math.min(globalTime + 10, totalDur);
    console.log("[skipForward] from", globalTime, "to", newTime, "total", totalDur);
    console.log("[skipForward] chunks:", JSON.stringify(chunks.map(c => ({start: c.startTime, end: c.endTime}))));
    seekTo(newTime);
    highlightSentence(newTime);
    setCurrentTime(newTime);
  }, [getGlobalTime, seekTo, highlightSentence, chunks]);

  const handleProgressClick = useCallback(
    (e) => {
      const totalDur = totalDurationRef.current;
      if (!totalDur || totalDur === 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      const newTime = ratio * totalDur;
      seekTo(newTime);
      highlightSentence(newTime);
      setCurrentTime(newTime);
    },
    [seekTo, highlightSentence],
  );


  const formatTime = (s) => {
    if (!isFinite(s) || isNaN(s)) return "--:--";
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return mins + ":" + (secs < 10 ? "0" : "") + secs;
  };

  const handleClose = useCallback(() => {
    setOpen(false);
    window.drawerIsOpen = false;
    // Pause all chunk audio elements
    chunkAudioRefs.current.forEach((audio) => {
      if (audio) audio.pause();
    });
    stopHighlightLoop();
    clearHighlights();
    // Clean up state after animation
    setTimeout(() => {
      setArticleHtml("");
      setChunks([]);
      setTimestamps([]);
      setError("");
      setAudioId(null);
      setGenerationStatus("complete");
      setTotalChunks(0);
      setIsExtracting(false);
      setIsGenerating(false);
      setCurrentChunk(0);
      currentChunkRef.current = 0;
    }, 300);
  }, [stopHighlightLoop, clearHighlights]);

  // Preload chunk audio elements and set up event handlers
  // This effect handles progressive loading by only adding new chunks
  useEffect(() => {
    if (chunks.length === 0) {
      // Clean up all audio elements when chunks are cleared
      chunkAudioRefs.current.forEach((audio) => {
        if (audio) {
          audio.pause();
          audio.src = "";
        }
      });
      chunkAudioRefs.current = [];
      return;
    }

    const existingCount = chunkAudioRefs.current.length;

    // Only create Audio elements for NEW chunks (progressive loading)
    for (let i = existingCount; i < chunks.length; i++) {
      const chunk = chunks[i];
      const audio = new Audio(chunk.audioUrl);
      audio.preload = "auto";
      chunkAudioRefs.current.push(audio);
      console.log(`[preload] Created audio element for chunk ${i}`);
    }

    // Set up ended handlers for all chunks (re-bind to handle progressive updates)
    chunkAudioRefs.current.forEach((audio, i) => {
      // Remove old handler to prevent duplicates
      audio.onended = null;

      audio.onended = () => {
        // Check against current chunks array length (may have grown)
        const currentChunks = chunks;
        if (i < chunkAudioRefs.current.length - 1) {
          // Play next chunk
          console.log(`[playback] Chunk ${i} ended, playing chunk ${i + 1}`);
          currentChunkRef.current = i + 1;
          setCurrentChunk(i + 1);
          chunkAudioRefs.current[i + 1].play().catch((e) => {
            console.log("[playback] Next chunk play error:", e);
          });
        } else if (generationStatus !== "complete") {
          // More chunks being generated - wait and retry
          console.log(`[playback] Chunk ${i} ended, waiting for next chunk...`);
          // Poll briefly for next chunk
          const checkForNextChunk = setInterval(() => {
            if (chunkAudioRefs.current.length > i + 1) {
              clearInterval(checkForNextChunk);
              console.log(`[playback] Next chunk ${i + 1} available, playing`);
              currentChunkRef.current = i + 1;
              setCurrentChunk(i + 1);
              chunkAudioRefs.current[i + 1].play().catch((e) => {
                console.log("[playback] Delayed next chunk play error:", e);
              });
            }
          }, 500);
          // Stop checking after 30 seconds
          setTimeout(() => clearInterval(checkForNextChunk), 30000);
        } else {
          // Last chunk ended and generation complete - stop playback
          console.log(`[playback] All chunks finished`);
          setIsPlaying(false);
          stopHighlightLoop();
          clearHighlights();
        }
      };
    });
  }, [chunks, generationStatus, stopHighlightLoop, clearHighlights]);

  // Cleanup audio elements on unmount
  useEffect(() => {
    return () => {
      chunkAudioRefs.current.forEach((audio) => {
        if (audio) {
          audio.pause();
          audio.src = "";
        }
      });
    };
  }, []);

  // Auto-play when chunks are loaded
  useEffect(() => {
    if (chunks.length > 0 && shouldAutoplayRef.current) {
      shouldAutoplayRef.current = false;
      const firstAudio = chunkAudioRefs.current[0];
      if (!firstAudio) return;

      const tryAutoplay = () => {
        firstAudio
          .play()
          .then(() => {
            setIsPlaying(true);
            startHighlightLoop();
          })
          .catch((err) => {
            // Autoplay blocked by browser - user will need to click play
            console.log("Autoplay blocked:", err.message);
          });
      };

      // Wait for first chunk to be ready
      if (firstAudio.readyState >= 2) {
        tryAutoplay();
      } else {
        firstAudio.addEventListener("canplay", tryAutoplay, { once: true });
      }
    }
  }, [chunks, startHighlightLoop]);

  // Set up Media Session API for lock screen / control center
  useEffect(() => {
    if (chunks.length === 0 || !articleTitle || !("mediaSession" in navigator))
      return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: articleTitle,
      artist: "Kiwi News",
      album: "Listen",
      artwork: [
        { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      ],
    });

    navigator.mediaSession.setActionHandler("play", () => {
      const currentAudio = chunkAudioRefs.current[currentChunkRef.current];
      if (currentAudio) {
        currentAudio.play();
        setIsPlaying(true);
        startHighlightLoop();
      }
    });

    navigator.mediaSession.setActionHandler("pause", () => {
      const currentAudio = chunkAudioRefs.current[currentChunkRef.current];
      if (currentAudio) {
        currentAudio.pause();
        setIsPlaying(false);
        stopHighlightLoop();
      }
    });

    navigator.mediaSession.setActionHandler("seekbackward", () => {
      const globalTime = getGlobalTime();
      const newTime = Math.max(0, globalTime - 10);
      seekTo(newTime);
      highlightSentence(newTime);
    });

    navigator.mediaSession.setActionHandler("seekforward", () => {
      const globalTime = getGlobalTime();
      const totalDur = totalDurationRef.current;
      const newTime = Math.min(globalTime + 10, totalDur);
      seekTo(newTime);
      highlightSentence(newTime);
    });

    return () => {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("seekbackward", null);
      navigator.mediaSession.setActionHandler("seekforward", null);
    };
  }, [
    chunks,
    articleTitle,
    startHighlightLoop,
    stopHighlightLoop,
    highlightSentence,
    getGlobalTime,
    seekTo,
  ]);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onClose={handleClose}
      onOpen={() => setOpen(true)}
      disableBackdropTransition={!iOS}
      disableDiscovery={iOS}
      PaperProps={{
        style: {
          height: "85vh",
          borderTopLeftRadius: "2px",
          borderTopRightRadius: "2px",
          backgroundColor: "var(--background-color0)",
          fontFamily: "var(--font-family)",
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          position: "relative",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px",
            borderBottom: "var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <button
            onClick={handleClose}
            style={{
              background: "none",
              border: "none",
              padding: "8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-primary)",
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 256 256"
              width="24"
              height="24"
            >
              <rect width="256" height="256" fill="none" />
              <line
                x1="200"
                y1="56"
                x2="56"
                y2="200"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="16"
              />
              <line
                x1="200"
                y1="200"
                x2="56"
                y2="56"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="16"
              />
            </svg>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3
              style={{
                margin: 0,
                fontSize: "14px",
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: "var(--text-primary)",
              }}
            >
              {articleTitle || "Listen"}
            </h3>
          </div>
        </div>

        {/* Content area */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Loading states - full width centered */}
          {isExtracting && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "200px",
                gap: "16px",
                width: "100%",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  border: "4px solid var(--background-color0)",
                  borderTop: "4px solid var(--accent-primary)",
                  borderRadius: "50%",
                  animation: "listen-drawer-spin 1s linear infinite",
                }}
              />
              <span style={{ color: "var(--text-secondary)" }}>
                Extracting article...
              </span>
            </div>
          )}

          {!isExtracting && isGenerating && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "200px",
                gap: "16px",
                width: "100%",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  border: "4px solid var(--background-color0)",
                  borderTop: "4px solid var(--accent-primary)",
                  borderRadius: "50%",
                  animation: "listen-drawer-spin 1s linear infinite",
                }}
              />
              <span style={{ color: "var(--text-secondary)" }}>
                Generating audio...
              </span>
            </div>
          )}

          {error && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "200px",
                gap: "16px",
                color: "var(--text-secondary)",
                width: "100%",
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 256 256"
                width="48"
                height="48"
                style={{ opacity: 0.5 }}
              >
                <rect width="256" height="256" fill="none" />
                <circle
                  cx="128"
                  cy="128"
                  r="96"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="16"
                />
                <line
                  x1="128"
                  y1="80"
                  x2="128"
                  y2="136"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="16"
                />
                <circle cx="128" cy="172" r="12" fill="currentColor" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Article content - constrained width */}
          {!isExtracting && !isGenerating && !error && articleHtml && (
            <div
              ref={articleTextRef}
              className="listen-article"
              style={{
                padding: "20px",
                fontSize: "16px",
                lineHeight: 1.8,
                color: "var(--text-primary)",
                maxWidth: "80ch",
                margin: "0 auto",
                width: "100%",
                boxSizing: "border-box",
              }}
              dangerouslySetInnerHTML={{ __html: articleHtml }}
            />
          )}
        </div>

        {/* Player bar */}
        {chunks.length > 0 && !error && (
          <div
            style={{
              padding: "16px",
              borderTop: "var(--border-subtle)",
              backgroundColor: "var(--background-color0)",
            }}
          >
            {/* Progress bar */}
            <div
              onClick={handleProgressClick}
              style={{
                height: "4px",
                backgroundColor: "var(--border-color, rgba(128, 128, 128, 0.3))",
                borderRadius: "2px",
                cursor: "pointer",
                marginBottom: "12px",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progressPercent}%`,
                  backgroundColor: "var(--accent-primary)",
                  borderRadius: "2px",
                  transition: "width 0.1s linear",
                }}
              />
            </div>

            {/* Controls */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                  minWidth: "80px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                {formatTime(currentTime)} / {formatTime(duration)}
                {generationStatus !== "complete" && (
                  <span
                    style={{
                      fontSize: "10px",
                      color: "var(--accent-primary)",
                    }}
                    title={`Loading ${chunks.length}/${totalChunks} chunks`}
                  >
                    +
                  </span>
                )}
              </span>

              <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
                {/* Skip back 10s - counterclockwise */}
                <button
                  onClick={handleSkipBack}
                  style={{
                    background: "none",
                    border: "none",
                    padding: "4px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--text-primary)",
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 256 256"
                    width="36"
                    height="36"
                  >
                    <rect width="256" height="256" fill="none" />
                    <polyline
                      points="24 56 24 104 72 104"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="16"
                    />
                    <path
                      d="M67.59,192A88,88,0,1,0,65.77,65.77L24,104"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="16"
                    />
                    <text
                      x="128"
                      y="148"
                      textAnchor="middle"
                      fontSize="56"
                      fontWeight="bold"
                      fontFamily="system-ui, sans-serif"
                      fill="currentColor"
                    >
                      10
                    </text>
                  </svg>
                </button>

                {/* Play/Pause */}
                <button
                  onClick={isPlaying ? handlePause : handlePlay}
                  style={{
                    background: "var(--accent-primary)",
                    border: "none",
                    borderRadius: "50%",
                    width: "56px",
                    height: "56px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                  }}
                >
                  {isPlaying ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 256 256"
                      width="28"
                      height="28"
                    >
                      <rect width="256" height="256" fill="none" />
                      <rect
                        x="152"
                        y="40"
                        width="56"
                        height="176"
                        rx="8"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="16"
                      />
                      <rect
                        x="48"
                        y="40"
                        width="56"
                        height="176"
                        rx="8"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="16"
                      />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 256 256"
                      width="28"
                      height="28"
                    >
                      <rect width="256" height="256" fill="none" />
                      <path
                        d="M72,39.88V216.12a8,8,0,0,0,12.15,6.69l144.08-88.12a7.82,7.82,0,0,0,0-13.38L84.15,33.19A8,8,0,0,0,72,39.88Z"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="16"
                      />
                    </svg>
                  )}
                </button>

                {/* Skip forward 10s - clockwise */}
                <button
                  onClick={handleSkipForward}
                  style={{
                    background: "none",
                    border: "none",
                    padding: "4px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--text-primary)",
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 256 256"
                    width="36"
                    height="36"
                  >
                    <rect width="256" height="256" fill="none" />
                    <polyline
                      points="184 104 232 104 232 56"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="16"
                    />
                    <path
                      d="M188.4,192a88,88,0,1,1,1.83-126.23L232,104"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="16"
                    />
                    <text
                      x="128"
                      y="148"
                      textAnchor="middle"
                      fontSize="56"
                      fontWeight="bold"
                      fontFamily="system-ui, sans-serif"
                      fill="currentColor"
                    >
                      10
                    </text>
                  </svg>
                </button>
              </div>

              <div style={{ minWidth: "80px" }} />
            </div>
          </div>
        )}
      </div>
    </SwipeableDrawer>
  );
};

export default ListenDrawer;
