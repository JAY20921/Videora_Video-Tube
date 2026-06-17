import React, { useRef, useEffect, useState } from "react";
import Hls from "hls.js";
import { Play, Pause, Maximize, PictureInPicture2, Gauge } from "lucide-react";
import { useVideoProgress } from "../hooks/useVideoProgress";

export default function PlayerWrapper({ videoId, url, poster }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [error, setError] = useState(null);
  const [showResume, setShowResume] = useState(false);
  const [resumeSeconds, setResumeSeconds] = useState(0);

  // Attach heartbeat + get resume time
  const { resumeTimeRef } = useVideoProgress(videoId, videoRef);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    setError(null);

    const onReady = () => {
      // If there's a saved position, prompt the user
      if (resumeTimeRef.current && resumeTimeRef.current > 5) {
        setResumeSeconds(resumeTimeRef.current);
        setShowResume(true);
      }
    };

    if (Hls.isSupported() && url.endsWith(".m3u8")) {
      const hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        onReady();
        video.play().catch(() => setError("Autoplay blocked. Click play to start."));
        setIsPlaying(true);
      });
      hls.on(Hls.Events.ERROR, (event, data) => {
        setError(`Video error: ${data.type} - ${data.details}`);
      });
      return () => hls.destroy();
    } else {
      video.src = url;
      video.onloadedmetadata = onReady;
      video.onerror = () => setError("Unable to play video. Please check the source.");
    }
  }, [url]);

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

  return (
    <div ref={containerRef} className="relative bg-black rounded-lg overflow-hidden shadow-xl">
      <video
        ref={videoRef}
        poster={poster}
        className="w-full"
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
        className="absolute bottom-14 left-0 right-0 w-full accent-rose-500 cursor-pointer"
      />

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-gradient-to-t from-black/90 to-transparent flex justify-between items-center">
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
