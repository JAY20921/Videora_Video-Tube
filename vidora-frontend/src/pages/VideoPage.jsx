import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, Link, useLocation, useNavigate } from "react-router-dom";
import { getVideoById, incrementView, retranscodeVideo, deleteVideo, getVideoStatus } from "../api/videos";
import PlayerWrapper from "../components/PlayerWrapper";
import RecommendedVideos from "../components/RecommendedVideos";
import CommentSection from "../components/CommentSection";
import LikeButton from "../components/LikeButton";
import SubscribeButton from "../components/SubscribeButton";
import Loading from "../components/Loading";
import AiTutor from "../components/AiTutor";
import LiveChat from "../components/LiveChat";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { Share2, Eye, RefreshCw, Users, Copy, DoorOpen, Trash2 } from "lucide-react";

import { useToast } from "../components/ToastProvider";

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
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const push = useToast();
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [retranscoding, setRetranscoding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const playerRef = useRef(null);

  const socket = useSocket();
  const [partyId, setPartyId] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinPartyCode, setJoinPartyCode] = useState("");
  const [chatEnabled, setChatEnabled] = useState(true);

  // Poll processing progress when video is in "processing" state
  useEffect(() => {
    if (!video || video.status !== "processing") return;
    setProcessingProgress(video.progress || 0);

    const iv = setInterval(async () => {
      try {
        const data = await getVideoStatus(id);
        setProcessingProgress(data.progress || 0);
        if (data.status === "ready") {
          // Reload video data when processing completes
          const res = await getVideoById(id);
          const v = res?.video ?? res?.data ?? res;
          setVideo(v);
          setProcessingProgress(100);
          push("Video transcoding complete!", { type: "success" });
          clearInterval(iv);
        } else if (data.status === "failed") {
          setVideo(prev => ({ ...prev, status: "failed" }));
          push("Video transcoding failed", { type: "error" });
          clearInterval(iv);
        }
      } catch {}
    }, 3000);

    return () => clearInterval(iv);
  }, [video?.status, id]);

  const startStudyTogether = () => {
    if (!socket) return push("Not connected to server", { type: "error" });
    if (!socket.connected) socket.connect();
    socket.emit("create-watchparty", { videoId: id }, (res) => {
      if (res.partyId) {
        setPartyId(res.partyId);
        setIsHost(true);
        push(`Study Together started! Code: ${res.partyId}`, { type: "success" });
      }
    });
  };

  const joinStudyTogether = () => {
    if (!joinPartyCode.trim()) return;
    if (socket && !socket.connected) socket.connect();
    socket.emit("join-watchparty", { partyId: joinPartyCode.trim() }, (res) => {
      if (res.error) {
        push(res.error, { type: "error" });
      } else {
        if (res.videoId !== id) {
           socket.emit("leave-watchparty", { partyId: joinPartyCode.trim() });
           setShowJoinModal(false);
           navigate(`/video/${res.videoId}`, { state: { autoJoinCode: joinPartyCode.trim() } });
           return;
        }
        setPartyId(joinPartyCode.trim());
        setIsHost(false);
        setChatEnabled(res.chatEnabled);
        setShowJoinModal(false);
        push("Joined Study Together session!", { type: "success" });
      }
    });
  };

  const leaveStudyTogether = () => {
    socket.emit("leave-watchparty", { partyId });
    setPartyId(null);
    setIsHost(false);
  };

  useEffect(() => {
    if (!socket) return;
    const onEnded = () => {
      push("Host ended the Study Together session", { type: "info" });
      setPartyId(null);
      setIsHost(false);
    };
    const onChatToggled = (enabled) => {
      setChatEnabled(enabled);
      push(enabled ? "Host enabled chat" : "Host disabled chat", { type: "info" });
    };
    
    socket.on("watchparty-ended", onEnded);
    socket.on("chat-toggled", onChatToggled);
    return () => {
      socket.off("watchparty-ended", onEnded);
      socket.off("chat-toggled", onChatToggled);
    };
  }, [socket, push]);

  useEffect(() => {
    if (socket && location.state?.autoJoinCode && !partyId) {
      setJoinPartyCode(location.state.autoJoinCode);
      socket.emit("join-watchparty", { partyId: location.state.autoJoinCode }, (res) => {
        if (res.error) {
          push(res.error, { type: "error" });
        } else {
          setPartyId(location.state.autoJoinCode);
          setIsHost(false);
          setChatEnabled(res.chatEnabled);
          push("Joined Study Together session!", { type: "success" });
        }
      });
      // Clear the state so it doesn't re-trigger on refresh
      window.history.replaceState({}, document.title)
    }
  }, [socket, location.state, partyId, push]);

  const handleRetranscode = async () => {
    try {
      setRetranscoding(true);
      await retranscodeVideo(id);
      push("Video enqueued for transcoding!", { type: "success" });
      setVideo(prev => ({ ...prev, status: "processing", progress: 0 }));
      setProcessingProgress(0);
    } catch (err) {
      push(err.response?.data?.message || "Failed to retranscode", { type: "error" });
    } finally {
      setRetranscoding(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this video? This action cannot be undone.")) return;
    try {
      setDeleting(true);
      await deleteVideo(id);
      push("Video deleted successfully", { type: "success" });
      navigate("/");
    } catch (err) {
      push(err.response?.data?.message || "Failed to delete video", { type: "error" });
    } finally {
      setDeleting(false);
    }
  };


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
        if (v?.progress) setProcessingProgress(v.progress);
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
  const isProcessing = video.status === "processing";

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
          partyId={partyId}
          isHost={isHost}
          processingProgress={processingProgress}
        />

        {/* Title */}
        <h1 className="text-xl font-bold leading-tight">{video.title}</h1>

        <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-800/20 p-3 rounded-xl border border-neutral-800/50">
          <div className="flex items-center gap-3 text-sm text-neutral-400">
            <span className="flex items-center gap-1">
              <Eye size={15} /> {video.views?.toLocaleString() || 0} views
            </span>
            <span>•</span>
            <span>{timeAgo(video.createdAt)}</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Study Together Controls */}
            {partyId ? (
              <div className="flex items-center gap-2 bg-rose-500/10 text-rose-400 px-3 py-1.5 rounded-full border border-rose-500/20 text-sm">
                <Users size={16} className="animate-pulse" />
                <span className="font-semibold mr-2">{partyId}</span>
                {isHost && (
                  <button onClick={() => { navigator.clipboard.writeText(partyId); push("Code copied!", { type: "info" }); }} title="Copy Code" className="hover:text-white transition">
                    <Copy size={14} />
                  </button>
                )}
                <button onClick={leaveStudyTogether} title="Leave Session" className="ml-2 hover:text-white transition">
                  <DoorOpen size={16} />
                </button>
              </div>
            ) : (
              <>
                <button onClick={startStudyTogether} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-600 border border-rose-500 text-white hover:bg-rose-500 transition text-sm font-medium shadow-lg shadow-rose-500/20">
                  <Users size={16} /> Host Study Together
                </button>
                <button onClick={() => setShowJoinModal(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-700/60 border border-neutral-600 text-white hover:bg-neutral-600 transition text-sm font-medium">
                  Join Study Together
                </button>
              </>
            )}

            {user && (user._id === owner._id || user.role === "admin") && (
              <>
                <button
                  onClick={handleRetranscode}
                  disabled={retranscoding || isProcessing}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-rose-600/20 border border-rose-500/50 text-rose-400 hover:bg-rose-600/30 transition text-sm font-medium disabled:opacity-50"
                >
                  <RefreshCw size={16} className={retranscoding || isProcessing ? "animate-spin" : ""} />
                  {retranscoding ? "Enqueuing..." : isProcessing ? `Processing… ${Math.round(processingProgress)}%` : "Retranscode"}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-600/20 border border-red-500/50 text-red-400 hover:bg-red-600/30 transition text-sm font-medium disabled:opacity-50"
                >
                  <Trash2 size={16} className={deleting ? "opacity-50" : ""} />
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </>
            )}
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

        {/* Join Study Together Modal */}
        {showJoinModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-neutral-900 border border-white/10 p-6 rounded-2xl w-full max-w-sm shadow-2xl">
              <h3 className="text-xl font-bold text-white mb-4">Join Study Together</h3>
              <input
                type="text"
                placeholder="Enter 7-character code"
                value={joinPartyCode}
                onChange={(e) => setJoinPartyCode(e.target.value)}
                className="w-full bg-neutral-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500/50 transition-colors mb-4"
                maxLength={7}
              />
              <div className="flex gap-3">
                <button onClick={() => setShowJoinModal(false)} className="flex-1 py-2.5 rounded-xl bg-neutral-800 text-neutral-300 hover:bg-neutral-700 transition font-medium">Cancel</button>
                <button onClick={joinStudyTogether} className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white hover:bg-rose-500 transition font-medium shadow-lg shadow-rose-500/20">Join</button>
              </div>
            </div>
          </div>
        )}

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
      <aside className="space-y-4 flex flex-col">
        <div className="h-[400px] shrink-0">
          <LiveChat videoId={video._id} partyId={partyId} isHost={isHost} chatEnabled={chatEnabled} />
        </div>
        <RecommendedVideos currentVideoId={video._id} />
      </aside>
      {/* AI Tutor */}
      <AiTutor videoId={video._id} onSeekTo={handleSeekTo} />
    </div>
  );
}
