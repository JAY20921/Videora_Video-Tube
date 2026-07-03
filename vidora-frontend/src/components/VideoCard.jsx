import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
  if (seconds < 31536000) return `${Math.floor(seconds / 2592000)}mo ago`;
  return `${Math.floor(seconds / 31536000)}y ago`;
}

function formatDuration(s) {
  if (!s || isNaN(s)) return "0:00";
  const totalSeconds = Math.floor(s);
  const m = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function VideoCard({ video, onDelete }) {
  return (
    <motion.article
      whileHover={{ y: -4, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="relative bg-neutral-900/50 rounded-xl overflow-hidden border border-neutral-800/50 hover:border-neutral-700 transition-colors group"
    >
      {onDelete && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(video._id); }}
          className="absolute top-2 right-2 bg-red-600/90 hover:bg-red-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-lg"
          title="Delete Video"
        >
          <Trash2 size={16} />
        </button>
      )}
      <Link to={`/video/${video._id}`} className="block relative z-10">
        {/* Thumbnail */}
        <div className="relative aspect-video bg-neutral-800 overflow-hidden">
          <img
            src={video.thumbnailUrl || video.thumbnail}
            alt={video.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded font-medium">
            {formatDuration(video.duration)}
          </div>
        </div>

        {/* Info */}
        <div className="p-3 flex gap-3">
          {/* Owner avatar */}
          {video.owner?.avatar && (
            <div className="w-8 h-8 rounded-full overflow-hidden bg-neutral-700 flex-shrink-0 mt-0.5">
              <img src={video.owner.avatar} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold line-clamp-2 leading-snug text-white">
              {video.title}
            </h3>
            <p className="text-xs text-neutral-500 mt-1">
              {video.owner?.fullName || video.owner?.username || "Unknown"}
            </p>
            <div className="text-xs text-neutral-600 mt-0.5">
              {video.views?.toLocaleString() || 0} views · {timeAgo(video.createdAt)}
            </div>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}
