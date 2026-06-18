import React, { useState } from "react";
import { Heart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { likeVideo } from "../api/likes";

/**
 * LikeButton — animated heart toggle for videos.
 * @param {string} videoId
 * @param {boolean} initialLiked - whether the current user has liked this video
 * @param {number} initialCount - initial like count
 */
export default function LikeButton({ videoId, initialLiked = false, initialCount = 0 }) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [animating, setAnimating] = useState(false);

  const handleToggle = async () => {
    // Optimistic update
    setLiked((prev) => !prev);
    setCount((prev) => (liked ? prev - 1 : prev + 1));
    setAnimating(true);
    setTimeout(() => setAnimating(false), 600);

    try {
      await likeVideo(videoId);
    } catch {
      // Revert on error
      setLiked((prev) => !prev);
      setCount((prev) => (liked ? prev + 1 : prev - 1));
    }
  };

  return (
    <button
      onClick={handleToggle}
      className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-200 ${
        liked
          ? "bg-rose-600/15 border-rose-500/40 text-rose-400"
          : "bg-neutral-800/60 border-neutral-700 text-neutral-300 hover:bg-neutral-700/60"
      }`}
    >
      <motion.div
        animate={animating ? { scale: [1, 1.4, 1] } : {}}
        transition={{ duration: 0.4 }}
      >
        <Heart
          size={18}
          fill={liked ? "currentColor" : "none"}
          strokeWidth={liked ? 0 : 2}
        />
      </motion.div>
      <span className="text-sm font-medium">{count}</span>
    </button>
  );
}
