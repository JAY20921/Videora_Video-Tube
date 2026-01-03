import React, { useRef, useEffect, useState } from "react";
import Hls from "hls.js";
import { Play, Pause, Maximize, PictureInPicture2, Settings, Gauge } from "lucide-react";

export default function PlayerWrapper({ url, poster }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [error, setError] = useState(null); // <-- Error state

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    setError(null); // reset previous errors

    if (Hls.isSupported() && url.endsWith(".m3u8")) {
      const hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => setError("Autoplay blocked. Click play to start."));
        setIsPlaying(true);
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        setError(`Video error: ${data.type} - ${data.details}`);
      });

      return () => {
        hls.destroy();
      };
    } else {
      video.src = url;
      video.onplay = () => setIsPlaying(true);
      video.onerror = () => setError("Unable to play video. Please check the source.");
    }
  }, [url]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;

    if (v.paused) {
      v.play().catch(() => setError("Unable to play video. Click play to try again."));
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

  return (
    <div ref={containerRef} className="relative bg-black rounded-lg overflow-hidden shadow-xl">
      <video
        ref={videoRef}
        poster={poster}
        className="w-full h-full"
        playsInline
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={(e) => setDuration(e.target.duration)}
      />

      {/* Error message */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white text-center p-4">
          {error}
        </div>
      )}

      <input
        type="range"
        min="0"
        max={duration}
        value={progress}
        onChange={onSeek}
        className="absolute bottom-14 left-0 right-0 w-full accent-red-500"
      />

      <div className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-gradient-to-t from-black/90 to-transparent flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button onClick={togglePlay} className="control-btn">
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <span className="text-xs text-neutral-300">
            {Math.floor(progress)} / {Math.floor(duration)}s
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Gauge size={16} />
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
          <button onClick={togglePiP} className="control-btn"><PictureInPicture2 size={16} /></button>
          <button onClick={toggleFullscreen} className="control-btn"><Maximize size={16} /></button>
        </div>
      </div>

      <style jsx>{`
        .control-btn {
          background: rgba(0,0,0,0.6);
          padding: 6px;
          border-radius: 999px;
          color: white;
        }
        .control-btn:hover {
          background: rgba(255,255,255,0.15);
        }
      `}</style>
    </div>
  );
}
