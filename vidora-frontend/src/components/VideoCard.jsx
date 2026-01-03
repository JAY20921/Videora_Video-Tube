import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

export default function VideoCard({ video }) {
  return (
    <motion.article whileHover={{ y: -8 }} className="bg-neutral-900 rounded-lg overflow-hidden shadow-md border border-neutral-800 transition">
      <Link to={`/video/${video._id}`} className="block">
        <div className="relative">
          <img src={video.thumbnailUrl || video.thumbnail} alt={video.title} className="w-full h-44 object-cover"/>
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 hover:opacity-100 transition-opacity" />
          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">{video.duration}</div>
        </div>

        <div className="p-3">
          <h3 className="text-sm font-semibold line-clamp-2">{video.title}</h3>
          <p className="text-xs text-neutral-400 mt-1">{video.creatorName || video.uploader}</p>
          <div className="text-xs text-neutral-500 mt-2">{video.views} views • {new Date(video.createdAt).toLocaleDateString()}</div>
        </div>
      </Link>
    </motion.article>
  );
}
