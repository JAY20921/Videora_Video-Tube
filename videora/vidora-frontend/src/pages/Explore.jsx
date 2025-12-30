import React, { useEffect, useState } from "react";
import { getAllVideos } from "../api/videos";
import VideoCard from "../components/VideoCard";
import SkeletonGrid from "../components/SkeletonGrid";

export default function Explore() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllVideos()
      .then((res) => {
        const arr = res?.data?.videos || [];
        setVideos(arr);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Explore</h1>
      {loading ? (
        <SkeletonGrid />
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
