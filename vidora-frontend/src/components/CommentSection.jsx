import React, { useState, useEffect, useRef } from "react";
import { getComments, addComment, updateComment, deleteComment } from "../api/comments";
import { useAuth } from "../context/AuthContext";
import { MessageSquare, Send, Pencil, Trash2, X, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

/**
 * CommentSection — full comment UI for a video.
 * Lists paginated comments, add new, edit/delete own.
 */
export default function CommentSection({ videoId }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const inputRef = useRef(null);

  const fetchComments = async (pageNum = 1) => {
    try {
      setLoading(true);
      const res = await getComments(videoId);
      const data = res?.data?.data ?? res?.data ?? res;
      const docs = data?.docs || data?.comments || (Array.isArray(data) ? data : []);
      setComments(pageNum === 1 ? docs : (prev) => [...prev, ...docs]);
      setHasMore(data?.hasNextPage ?? false);
      setTotalCount(data?.totalDocs ?? docs.length);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (videoId) fetchComments(1);
  }, [videoId]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await addComment(videoId, { content: newComment.trim() });
      const comment = res?.data?.data ?? res?.data ?? res;
      // Prepend new comment with current user info
      setComments((prev) => [
        {
          ...comment,
          owner: { _id: user._id, username: user.username, avatar: user.avatar },
        },
        ...prev,
      ]);
      setTotalCount((c) => c + 1);
      setNewComment("");
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (commentId) => {
    if (!editText.trim()) return;
    try {
      await updateComment(commentId, { content: editText.trim() });
      setComments((prev) =>
        prev.map((c) => (c._id === commentId ? { ...c, content: editText.trim() } : c))
      );
      setEditingId(null);
    } catch {
      // ignore
    }
  };

  const handleDelete = async (commentId) => {
    try {
      await deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c._id !== commentId));
      setTotalCount((c) => c - 1);
    } catch {
      // ignore
    }
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchComments(nextPage);
  };

  return (
    <div className="mt-8">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <MessageSquare size={20} className="text-neutral-400" />
        <h3 className="text-lg font-semibold">{totalCount} Comment{totalCount !== 1 ? "s" : ""}</h3>
      </div>

      {/* Add comment form */}
      {user && (
        <form onSubmit={handleAdd} className="flex items-start gap-3 mb-6">
          <div className="w-9 h-9 rounded-full bg-neutral-700 overflow-hidden flex-shrink-0">
            {user.avatar ? (
              <img src={user.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm font-semibold text-white">
                {user.username?.[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="w-full bg-transparent border-b border-neutral-700 focus:border-rose-500 outline-none py-2 text-sm text-white placeholder-neutral-500 transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={!newComment.trim() || submitting}
            className="p-2 rounded-full bg-rose-600 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-rose-700 transition"
          >
            <Send size={16} />
          </button>
        </form>
      )}

      {/* Comments list */}
      {loading && comments.length === 0 ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-9 h-9 rounded-full bg-neutral-800" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-neutral-800 rounded w-24" />
                <div className="h-3 bg-neutral-800 rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <AnimatePresence>
          <div className="space-y-5">
            {comments.map((c) => (
              <motion.div
                key={c._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="flex gap-3 group"
              >
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-neutral-700 overflow-hidden flex-shrink-0">
                  {c.owner?.avatar ? (
                    <img src={c.owner.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs font-semibold text-white">
                      {c.owner?.username?.[0]?.toUpperCase() || "?"}
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-neutral-200">@{c.owner?.username}</span>
                    <span className="text-xs text-neutral-500">{timeAgo(c.createdAt)}</span>
                  </div>

                  {editingId === c._id ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="flex-1 bg-neutral-800 border border-neutral-600 rounded px-2 py-1 text-sm text-white outline-none focus:border-rose-500"
                        autoFocus
                      />
                      <button onClick={() => handleUpdate(c._id)} className="p-1 text-green-400 hover:text-green-300">
                        <Check size={16} />
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-1 text-neutral-400 hover:text-white">
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-300 leading-relaxed">{c.content}</p>
                  )}
                </div>

                {/* Actions (own comments only) */}
                {user && c.owner?._id === user._id && editingId !== c._id && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setEditingId(c._id); setEditText(c.content); }}
                      className="p-1.5 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(c._id)}
                      className="p-1.5 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-rose-400 transition"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* Load more */}
      {hasMore && (
        <button
          onClick={handleLoadMore}
          className="mt-4 text-sm text-rose-400 hover:text-rose-300 transition"
        >
          Show more comments
        </button>
      )}

      {/* Empty state */}
      {!loading && comments.length === 0 && (
        <div className="text-center py-8 text-neutral-500 text-sm">
          No comments yet. Be the first to comment!
        </div>
      )}
    </div>
  );
}
