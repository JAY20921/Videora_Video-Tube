import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import Hls from "hls.js";
import {
  Play, Pause, Maximize, Minimize, Volume2, VolumeX, Volume1,
  PictureInPicture2, Settings, Loader2, SkipForward, SkipBack,
  Check, ChevronRight, X, Users
} from "lucide-react";
import { useVideoProgress } from "../hooks/useVideoProgress";
import { getVideoStatus } from "../api/videos";
import { useSocket } from "../context/SocketContext";
import { emitTelemetry } from "../api/analytics";

/* ──────────────────────── helpers ──────────────────────── */
const fmt = (s) => {
  if (!s || isNaN(s)) return "0:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

/* ──────────────────────── component ──────────────────────── */
const PlayerWrapper = forwardRef(function PlayerWrapper({
  videoId, url, hlsUrl, poster,
  videoStatus: initialStatus, spritesheetUrl, partyId, isHost,
  processingProgress = 0
}, ref) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const hlsRef = useRef(null);
  const progressBarRef = useRef(null);
  const idleTimer = useRef(null);
  const volBeforeMute = useRef(1);
  const skipAnimTimer = useRef(null);

  // Core state
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuf] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState(null);

  // UI state
  const [idle, setIdle] = useState(false);
  const [hoverTime, setHoverTime] = useState(null);
  const [hoverX, setHoverX] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsPanel, setSettingsPanel] = useState("main"); // main | quality | speed
  const [skipAnim, setSkipAnim] = useState(null); // "fwd" | "bwd" | null

  // HLS quality
  const [qualities, setQualities] = useState([]);
  const [currentQuality, setCurrentQuality] = useState(-1);

  // Resume
  const [showResume, setShowResume] = useState(false);
  const [resumeSec, setResumeSec] = useState(0);

  // Processing status
  const [status, setStatus] = useState(initialStatus || "ready");
  const [effectiveUrl, setEffectiveUrl] = useState(hlsUrl || url);

  const { resumeTimeRef } = useVideoProgress(videoId, videoRef);
  const socket = useSocket();
  const remoteAction = useRef(false);

  /* ──── Analytics Telemetry ──── */
  useEffect(() => {
    if (!videoId) return;
    
    let interval;
    if (playing) {
      interval = setInterval(() => {
        const v = videoRef.current;
        if (v && !v.paused) {
          emitTelemetry(videoId, "heartbeat", Math.round(v.currentTime));
        }
      }, 10000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [videoId, playing]);

  /* ──── Socket Sync ──── */
  useEffect(() => {
    if (!socket || !videoId) return;

    if (!partyId) {
      socket.emit("join-video-room", videoId);
      return () => {
        socket.emit("leave-video-room", videoId);
      };
    }

    const onSyncPlay = (time) => {
      if (isHost) return;
      const v = videoRef.current;
      if (v && v.paused) {
        remoteAction.current = true;
        if (time !== undefined && Math.abs(v.currentTime - time) > 1) {
          v.currentTime = time;
        }
        v.play().catch(() => {});
      }
    };

    const onSyncPause = () => {
      if (isHost) return;
      const v = videoRef.current;
      if (v && !v.paused) {
        remoteAction.current = true;
        v.pause();
      }
    };

    const onSyncSeek = (time) => {
      if (isHost) return;
      const v = videoRef.current;
      if (v && Math.abs(v.currentTime - time) > 1) {
        remoteAction.current = true;
        v.currentTime = time;
      }
    };

    socket.on("sync-play", onSyncPlay);
    socket.on("sync-pause", onSyncPause);
    socket.on("sync-seek", onSyncSeek);

    return () => {
      socket.off("sync-play", onSyncPlay);
      socket.off("sync-pause", onSyncPause);
      socket.off("sync-seek", onSyncSeek);
    };
  }, [socket, videoId, partyId, isHost]);

  /* ──── Expose seekTo via ref for AiTutor ──── */
  useImperativeHandle(ref, () => ({
    seekTo: (seconds) => {
      const v = videoRef.current;
      if (v) {
        v.currentTime = clamp(seconds, 0, v.duration || Infinity);
        if (v.paused) v.play().catch(() => {});
      }
    },
  }), []);

  /* ──── Idle tracking ──── */
  const resetIdle = useCallback(() => {
    setIdle(false);
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => { if (videoRef.current && !videoRef.current.paused) setIdle(true); }, 3000);
  }, []);

  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const onMove = () => resetIdle();
    const onLeave = () => { if (videoRef.current && !videoRef.current.paused) setIdle(true); };
    c.addEventListener("mousemove", onMove);
    c.addEventListener("mouseleave", onLeave);
    return () => { c.removeEventListener("mousemove", onMove); c.removeEventListener("mouseleave", onLeave); clearTimeout(idleTimer.current); };
  }, [resetIdle]);

  useEffect(() => { if (!playing) { setIdle(false); clearTimeout(idleTimer.current); } else resetIdle(); }, [playing, resetIdle]);

  /* ──── Poll for processing ──── */
  useEffect(() => {
    if (status !== "processing") return;
    const iv = setInterval(async () => {
      try {
        const r = await getVideoStatus(videoId);
        if (r.status === "ready") { setStatus("ready"); setEffectiveUrl(r.hlsUrl || r.videoFile || url); clearInterval(iv); }
        else if (r.status === "failed") { setStatus("failed"); setError("Processing failed."); clearInterval(iv); }
      } catch {}
    }, 5000);
    return () => clearInterval(iv);
  }, [status, videoId, url]);

  /* ──── Video setup ──── */
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !effectiveUrl || status !== "ready") return;
    setError(null);

    const onReady = () => {
      if (resumeTimeRef.current && resumeTimeRef.current > 5) {
        setResumeSec(resumeTimeRef.current);
        setShowResume(true);
      }
    };

    if (Hls.isSupported() && effectiveUrl.endsWith(".m3u8")) {
      const hls = new Hls({ enableWorker: true, startLevel: -1 });
      hlsRef.current = hls;
      hls.loadSource(effectiveUrl);
      hls.attachMedia(v);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const heightMap = new Map();
        hls.levels.forEach((l, i) => {
          const h = l.height || 0;
          const label = h ? `${h}p` : 'Original';
          const existing = heightMap.get(h);
          if (!existing || l.bitrate > existing.bitrate) {
            heightMap.set(h, { index: i, height: h, bitrate: l.bitrate, label });
          }
        });
        const lvls = Array.from(heightMap.values()).sort((a, b) => b.height - a.height);
        
        setQualities(lvls);
        setCurrentQuality(-1);
        onReady();
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_, d) => setCurrentQuality(d.level));
      hls.on(Hls.Events.ERROR, (_, d) => {
        if (d.fatal) {
          if (d.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
          else if (d.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
          else setError("Playback error.");
        }
      });
      return () => { hls.destroy(); hlsRef.current = null; };
    } else {
      v.src = effectiveUrl;
      v.onloadedmetadata = onReady;
      v.onerror = () => setError("Unable to play video.");
      setQualities([]);
    }
  }, [effectiveUrl, status]);

  /* ──── Core handlers ──── */
  const togglePlay = useCallback(() => {
    if (partyId && !isHost) return;
    const v = videoRef.current; if (!v) return;
    if (v.paused) v.play().catch(() => setError("Playback blocked."));
    else v.pause();
  }, [partyId, isHost]);

  const seek = useCallback((t) => { 
    if (partyId && !isHost) return;
    const v = videoRef.current; if (v) v.currentTime = clamp(t, 0, duration); 
  }, [duration, partyId, isHost]);

  const skip = useCallback((delta) => {
    seek((videoRef.current?.currentTime || 0) + delta);
    setSkipAnim(delta > 0 ? "fwd" : "bwd");
    clearTimeout(skipAnimTimer.current);
    skipAnimTimer.current = setTimeout(() => setSkipAnim(null), 600);
  }, [seek]);

  const changeVolume = useCallback((val) => {
    const v = videoRef.current; if (!v) return;
    const nv = clamp(val, 0, 1);
    v.volume = nv; setVolume(nv);
    if (nv > 0 && muted) { v.muted = false; setMuted(false); }
    if (nv === 0) { v.muted = true; setMuted(true); }
  }, [muted]);

  const toggleMute = useCallback(() => {
    const v = videoRef.current; if (!v) return;
    if (muted) { v.muted = false; setMuted(false); v.volume = volBeforeMute.current || 0.5; setVolume(v.volume); }
    else { volBeforeMute.current = volume; v.muted = true; setMuted(true); }
  }, [muted, volume]);

  const changeRate = useCallback((r) => {
    const v = videoRef.current; if (!v) return;
    v.playbackRate = r; setRate(r); setShowSettings(false);
  }, []);

  const changeQuality = useCallback((idx) => {
    const h = hlsRef.current; if (!h) return;
    h.currentLevel = idx; setCurrentQuality(idx); setShowSettings(false);
  }, []);

  const toggleFS = useCallback(() => {
    const c = containerRef.current; if (!c) return;
    if (!document.fullscreenElement) c.requestFullscreen();
    else document.exitFullscreen();
  }, []);

  const togglePiP = useCallback(async () => {
    const v = videoRef.current; if (!v) return;
    if (document.pictureInPictureElement) await document.exitPictureInPicture();
    else await v.requestPictureInPicture();
  }, []);

  /* ──── Video events ──── */
  const onTimeUpdate = () => {
    const v = videoRef.current; if (!v) return;
    setCurrentTime(v.currentTime);
    if (v.buffered.length > 0) setBuf(v.buffered.end(v.buffered.length - 1));
  };

  /* ──── Keyboard shortcuts ──── */
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) return;
      const v = videoRef.current; if (!v) return;
      switch (e.key.toLowerCase()) {
        case " ": case "k": e.preventDefault(); togglePlay(); break;
        case "arrowright": case "l": e.preventDefault(); skip(10); break;
        case "arrowleft": case "j": e.preventDefault(); skip(-10); break;
        case "arrowup": e.preventDefault(); changeVolume(volume + 0.1); break;
        case "arrowdown": e.preventDefault(); changeVolume(volume - 0.1); break;
        case "m": e.preventDefault(); toggleMute(); break;
        case "f": e.preventDefault(); toggleFS(); break;
        case "escape": setShowSettings(false); break;
        default: break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [togglePlay, skip, changeVolume, volume, toggleMute, toggleFS]);

  /* ──── Fullscreen tracking ──── */
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  /* ──── Progress bar hover ──── */
  const handleBarHover = (e) => {
    const bar = progressBarRef.current; if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const x = clamp(e.clientX - rect.left, 0, rect.width);
    setHoverX(x);
    setHoverTime((x / rect.width) * duration);
  };
  const handleBarClick = (e) => {
    if (partyId && !isHost) return;
    const bar = progressBarRef.current; if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const pct = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    seek(pct * duration);
  };

  const getSpriteStyle = () => {
    if (!spritesheetUrl || hoverTime === null) return {};
    const fi = Math.floor(hoverTime / 10);
    return {
      backgroundImage: `url(${spritesheetUrl})`,
      backgroundPosition: `-${(fi % 10) * 160}px -${Math.floor(fi / 10) * 90}px`,
      backgroundSize: "1600px", width: "160px", height: "90px",
    };
  };

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufPct = duration > 0 ? (buffered / duration) * 100 : 0;
  const qualityLabel = currentQuality === -1 ? "Auto" : qualities.find(q => q.index === currentQuality)?.label || "Auto";
  const rateLabel = rate === 1 ? "Normal" : `${rate}×`;
  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const controlsVisible = !idle || showSettings;

  /* ──── Processing / Failed states ──── */
  if (status === "processing") {
    const progressLabel = processingProgress <= 0 ? "Starting…"
      : processingProgress < 15 ? "Downloading source…"
      : processingProgress < 60 ? "Transcoding video…"
      : processingProgress < 70 ? "Generating spritesheet…"
      : processingProgress < 90 ? "Uploading HLS segments…"
      : processingProgress < 100 ? "Finalizing…"
      : "Complete!";
    return (
      <div className="relative bg-black rounded-2xl overflow-hidden shadow-2xl aspect-video flex items-center justify-center">
        {poster && <img src={poster} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20 blur-sm" />}
        <div className="relative z-10 flex flex-col items-center gap-5 text-white w-full max-w-sm px-6">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-rose-500/20 animate-ping" />
            <Loader2 size={52} className="animate-spin text-rose-500 relative z-10" />
          </div>
          <div className="text-lg font-semibold tracking-tight">Processing your video…</div>
          <div className="text-sm text-neutral-400 max-w-xs text-center">{progressLabel}</div>
          {/* Progress bar */}
          <div className="w-full">
            <div className="flex justify-between text-xs text-neutral-500 mb-1.5">
              <span>Progress</span>
              <span className="text-rose-400 font-bold tabular-nums">{Math.round(processingProgress)}%</span>
            </div>
            <div className="w-full bg-neutral-800 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-rose-600 to-rose-400 rounded-full transition-all duration-500 relative"
                style={{ width: `${Math.min(processingProgress, 100)}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-neutral-500 bg-white/5 px-4 py-1.5 rounded-full border border-white/10">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> Transcoding in progress
          </div>
        </div>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="relative bg-black rounded-2xl overflow-hidden shadow-2xl aspect-video flex items-center justify-center">
        <div className="text-center text-white p-6">
          <X size={48} className="mx-auto mb-4 text-rose-500/60" />
          <div className="text-lg font-semibold text-rose-400 mb-2">Processing Failed</div>
          <div className="text-sm text-neutral-400">Please try re-uploading your video.</div>
        </div>
      </div>
    );
  }

  /* ──── Main player ──── */
  return (
    <div
      ref={containerRef}
      className={`vidora-player relative bg-black overflow-hidden shadow-2xl aspect-video select-none ${isFullscreen ? "" : "rounded-2xl"}`}
      style={{ cursor: idle ? "none" : "default" }}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        poster={poster}
        className="absolute inset-0 w-full h-full object-contain"
        playsInline
        onClick={togglePlay}
        onDoubleClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          skip(e.clientX - rect.left > rect.width / 2 ? 10 : -10);
        }}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={(e) => setDuration(e.target.duration)}
        onPlay={() => {
          setPlaying(true);
          if (!remoteAction.current && socket && partyId && isHost && videoRef.current) socket.emit("sync-play", { videoId, partyId, time: videoRef.current.currentTime });
          remoteAction.current = false;
        }}
        onPause={() => {
          setPlaying(false);
          if (!remoteAction.current && socket && partyId && isHost) socket.emit("sync-pause", { videoId, partyId });
          remoteAction.current = false;
        }}
        onSeeked={() => {
          if (!remoteAction.current && socket && partyId && isHost && videoRef.current) socket.emit("sync-seek", { videoId, partyId, time: videoRef.current.currentTime });
          remoteAction.current = false;
        }}
        onWaiting={() => setWaiting(true)}
        onCanPlay={() => setWaiting(false)}
        onVolumeChange={(e) => { setVolume(e.target.volume); setMuted(e.target.muted); }}
      />

      {/* Buffering spinner */}
      {waiting && playing && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <Loader2 size={48} className="animate-spin text-white/80" />
        </div>
      )}

      {/* Big play button */}
      {!playing && !waiting && !error && !showResume && (!partyId || isHost) && (
        <button onClick={togglePlay} className="absolute inset-0 m-auto w-[72px] h-[72px] flex items-center justify-center bg-rose-500/90 rounded-full text-white hover:bg-rose-500 hover:scale-105 active:scale-95 transition-all duration-200 z-10 shadow-[0_0_40px_rgba(225,29,72,0.4)]">
          <Play size={32} fill="currentColor" className="ml-1" />
        </button>
      )}

      {/* Viewer waiting for host indicator */}
      {!playing && !waiting && !error && !showResume && partyId && !isHost && (
        <div className="absolute inset-0 m-auto w-fit h-fit flex items-center gap-2 bg-black/60 backdrop-blur-md px-5 py-3 rounded-full text-white z-10 shadow-2xl border border-white/10">
          <Users size={20} className="text-rose-400" />
          <span className="font-semibold text-sm tracking-wide">Waiting for Host</span>
        </div>
      )}

      {/* Skip animation overlays */}
      {skipAnim && (
        <div className={`absolute top-0 bottom-0 ${skipAnim === "fwd" ? "right-0 w-1/3" : "left-0 w-1/3"} flex items-center justify-center z-20 pointer-events-none`}>
          <div className="flex flex-col items-center gap-1 text-white animate-pulse">
            {skipAnim === "fwd" ? <SkipForward size={36} /> : <SkipBack size={36} />}
            <span className="text-xs font-bold">10s</span>
          </div>
        </div>
      )}

      {/* Resume prompt */}
      {showResume && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-black/80 backdrop-blur-lg border border-white/10 text-white text-sm px-5 py-3 rounded-2xl shadow-2xl">
          <span>Resume from <strong className="text-rose-400">{fmt(resumeSec)}</strong>?</span>
          <button onClick={() => { seek(resumeSec); setShowResume(false); }} className="bg-rose-500 hover:bg-rose-600 transition px-4 py-1.5 rounded-full text-xs font-bold">Resume</button>
          <button onClick={() => setShowResume(false)} className="text-neutral-400 hover:text-white transition text-xs">Dismiss</button>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm text-white text-center p-6 z-30">
          <div><X size={32} className="mx-auto mb-3 text-rose-400" /><p className="text-sm">{error}</p></div>
        </div>
      )}

      {/* ─── Controls layer ─── */}
      <div className={`absolute inset-0 flex flex-col justify-end transition-opacity duration-300 ${controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        {/* Gradient scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/20 pointer-events-none" />

        <div className="relative z-10 px-4 pb-3 pt-12">
          {/* Hover thumbnail */}
          {hoverTime !== null && (
            <div
              className="absolute bottom-[72px] z-20 pointer-events-none flex flex-col items-center"
              style={{
                left: `${hoverX}px`, transform: "translateX(-50%)",
                marginLeft: hoverX < 85 ? `${85 - hoverX}px` : hoverX > (containerRef.current?.clientWidth - 85) ? `-${hoverX - (containerRef.current?.clientWidth - 85)}px` : "0",
              }}
            >
              {spritesheetUrl && <div className="border-2 border-white/40 bg-black rounded-lg overflow-hidden shadow-2xl" style={getSpriteStyle()} />}
              <div className="text-[11px] bg-black/90 backdrop-blur-sm px-2.5 py-1 rounded-md mt-1.5 font-bold text-white tabular-nums">{fmt(hoverTime)}</div>
            </div>
          )}

          {/* Progress bar */}
          <div
            ref={progressBarRef}
            className="group/bar relative w-full h-5 flex items-end cursor-pointer mb-2"
            onMouseMove={handleBarHover}
            onMouseLeave={() => setHoverTime(null)}
            onClick={handleBarClick}
          >
            <div className="w-full h-[3px] group-hover/bar:h-[5px] transition-all rounded-full bg-white/20 overflow-hidden relative">
              {/* Buffered */}
              <div className="absolute inset-y-0 left-0 bg-white/20 rounded-full" style={{ width: `${bufPct}%` }} />
              {/* Progress */}
              <div className="absolute inset-y-0 left-0 bg-rose-500 rounded-full" style={{ width: `${pct}%` }} />
            </div>
            {/* Scrubber dot */}
            <div
              className="absolute h-[13px] w-[13px] bg-rose-500 rounded-full -translate-y-px scale-0 group-hover/bar:scale-100 transition-transform shadow-lg ring-2 ring-white/30"
              style={{ left: `calc(${pct}% - 6.5px)`, bottom: "0" }}
            />
            {/* Hover marker */}
            {hoverTime !== null && (
              <div className="absolute h-full top-0 w-[2px] bg-white/50 pointer-events-none" style={{ left: `${hoverX}px` }} />
            )}
          </div>

          {/* Controls row */}
          <div className="flex items-center justify-between gap-2">
            {/* Left controls */}
            <div className="flex items-center gap-3">
              <button onClick={togglePlay} className={`text-white transition-colors p-1 ${partyId && !isHost ? 'opacity-50 cursor-not-allowed' : 'hover:text-rose-400'}`} title={playing ? "Pause (K)" : "Play (K)"}>
                {playing ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
              </button>

              <button onClick={() => skip(-10)} className={`text-white/80 transition-colors p-1 ${partyId && !isHost ? 'opacity-50 cursor-not-allowed' : 'hover:text-white'}`} title="Back 10s (J)">
                <SkipBack size={18} />
              </button>
              <button onClick={() => skip(10)} className={`text-white/80 transition-colors p-1 ${partyId && !isHost ? 'opacity-50 cursor-not-allowed' : 'hover:text-white'}`} title="Forward 10s (L)">
                <SkipForward size={18} />
              </button>

              {/* Volume */}
              <div className="flex items-center gap-1 group/vol">
                <button onClick={toggleMute} className="text-white/80 hover:text-white transition-colors p-1" title="Mute (M)">
                  <VolumeIcon size={20} />
                </button>
                <div className="w-0 group-hover/vol:w-20 overflow-hidden transition-all duration-200">
                  <input
                    type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume}
                    onChange={(e) => changeVolume(Number(e.target.value))}
                    className="w-full h-1 accent-rose-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Time display */}
              <span className="text-xs text-white/80 font-medium tabular-nums ml-1">
                {fmt(currentTime)} <span className="text-white/40">/</span> {fmt(duration)}
              </span>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-2">
              {/* Settings menu */}
              <div className="relative">
                <button
                  onClick={() => { setShowSettings(s => !s); setSettingsPanel("main"); }}
                  className={`text-white/80 hover:text-white transition-colors p-1 ${showSettings ? "text-white" : ""}`}
                  title="Settings"
                >
                  <Settings size={19} className={`transition-transform duration-300 ${showSettings ? "rotate-45" : ""}`} />
                </button>

                {showSettings && (
                  <div className="absolute bottom-full mb-3 right-0 bg-neutral-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-30 min-w-[200px]" onClick={e => e.stopPropagation()}>
                    {settingsPanel === "main" && (
                      <>
                        <div className="px-4 py-2.5 text-[11px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/5">Settings</div>
                        <button onClick={() => setSettingsPanel("quality")} className="w-full flex items-center justify-between px-4 py-3 text-sm text-white hover:bg-white/5 transition">
                          <span>Quality</span>
                          <span className="flex items-center gap-1 text-neutral-400 text-xs"><span>{qualities.length > 0 ? qualityLabel : "Original"}</span><ChevronRight size={14} /></span>
                        </button>
                        <button onClick={() => setSettingsPanel("speed")} className="w-full flex items-center justify-between px-4 py-3 text-sm text-white hover:bg-white/5 transition">
                          <span>Speed</span>
                          <span className="flex items-center gap-1 text-neutral-400 text-xs"><span>{rateLabel}</span><ChevronRight size={14} /></span>
                        </button>
                      </>
                    )}

                    {settingsPanel === "quality" && (
                      <>
                        <button onClick={() => setSettingsPanel("main")} className="w-full flex items-center gap-2 px-4 py-2.5 text-[11px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/5 hover:bg-white/5 transition">
                          <ChevronRight size={12} className="rotate-180" /> Quality
                        </button>
                        {qualities.length > 0 ? (
                          <>
                            <button onClick={() => changeQuality(-1)} className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-white/5 transition ${currentQuality === -1 ? "text-rose-400 font-semibold" : "text-white"}`}>
                              <span>Auto</span>{currentQuality === -1 && <Check size={14} />}
                            </button>
                            {qualities.map(q => (
                              <button key={q.index} onClick={() => changeQuality(q.index)} className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-white/5 transition ${currentQuality === q.index ? "text-rose-400 font-semibold" : "text-white"}`}>
                                <span>{q.label} <span className="text-neutral-500 text-xs ml-1">{Math.round(q.bitrate / 1000)}k</span></span>
                                {currentQuality === q.index && <Check size={14} />}
                              </button>
                            ))}
                          </>
                        ) : (
                          <div className="px-4 py-3 text-sm text-white">
                            <div className="flex items-center justify-between">
                              <span>Original</span><Check size={14} className="text-rose-400" />
                            </div>
                            <p className="text-[11px] text-neutral-500 mt-1.5">Adaptive quality available after transcoding</p>
                          </div>
                        )}
                      </>
                    )}

                    {settingsPanel === "speed" && (
                      <>
                        <button onClick={() => setSettingsPanel("main")} className="w-full flex items-center gap-2 px-4 py-2.5 text-[11px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/5 hover:bg-white/5 transition">
                          <ChevronRight size={12} className="rotate-180" /> Speed
                        </button>
                        {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(r => (
                          <button key={r} onClick={() => changeRate(r)} className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-white/5 transition ${rate === r ? "text-rose-400 font-semibold" : "text-white"}`}>
                            <span>{r === 1 ? "Normal" : `${r}×`}</span>{rate === r && <Check size={14} />}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>

              <button onClick={togglePiP} className="text-white/80 hover:text-white transition-colors p-1" title="Picture-in-Picture">
                <PictureInPicture2 size={18} />
              </button>
              <button onClick={toggleFS} className="text-white/80 hover:text-white transition-colors p-1" title="Fullscreen (F)">
                {isFullscreen ? <Minimize size={19} /> : <Maximize size={19} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default PlayerWrapper;
