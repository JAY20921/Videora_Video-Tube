import React, { useEffect, useState } from "react";
import { fetchVideos } from "../api/videos";
import { useAuth } from "../context/AuthContext";
import VideoCard from "../components/VideoCard";
import SkeletonGrid from "../components/SkeletonGrid";
import ContinueWatching from "../components/ContinueWatching";

export default function Home() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchVideos({ limit: 24 })
      .then((arr) => setVideos(Array.isArray(arr) ? arr : []))
      .catch(() => setVideos([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      {/* Continue Watching — only visible if user has in-progress videos */}
      {user && <ContinueWatching />}

      <h1 className="text-2xl font-semibold mb-4">Discover</h1>

      {loading ? (
        <SkeletonGrid />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {videos.length > 0 ? (
            videos.map((v) => <VideoCard key={v._id || v.id} video={v} />)
          ) : (
            <div className="text-gray-400 col-span-full">No videos found</div>
          )}
        </div>
      )}
    </div>
  );
}
