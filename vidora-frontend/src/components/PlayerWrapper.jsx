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
export default function PlayerWrapper({ videoId, url, hlsUrl, poster, videoStatus: initialStatus, spritesheetUrl }) {
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
  
  // Phase 4: Hover thumbnails state
  const [hoverX, setHoverX] = useState(null);
  const [hoverTime, setHoverTime] = useState(null);

  // Phase 4: Idle state for premium SaaS player
  const [isIdle, setIsIdle] = useState(false);
  const idleTimeout = useRef(null);

  // Phase 3: Quality selector state
  const [qualities, setQualities] = useState([]);
  const [currentQuality, setCurrentQuality] = useState(-1); // -1 = Auto
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  // Phase 3: Processing status
  const [status, setStatus] = useState(initialStatus || "ready");
  const [effectiveUrl, setEffectiveUrl] = useState(hlsUrl || url);

  // Attach heartbeat + get resume time
  const { resumeTimeRef } = useVideoProgress(videoId, videoRef);

  // Phase 4: Idle tracking
  useEffect(() => {
    const handleMouseMove = () => {
      setIsIdle(false);
      if (idleTimeout.current) clearTimeout(idleTimeout.current);
      if (isPlaying) {
        idleTimeout.current = setTimeout(() => setIsIdle(true), 2500);
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener("mousemove", handleMouseMove);
      container.addEventListener("mouseleave", () => {
        if (isPlaying) setIsIdle(true);
      });
    }

    if (isPlaying) {
      handleMouseMove();
    } else {
      setIsIdle(false);
      if (idleTimeout.current) clearTimeout(idleTimeout.current);
    }

    return () => {
      if (container) container.removeEventListener("mousemove", handleMouseMove);
      if (idleTimeout.current) clearTimeout(idleTimeout.current);
    };
  }, [isPlaying]);

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

  const handleProgressMouseMove = (e) => {
    const rect = e.target.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percent = x / rect.width;
    setHoverX(x);
    setHoverTime(percent * duration);
  };

  const getSpriteStyle = () => {
    if (!spritesheetUrl || hoverTime === null) return {};
    const frameIndex = Math.floor(hoverTime / 10);
    // 10x10 tile grid, 160px width
    const row = Math.floor(frameIndex / 10);
    const col = frameIndex % 10;
    return {
      backgroundImage: `url(${spritesheetUrl})`,
      backgroundPosition: `-${col * 160}px -${row * 90}px`,
      backgroundSize: '1600px', // 10 cols * 160
      width: '160px',
      height: '90px',
    };
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
        className="absolute inset-0 w-full h-full object-contain cursor-pointer"
        playsInline
        onClick={togglePlay}
        onDoubleClick={(e) => {
          const rect = e.target.getBoundingClientRect();
          const x = e.clientX - rect.left;
          if (x > rect.width / 2) {
            videoRef.current.currentTime += 10;
          } else {
            videoRef.current.currentTime -= 10;
          }
        }}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={(e) => setDuration(e.target.duration)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* Big Play Button Overlay */}
      {!isPlaying && status === "ready" && !error && !showResume && (
        <button 
          onClick={togglePlay} 
          className="absolute inset-0 m-auto w-20 h-20 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-full text-white/90 hover:bg-rose-500 hover:scale-110 hover:text-white transition-all duration-300 z-10 shadow-2xl border border-white/10"
        >
          <Play size={36} fill="currentColor" className="ml-1.5" />
        </button>
      )}

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

      {/* Controls Container */}
      <div 
        className={`absolute bottom-0 left-0 right-0 pt-24 pb-3 px-4 bg-gradient-to-t from-black/95 via-black/40 to-transparent flex flex-col justify-end transition-opacity duration-300 ${
          isIdle ? "opacity-0" : "opacity-100"
        }`}
      >
        {/* Thumbnail hover preview */}
        {hoverTime !== null && (
          <div 
            className="absolute bottom-16 z-20 pointer-events-none flex flex-col items-center drop-shadow-2xl transition-all"
            style={{ 
              left: hoverX + 'px', 
              transform: 'translateX(-50%)',
              marginLeft: hoverX < 80 ? `${80 - hoverX}px` : hoverX > (containerRef.current?.clientWidth - 80) ? `-${hoverX - (containerRef.current?.clientWidth - 80)}px` : '0px'
            }}
          >
            {spritesheetUrl && <div className="border-[1.5px] border-white/30 bg-black rounded overflow-hidden shadow-2xl" style={getSpriteStyle()} />}
            <div className="text-[12px] bg-black/80 backdrop-blur px-2.5 py-0.5 rounded shadow-lg mt-1.5 font-semibold text-white tracking-wide">
              {formatTime(hoverTime)}
            </div>
          </div>
        )}

        {/* Seek bar */}
        <div className="relative w-full h-1.5 group/slider mb-4 flex items-center cursor-pointer">
          <input
            type="range"
            min="0"
            max={duration || 1}
            value={progress}
            onChange={onSeek}
            onMouseMove={handleProgressMouseMove}
            onMouseLeave={() => setHoverTime(null)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
          />
          <div className="w-full h-1 bg-white/30 rounded-full overflow-hidden group-hover/slider:h-1.5 transition-all pointer-events-none">
            <div 
              className="h-full bg-rose-500"
              style={{ width: `${duration > 0 ? (progress / duration) * 100 : 0}%` }}
            />
          </div>
          <div 
            className="absolute h-3.5 w-3.5 bg-rose-500 rounded-full scale-0 group-hover/slider:scale-100 transition-transform pointer-events-none z-10 shadow-lg"
            style={{ left: `calc(${duration > 0 ? (progress / duration) * 100 : 0}% - 7px)` }}
          />
        </div>

        {/* Buttons Row */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={togglePlay}
              className="hover:scale-110 hover:text-rose-400 transition text-white drop-shadow"
            >
              {isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
            </button>
            <span className="text-xs text-white/90 drop-shadow font-medium tracking-wide">
              {formatTime(progress)} <span className="text-white/50 mx-1">/</span> {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-5 text-white">
            {/* Playback speed */}
            <div className="relative group/speed flex items-center">
              <Gauge size={18} className="drop-shadow cursor-pointer hover:text-rose-400 transition" />
              <select
                value={playbackRate}
                onChange={(e) => {
                  videoRef.current.playbackRate = Number(e.target.value);
                  setPlaybackRate(Number(e.target.value));
                }}
                className="absolute opacity-0 inset-0 cursor-pointer"
              >
                {[0.5, 1, 1.25, 1.5, 2].map((r) => (
                  <option key={r} value={r}>{r}×</option>
                ))}
              </select>
            </div>

            {/* Phase 3: Quality selector (only for HLS) */}
            {qualities.length > 0 && (
              <div className="relative flex items-center">
                <button
                  onClick={() => setShowQualityMenu((s) => !s)}
                  className="hover:scale-110 hover:text-rose-400 transition drop-shadow"
                  title="Video quality"
                >
                  <Settings size={18} />
                </button>

                {showQualityMenu && (
                  <div className="absolute bottom-full mb-3 right-0 bg-black/90 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[140px] z-20">
                    <button
                      onClick={() => handleQualityChange(-1)}
                      className={`w-full text-left px-4 py-2.5 text-xs hover:bg-white/10 transition ${
                        currentQuality === -1 ? "text-rose-400 font-bold bg-white/5" : "text-white"
                      }`}
                    >
                      Auto
                    </button>
                    {qualities.map((q) => (
                      <button
                        key={q.index}
                        onClick={() => handleQualityChange(q.index)}
                        className={`w-full text-left px-4 py-2.5 text-xs hover:bg-white/10 transition ${
                          currentQuality === q.index ? "text-rose-400 font-bold bg-white/5" : "text-white"
                        }`}
                      >
                        {q.label}
                        <span className="text-neutral-500 ml-2 font-medium">
                          {Math.round(q.bitrate / 1000)}kbps
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Fullscreen & PiP */}
            <button
              onClick={togglePiP}
              className="hover:scale-110 hover:text-rose-400 transition drop-shadow"
            >
              <PictureInPicture2 size={18} />
            </button>
            <button
              onClick={toggleFullscreen}
              className="hover:scale-110 hover:text-rose-400 transition drop-shadow"
            >
              <Maximize size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
