import React, { useEffect, useState } from "react";
import { getChannelStats, getChannelVideos } from "../api/dashboard";
import { Eye, Users, ThumbsUp, Film, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import Loading from "../components/Loading";

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-neutral-800/50 border border-neutral-700/50 rounded-xl p-5 flex items-center gap-4"
    >
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon size={22} />
      </div>
      <div>
        <div className="text-2xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</div>
        <div className="text-xs text-neutral-400 mt-0.5">{label}</div>
      </div>
    </motion.div>
  );
}

function formatDuration(s) {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getChannelStats(), getChannelVideos()])
      .then(([s, v]) => {
        setStats(s);
        setVideos(Array.isArray(v) ? v : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading text="Loading dashboard..." />;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChart3 size={24} className="text-rose-400" />
        <h1 className="text-2xl font-bold">Creator Dashboard</h1>
      </div>

      {/* Stats grid */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Film} label="Total Videos" value={stats.totalVideos} color="bg-blue-500/15 text-blue-400" />
          <StatCard icon={Eye} label="Total Views" value={stats.totalViews} color="bg-emerald-500/15 text-emerald-400" />
          <StatCard icon={Users} label="Subscribers" value={stats.totalSubscribers} color="bg-purple-500/15 text-purple-400" />
          <StatCard icon={ThumbsUp} label="Total Likes" value={stats.totalLikes} color="bg-rose-500/15 text-rose-400" />
        </div>
      )}

      {/* Video management table */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Your Videos</h2>
        {videos.length === 0 ? (
          <div className="text-center py-12 text-neutral-500">
            <Film size={48} className="mx-auto mb-3 opacity-30" />
            <p>No videos uploaded yet.</p>
            <Link to="/upload" className="text-rose-400 text-sm mt-2 inline-block hover:underline">Upload your first video →</Link>
          </div>
        ) : (
          <div className="bg-neutral-800/30 border border-neutral-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-700/50 text-neutral-400 text-left">
                  <th className="px-4 py-3 font-medium">Video</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">Duration</th>
                  <th className="px-4 py-3 font-medium">Views</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Status</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Date</th>
                </tr>
              </thead>
              <tbody>
                {videos.map((v) => (
                  <tr key={v._id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition">
                    <td className="px-4 py-3">
                      <Link to={`/video/${v._id}`} className="flex items-center gap-3 group">
                        <div className="w-24 h-14 rounded-lg overflow-hidden bg-neutral-800 flex-shrink-0">
                          {v.thumbnail && (
                            <img src={v.thumbnail} alt="" className="w-full h-full object-cover" />
                          )}
                        </div>
                        <span className="text-white font-medium group-hover:text-rose-400 transition line-clamp-2">
                          {v.title}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-neutral-400 hidden sm:table-cell">{formatDuration(v.duration)}</td>
                    <td className="px-4 py-3 text-neutral-300">{v.views?.toLocaleString() || 0}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        v.isPublished ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"
                      }`}>
                        {v.isPublished ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-500 text-xs hidden md:table-cell">
                      {new Date(v.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
