import React, { useEffect, useState } from "react";
import { getLikedVideos } from "../api/likes";
import VideoCard from "../components/VideoCard";
import Loading from "../components/Loading";
import { Heart } from "lucide-react";

export default function LikedVideos() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLikedVideos()
      .then((res) => {
        const data = res?.data?.data ?? res?.data ?? res;
        // Each item has a .video populated field
        const list = Array.isArray(data)
          ? data.map((item) => item.video).filter(Boolean)
          : [];
        setVideos(list);
      })
      .catch(() => setVideos([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading text="Loading liked videos..." />;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Heart size={22} className="text-rose-400" />
        <h1 className="text-2xl font-bold">Liked Videos</h1>
        <span className="text-sm text-neutral-500 ml-1">{videos.length} video{videos.length !== 1 ? "s" : ""}</span>
      </div>

      {videos.length === 0 ? (
        <div className="text-center py-16 text-neutral-500">
          <Heart size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg">No liked videos yet</p>
          <p className="text-sm mt-1">Videos you like will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {videos.map((v) => (
            <VideoCard key={v._id} video={v} />
          ))}
        </div>
      )}
    </div>
  );
}
