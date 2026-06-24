import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { getVideoById, incrementView } from "../api/videos";
import PlayerWrapper from "../components/PlayerWrapper";
import RecommendedVideos from "../components/RecommendedVideos";
import CommentSection from "../components/CommentSection";
import LikeButton from "../components/LikeButton";
import SubscribeButton from "../components/SubscribeButton";
import Loading from "../components/Loading";
import AiTutor from "../components/AiTutor";
import { Share2, Eye } from "lucide-react";

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function VideoPage() {
  const { id } = useParams();
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const playerRef = useRef(null);

  const handleSeekTo = useCallback((seconds) => {
    if (playerRef.current?.seekTo) {
      playerRef.current.seekTo(seconds);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    getVideoById(id)
      .then((res) => {
        const v = res?.video ?? res?.data ?? res;
        setVideo(v);
        // Best-effort view increment
        incrementView(id).catch(() => {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <Loading text="Loading video..." />;
  if (!video) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
        <div className="text-6xl mb-4">📺</div>
        <h2 className="text-xl font-semibold text-white mb-2">Video not found</h2>
        <p className="text-sm">This video may have been removed or doesn't exist.</p>
      </div>
    );
  }

  const owner = video.owner || {};

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main content */}
      <div className="lg:col-span-2 space-y-4">
        {/* Player */}
        <PlayerWrapper
          ref={playerRef}
          videoId={video._id}
          url={video.videoFile || video.fileUrl || video.videoUrl}
          hlsUrl={video.hlsUrl || ""}
          spritesheetUrl={video.spritesheetUrl || ""}
          poster={video.thumbnailUrl || video.thumbnail}
          videoStatus={video.status || "ready"}
        />

        {/* Title */}
        <h1 className="text-xl font-bold leading-tight">{video.title}</h1>

        {/* Meta row: views + date + actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-sm text-neutral-400">
            <span className="flex items-center gap-1">
              <Eye size={15} /> {video.views?.toLocaleString() || 0} views
            </span>
            <span>•</span>
            <span>{timeAgo(video.createdAt)}</span>
          </div>

          <div className="flex items-center gap-2">
            <LikeButton
              videoId={video._id}
              initialLiked={video.isLiked ?? false}
              initialCount={video.likesCount ?? 0}
            />
            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-neutral-800/60 border border-neutral-700 text-neutral-300 hover:bg-neutral-700/60 transition text-sm"
            >
              <Share2 size={16} />
              {copied ? "Copied!" : "Share"}
            </button>
          </div>
        </div>

        {/* Channel info bar */}
        <div className="flex items-center justify-between bg-neutral-800/40 rounded-xl p-4 border border-neutral-800">
          <Link
            to={`/profile/${owner.username}`}
            className="flex items-center gap-3 group"
          >
            <div className="w-11 h-11 rounded-full bg-neutral-700 overflow-hidden flex-shrink-0">
              {owner.avatar ? (
                <img src={owner.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-lg font-bold text-white">
                  {owner.fullName?.[0]?.toUpperCase() || owner.username?.[0]?.toUpperCase() || "?"}
                </div>
              )}
            </div>
            <div>
              <div className="font-semibold text-white group-hover:text-rose-400 transition">
                {owner.fullName || owner.username || "Unknown"}
              </div>
              <div className="text-xs text-neutral-500">@{owner.username}</div>
            </div>
          </Link>

          <SubscribeButton
            channelId={owner._id}
            initialSubscribed={video.isSubscribed ?? false}
            subscriberCount={video.subscribersCount ?? owner.subscribersCount ?? 0}
          />
        </div>

        {/* Description */}
        {video.description && (
          <div className="bg-neutral-800/30 rounded-xl p-4 border border-neutral-800">
            <p className="text-sm text-neutral-300 whitespace-pre-line leading-relaxed">{video.description}</p>
          </div>
        )}

        {/* Comments */}
        <CommentSection videoId={video._id} />
      </div>

      {/* Sidebar */}
      <aside className="space-y-4">
        <RecommendedVideos currentVideoId={video._id} />
      </aside>
      {/* AI Tutor */}
      <AiTutor videoId={video._id} onSeekTo={handleSeekTo} />
    </div>
  );
}
