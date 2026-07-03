import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fetchVideos, deleteVideo } from "../api/videos";
import { getChannelProfile } from "../api/users";
import VideoCard from "../components/VideoCard";
import SubscribeButton from "../components/SubscribeButton";
import Loading from "../components/Loading";
import { Upload, Film } from "lucide-react";
import { useToast } from "../components/ToastProvider";

export default function ProfilePage() {
  const { username } = useParams();
  const { user } = useAuth();
  const push = useToast();

  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    // Fetch channel profile
    if (username) {
      getChannelProfile(username)
        .then((data) => {
          if (mounted) setChannel(data);
        })
        .catch(() => {});
    }

    // Fetch videos and filter by username
    fetchVideos({ limit: 50 })
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.videos ?? res?.data ?? [];
        const filtered = list.filter((v) => {
          if (!username) return true;
          const owner = v.owner || v;
          return String(owner?.username || "").toLowerCase() === String(username).toLowerCase();
        });
        if (mounted) setVideos(filtered);
      })
      .catch(() => {})
      .finally(() => mounted && setLoading(false));

    return () => { mounted = false; };
  }, [username]);

  const isOwnProfile = user && user.username === username;
  const displayData = channel || (isOwnProfile ? user : null);

  const handleDelete = async (videoId) => {
    if (!window.confirm("Are you sure you want to delete this video? This action cannot be undone.")) return;
    try {
      await deleteVideo(videoId);
      setVideos((prev) => prev.filter((v) => v._id !== videoId));
      push("Video deleted successfully", { type: "success" });
    } catch (err) {
      push(err.response?.data?.message || "Failed to delete video", { type: "error" });
    }
  };

  if (loading) return <Loading text="Loading profile..." />;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Cover image */}
      <div className="w-full h-48 rounded-2xl overflow-hidden bg-neutral-800 relative">
        {displayData?.coverImage ? (
          <img
            src={displayData.coverImage}
            alt="Cover"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-neutral-800 via-neutral-700 to-neutral-800" />
        )}
      </div>

      {/* Profile card */}
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 -mt-12 relative z-10 mx-4">
        <div className="flex items-end sm:items-center gap-5 flex-wrap">
          {/* Avatar */}
          <div className="w-24 h-24 -mt-16 rounded-full overflow-hidden border-4 border-neutral-950 bg-neutral-700 flex-shrink-0">
            {displayData?.avatar ? (
              <img src={displayData.avatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-white">
                {(displayData?.fullName?.[0] || username?.[0] || "U").toUpperCase()}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold">{displayData?.fullName || username}</h2>
            <div className="text-sm text-neutral-500">@{displayData?.username || username}</div>
            <div className="text-sm text-neutral-400 mt-1.5 flex items-center gap-3 flex-wrap">
              <span>{channel?.subscribersCount ?? 0} subscribers</span>
              <span>·</span>
              <span>{videos.length} videos</span>
              <span>·</span>
              <span>{videos.reduce((s, v) => s + (v?.views || 0), 0).toLocaleString()} total views</span>
            </div>
          </div>

          {/* Actions */}
          <div>
            {isOwnProfile ? (
              <Link
                to="/upload"
                className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full text-sm font-semibold transition shadow-lg shadow-rose-500/20"
              >
                <Upload size={16} /> Upload
              </Link>
            ) : displayData?._id ? (
              <SubscribeButton
                channelId={displayData._id}
                initialSubscribed={channel?.isSubscribed ?? false}
                subscriberCount={channel?.subscribersCount ?? 0}
              />
            ) : null}
          </div>
        </div>
      </div>

      {/* Videos section */}
      <section className="px-4">
        <div className="flex items-center gap-2 mb-4">
          <Film size={18} className="text-neutral-400" />
          <h3 className="text-lg font-semibold">Videos</h3>
        </div>

        {videos.length === 0 ? (
          <div className="text-center py-12 text-neutral-500">
            <Film size={40} className="mx-auto mb-3 opacity-30" />
            <p>No videos uploaded yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {videos.map((v) => (
              <VideoCard 
                key={v._id} 
                video={v} 
                onDelete={(isOwnProfile || user?.role === "admin") ? handleDelete : undefined} 
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
