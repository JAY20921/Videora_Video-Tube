import React, { useRef, useEffect, useState, useCallback } from "react";
import Hls from "hls.js";
import { Play, Pause, Maximize, PictureInPicture2, Gauge, Settings, Loader2 } from "lucide-react";
import { useVideoProgress } from "../hooks/useVideoProgress";
import { getVideoStatus } from "../api/videos";

/**
 * PlayerWrapper — Phase 3 Enhanced
 *
 * Supports:
 * - Raw MP4 playback (legacy)
 * - HLS adaptive bitrate streaming with quality selector
 * - Processing status polling (shows loader while transcoding)
 * - Resume prompt from watch history
 */
export default function PlayerWrapper({ videoId, url, hlsUrl, poster, videoStatus: initialStatus }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const hlsRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [error, setError] = useState(null);
  const [showResume, setShowResume] = useState(false);
  const [resumeSeconds, setResumeSeconds] = useState(0);

  // Phase 3: Quality selector state
  const [qualities, setQualities] = useState([]);
  const [currentQuality, setCurrentQuality] = useState(-1); // -1 = Auto
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  // Phase 3: Processing status
  const [status, setStatus] = useState(initialStatus || "ready");
  const [effectiveUrl, setEffectiveUrl] = useState(hlsUrl || url);

  // Attach heartbeat + get resume time
  const { resumeTimeRef } = useVideoProgress(videoId, videoRef);

  // Phase 3: Poll for processing completion
  useEffect(() => {
    if (status !== "processing") return;

    const pollInterval = setInterval(async () => {
      try {
        const result = await getVideoStatus(videoId);
        if (result.status === "ready") {
          setStatus("ready");
          // Prefer HLS URL if available, otherwise fall back to raw MP4
          setEffectiveUrl(result.hlsUrl || result.videoFile || url);
          clearInterval(pollInterval);
        } else if (result.status === "failed") {
          setStatus("failed");
          setError("Video processing failed. Please try re-uploading.");
          clearInterval(pollInterval);
        }
      } catch {
        // ignore polling errors
      }
    }, 5000); // poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [status, videoId, url]);

  // Main video setup effect
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !effectiveUrl || status !== "ready") return;

    setError(null);

    const onReady = () => {
      // If there's a saved position, prompt the user
      if (resumeTimeRef.current && resumeTimeRef.current > 5) {
        setResumeSeconds(resumeTimeRef.current);
        setShowResume(true);
      }
    };

    // HLS playback
    if (Hls.isSupported() && effectiveUrl.endsWith(".m3u8")) {
      const hls = new Hls({
        enableWorker: true,
        startLevel: -1, // Auto quality
      });
      hlsRef.current = hls;

      hls.loadSource(effectiveUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        // Build quality levels list
        const levels = hls.levels.map((level, index) => ({
          index,
          height: level.height,
          width: level.width,
          bitrate: level.bitrate,
          label: `${level.height}p`,
        }));
        setQualities(levels);
        setCurrentQuality(-1); // Auto

        onReady();
        video.play().catch(() => setError("Autoplay blocked. Click play to start."));
        setIsPlaying(true);
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
        setCurrentQuality(data.level);
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          setError(`Video error: ${data.type} - ${data.details}`);
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad(); // attempt recovery
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError(); // attempt recovery
          }
        }
      });

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    } else {
      // Raw MP4 fallback
      video.src = effectiveUrl;
      video.onloadedmetadata = onReady;
      video.onerror = () => setError("Unable to play video. Please check the source.");
      setQualities([]); // No quality selection for MP4
    }
  }, [effectiveUrl, status]);

  // Quality change handler
  const handleQualityChange = useCallback((levelIndex) => {
    const hls = hlsRef.current;
    if (!hls) return;

    if (levelIndex === -1) {
      // Auto mode
      hls.currentLevel = -1;
      setCurrentQuality(-1);
    } else {
      hls.currentLevel = levelIndex;
      setCurrentQuality(levelIndex);
    }
    setShowQualityMenu(false);
  }, []);

  const handleResume = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = resumeSeconds;
    }
    setShowResume(false);
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => setError("Unable to play. Click play to try again."));
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  const onTimeUpdate = () => {
    const v = videoRef.current;
    setProgress(v.currentTime);
    setDuration(v.duration || 0);
  };

  const onSeek = (e) => {
    videoRef.current.currentTime = Number(e.target.value);
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!document.fullscreenElement) el.requestFullscreen();
    else document.exitFullscreen();
  };

  const togglePiP = async () => {
    const v = videoRef.current;
    if (!v) return;
    if (document.pictureInPictureElement) await document.exitPictureInPicture();
    else await v.requestPictureInPicture();
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // Phase 3: Processing state UI
  if (status === "processing") {
    return (
      <div className="relative bg-black rounded-lg overflow-hidden shadow-xl aspect-video flex items-center justify-center">
        {poster && (
          <img src={poster} alt="Video thumbnail" className="absolute inset-0 w-full h-full object-cover opacity-30" />
        )}
        <div className="relative z-10 flex flex-col items-center gap-4 text-white">
          <Loader2 size={48} className="animate-spin text-rose-500" />
          <div className="text-lg font-semibold">Processing your video...</div>
          <div className="text-sm text-neutral-400">
            Your video is being transcoded for adaptive streaming. This may take a few minutes.
          </div>
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            Transcoding in progress
          </div>
        </div>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="relative bg-black rounded-lg overflow-hidden shadow-xl aspect-video flex items-center justify-center">
        <div className="text-center text-white p-6">
          <div className="text-lg font-semibold text-rose-400 mb-2">Processing Failed</div>
          <div className="text-sm text-neutral-400">
            The video could not be transcoded. Please try re-uploading.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative bg-black rounded-lg overflow-hidden shadow-xl group aspect-video">
      <video
        ref={videoRef}
        poster={poster}
        className="absolute inset-0 w-full h-full object-contain"
        playsInline
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={(e) => setDuration(e.target.duration)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* Resume prompt */}
      {showResume && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 bg-black/80 border border-neutral-700 text-white text-sm px-4 py-2.5 rounded-full shadow-lg">
          <span>Resume from <strong>{formatTime(resumeSeconds)}</strong>?</span>
          <button
            onClick={handleResume}
            className="bg-rose-600 hover:bg-rose-700 transition px-3 py-1 rounded-full text-xs font-semibold"
          >
            Resume
          </button>
          <button
            onClick={() => setShowResume(false)}
            className="text-neutral-400 hover:text-white transition text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white text-center p-4 text-sm">
          {error}
        </div>
      )}

      {/* Seek bar */}
      <input
        type="range"
        min="0"
        max={duration || 1}
        value={progress}
        onChange={onSeek}
        className="absolute bottom-14 left-0 right-0 w-full accent-rose-500 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
      />

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-gradient-to-t from-black/90 to-transparent flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            className="bg-black/60 hover:bg-white/15 transition p-1.5 rounded-full text-white"
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <span className="text-xs text-neutral-300">
            {formatTime(progress)} / {formatTime(duration)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Playback speed */}
          <Gauge size={16} className="text-white" />
          <select
            value={playbackRate}
            onChange={(e) => {
              videoRef.current.playbackRate = Number(e.target.value);
              setPlaybackRate(Number(e.target.value));
            }}
            className="bg-black/60 text-white text-xs rounded px-2 py-1"
          >
            {[0.5, 1, 1.25, 1.5, 2].map((r) => (
              <option key={r} value={r}>{r}×</option>
            ))}
          </select>

          {/* Phase 3: Quality selector (only for HLS) */}
          {qualities.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowQualityMenu((s) => !s)}
                className="bg-black/60 hover:bg-white/15 transition p-1.5 rounded-full text-white flex items-center gap-1"
                title="Video quality"
              >
                <Settings size={16} />
                <span className="text-xs">
                  {currentQuality === -1 ? "Auto" : qualities.find(q => q.index === currentQuality)?.label || "Auto"}
                </span>
              </button>

              {showQualityMenu && (
                <div className="absolute bottom-full mb-2 right-0 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl overflow-hidden min-w-[120px] z-20">
                  <button
                    onClick={() => handleQualityChange(-1)}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-neutral-800 transition ${
                      currentQuality === -1 ? "text-rose-400 font-semibold" : "text-white"
                    }`}
                  >
                    Auto
                  </button>
                  {qualities.map((q) => (
                    <button
                      key={q.index}
                      onClick={() => handleQualityChange(q.index)}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-neutral-800 transition ${
                        currentQuality === q.index ? "text-rose-400 font-semibold" : "text-white"
                      }`}
                    >
                      {q.label}
                      <span className="text-neutral-500 ml-2">
                        {Math.round(q.bitrate / 1000)}kbps
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={togglePiP}
            className="bg-black/60 hover:bg-white/15 transition p-1.5 rounded-full text-white"
          >
            <PictureInPicture2 size={16} />
          </button>
          <button
            onClick={toggleFullscreen}
            className="bg-black/60 hover:bg-white/15 transition p-1.5 rounded-full text-white"
          >
            <Maximize size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
