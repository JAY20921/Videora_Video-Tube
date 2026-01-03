import React, { useEffect, useState } from "react";
import { fetchVideos } from "../api/videos";
import { useAuth } from "../context/AuthContext";
import VideoCard from "../components/VideoCard";
import SkeletonGrid from "../components/SkeletonGrid";

export default function Home() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const opts = { limit: 24 };
    if (user?. _id) opts.userId = user._id;

    fetchVideos(opts)
      .then((res) => {
        console.log("HOME API RESPONSE:", res);

        // Normalize API response no matter what shape it has
        let arr =
          Array.isArray(res)
            ? res
            : Array.isArray(res?.videos)
              ? res.videos
              : Array.isArray(res?.data)
                ? res.data
                : Array.isArray(res?.items)
                  ? res.items
                  : res && typeof res === "object"
                    ? [res]
                    : [];

        setVideos(arr);
      })
      .catch((err) => {
        console.error("HOME ERROR:", err);
        setVideos([]);
      })
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Discover</h1>

      {loading ? (
        <SkeletonGrid />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {Array.isArray(videos) && videos.length > 0 ? (
            videos.map((v) => <VideoCard key={v._id || v.id} video={v} />)
          ) : (
            <div className="text-gray-400">No videos found</div>
          )}
        </div>
      )}
    </div>
  );
}
