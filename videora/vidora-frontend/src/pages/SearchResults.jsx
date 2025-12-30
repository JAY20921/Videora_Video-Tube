import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { searchVideos } from "../api/videos";
import VideoCard from "../components/VideoCard";
import SkeletonGrid from "../components/SkeletonGrid";

export default function SearchResults() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [params] = useSearchParams();
  const q = params.get("q") || "";

  useEffect(() => {
    if (!q) return;
    setLoading(true);
    searchVideos(q)
      .then((res) => {
        // `searchVideos` now returns a normalized array of videos
        setVideos(Array.isArray(res) ? res : []);
      })
      .finally(() => setLoading(false));
  }, [q]);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Search Results for “{q}”</h1>
      {loading ? <SkeletonGrid /> : videos.length === 0 ? <div>No videos found.</div> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {videos.map(v => <VideoCard key={v._id} video={v} />)}
        </div>
      )}
    </div>
  );
}
