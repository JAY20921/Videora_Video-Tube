import { useEffect, useRef, useCallback } from "react";
import { saveProgress, getProgress } from "../api/watchProgress";

const HEARTBEAT_INTERVAL_MS = 10_000; // save every 10 seconds
const RESUME_THRESHOLD_S = 5;         // only prompt if > 5 seconds watched

/**
 * useVideoProgress — attaches to a <video> DOM element.
 * - Sends a heartbeat every 10s to save playback position.
 * - Uses navigator.sendBeacon on tab close to save final position reliably.
 * - On mount, fetches saved progress and resolves a "resumeTime" for the player.
 *
 * @param {string} videoId  - MongoDB video _id
 * @param {React.RefObject} videoRef - ref to the <video> element
 * @returns {{ resumeTime: number | null }} - seconds to resume from (null if fresh start)
 */
export function useVideoProgress(videoId, videoRef) {
  const resumeTimeRef = useRef(null);
  const intervalRef = useRef(null);

  // Save progress helper
  const persist = useCallback(() => {
    const el = videoRef.current;
    if (!el || !videoId || isNaN(el.currentTime)) return;
    saveProgress({ videoId, progressSeconds: Math.floor(el.currentTime) });
  }, [videoId, videoRef]);

  useEffect(() => {
    if (!videoId) return;

    // Fetch saved progress on mount
    getProgress(videoId).then(({ progressSeconds }) => {
      if (progressSeconds > RESUME_THRESHOLD_S) {
        resumeTimeRef.current = progressSeconds;
      }
    });

    // Heartbeat: save every 10s while playing
    intervalRef.current = setInterval(persist, HEARTBEAT_INTERVAL_MS);

    // Save on page unload (e.g. tab closed, navigation)
    const handleUnload = () => persist();
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(intervalRef.current);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [videoId, persist]);

  return { resumeTimeRef };
}
