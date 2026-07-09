import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getPlaylistById } from "../api/playlists";
import { BookOpen, Circle, Play, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

export default function SkillTree() {
  const { id } = useParams();
  const [playlist, setPlaylist] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPlaylistById(id)
      .then((res) => {
        setPlaylist(res);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!playlist) {
    return <div className="text-center mt-20 text-neutral-400">Skill tree not found.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <Link to="/explore" className="inline-flex items-center gap-2 text-neutral-400 hover:text-white mb-8 transition">
        <ArrowLeft size={18} /> Back to Explore
      </Link>
      
      <div className="mb-12 border-b border-neutral-800 pb-8">
        <h1 className="text-3xl font-semibold mb-3 tracking-tight text-white">{playlist.name}</h1>
        <p className="text-lg text-neutral-400 max-w-3xl leading-relaxed">{playlist.description}</p>
      </div>

      <div className="relative pl-6 md:pl-8">
        {/* Subtle timeline line */}
        <div className="absolute left-[7px] md:left-[11px] top-4 bottom-4 w-[2px] bg-neutral-800" />
        
        <div className="space-y-10">
          {playlist.videos.map((video, index) => (
            <motion.div 
              key={video._id} 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="relative flex flex-col sm:flex-row items-start gap-6 group"
            >
              {/* Minimal Node */}
              <div className="absolute -left-6 md:-left-8 top-5 w-4 h-4 rounded-full bg-neutral-900 border-2 border-neutral-600 group-hover:border-white group-hover:bg-white transition-colors" />
              
              {/* Order Number */}
              <div className="hidden sm:block w-12 pt-4 text-sm font-medium text-neutral-500">
                {String(index + 1).padStart(2, '0')}
              </div>
              
              {/* Video Card */}
              <Link to={`/video/${video._id}`} className="flex-1 block w-full">
                <div className="flex flex-col md:flex-row gap-5 p-3 rounded-2xl hover:bg-neutral-900 transition-colors border border-transparent hover:border-neutral-800">
                  <div className="relative w-full md:w-56 aspect-video rounded-lg overflow-hidden bg-neutral-900 shrink-0">
                    <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                    <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-xs font-medium text-white backdrop-blur-sm">
                      Play
                    </div>
                  </div>
                  <div className="flex-1 py-1">
                    <h3 className="text-lg font-medium text-neutral-100 group-hover:text-white mb-2 leading-snug">
                      {video.title}
                    </h3>
                    <p className="text-sm text-neutral-500 line-clamp-2 mb-3 leading-relaxed">
                      {video.description || "Learn the fundamental concepts of this topic in this comprehensive lesson."}
                    </p>
                    <div className="flex items-center gap-3 text-xs font-medium text-neutral-500">
                      <span className="text-neutral-400">{video.owner?.fullName || "Instructor"}</span>
                      <span className="w-1 h-1 rounded-full bg-neutral-700" />
                      <span>{video.views} views</span>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
