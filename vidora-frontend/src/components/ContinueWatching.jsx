import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { getWatchHistory } from "../api/watchProgress";

/**
 * ContinueWatching — displays the user's in-progress videos.
 * Only shows videos where progressSeconds > 30 and the video is published.
 * The progress bar overlay gives an instant visual cue of how much is left.
 */
export default function ContinueWatching() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getWatchHistory({ limit: 6 })
      .then(({ history }) => setItems(history || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading || items.length === 0) return null;

  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <span className="text-rose-500">▶</span> Continue Watching
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {items.map(({ video, progressSeconds }) => {
          if (!video) return null;
          const durationSec = video.duration ?? 0;
          const pct = durationSec > 0 ? Math.min((progressSeconds / durationSec) * 100, 100) : 0;
          const formatTime = (s) => {
            const m = Math.floor(s / 60);
            const sec = Math.floor(s % 60);
            return `${m}:${sec.toString().padStart(2, "0")}`;
          };

          return (
            <motion.article
              key={video._id}
              whileHover={{ y: -4 }}
              className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-md"
            >
              <Link to={`/video/${video._id}`} className="block">
                {/* Thumbnail with progress bar overlay */}
                <div className="relative">
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-full h-36 object-cover"
                  />
                  {/* Dark gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  {/* "Resume from" label */}
                  <div className="absolute bottom-6 left-2 text-xs text-white bg-black/70 rounded px-1.5 py-0.5">
                    Resume {formatTime(progressSeconds)}
                  </div>
                  {/* Progress bar */}
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-neutral-700">
                    <div
                      className="h-full bg-rose-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="p-3">
                  <h3 className="text-sm font-semibold line-clamp-2">{video.title}</h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    {video.owner?.fullName || video.owner?.username}
                  </p>
                </div>
              </Link>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}
