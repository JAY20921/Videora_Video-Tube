import React, { useEffect, useState } from 'react';
import VideoCard from './VideoCard';
import { fetchVideos } from '../api/videos';

export default function RecommendedVideos({ currentVideoId, limit = 6 }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchVideos({ limit: 24 }).then((res) => {
      // res may be an array or object
      const list = Array.isArray(res) ? res : res?.videos || res?.data || [];
      // filter out current video and take `limit`
      const filtered = list.filter((v) => v._id !== currentVideoId).slice(0, limit);
      if (mounted) setVideos(filtered);
    }).catch((e) => {
      console.error('Failed to fetch recommended videos', e);
    }).finally(() => mounted && setLoading(false));

    return () => { mounted = false; };
  }, [currentVideoId, limit]);

  if (loading) return <div className="text-sm text-neutral-400">Loading recommendations...</div>;
  if (!videos || videos.length === 0) return <div className="text-sm text-neutral-500">No recommendations available</div>;

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-3">Up next</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {videos.map((v) => (
          <VideoCard key={v._id} video={v} />
        ))}
      </div>
    </div>
  );
}
