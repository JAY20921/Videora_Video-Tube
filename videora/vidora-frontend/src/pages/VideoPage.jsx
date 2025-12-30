import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getVideoById } from "../api/videos";
import PlayerWrapper from "../components/PlayerWrapper";
import RecommendedVideos from "../components/RecommendedVideos";
import Loading from "../components/Loading";

export default function VideoPage() {
  const { id } = useParams();
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    getVideoById(id).then((res)=> {
      const v = res?.video ?? res?.data ?? res;
      console.log('Video data:', v);
      console.log('Video URL:', v.videoFile || v.fileUrl || v.videoUrl);
      setVideo(v);
    }).catch((error) => {
      console.error('Error fetching video:', error);
    }).finally(()=>setLoading(false));
  },[id]);

  if (loading) return <Loading text="Loading video..." />;
  if (!video) return <div>Video not found</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        {/* Provide a safe URL and poster to the PlayerWrapper. The component will
          attempt an MP4 fallback automatically for Cloudinary resources. */}
        <PlayerWrapper videoId={video._id} url={video.videoFile || video.fileUrl || video.videoUrl} poster={video.thumbnailUrl || video.thumbnail} />
        <h2 className="text-xl font-semibold mt-4">{video.title}</h2>
        <div className="text-sm text-neutral-400 mt-2">{video.views} views • {new Date(video.createdAt).toLocaleString()}</div>
        <div className="mt-4 text-sm text-neutral-300 whitespace-pre-line">{video.description}</div>
      </div>

      <aside>
        <RecommendedVideos currentVideoId={video._id} />
      </aside>
    </div>
  );
}
