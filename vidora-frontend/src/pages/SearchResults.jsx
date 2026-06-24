import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { instantSearch } from "../api/search";
import VideoCard from "../components/VideoCard";
import SkeletonGrid from "../components/SkeletonGrid";
import { Search, Zap } from "lucide-react";

export default function SearchResults() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState({ totalHits: 0, processingTimeMs: 0, source: "" });
  const [params] = useSearchParams();
  const q = params.get("q") || "";

  useEffect(() => {
    if (!q) return;
    setLoading(true);

    instantSearch(q, 40)
      .then((data) => {
        // Normalize hits into video-card-compatible objects
        const list = (data.hits || []).map((hit) => ({
          _id: hit.id,
          title: hit.title,
          description: hit.description,
          thumbnail: hit.thumbnail,
          duration: hit.duration,
          views: hit.views,
          createdAt: hit.createdAt ? new Date(hit.createdAt).toISOString() : undefined,
          owner: {
            _id: hit.ownerId,
            fullName: hit.ownerName,
            username: hit.ownerUsername,
            avatar: hit.ownerAvatar,
          },
        }));
        setVideos(list);
        setMeta({
          totalHits: data.totalHits || list.length,
          processingTimeMs: data.processingTimeMs || 0,
          source: data.source || "unknown",
        });
      })
      .catch(() => setVideos([]))
      .finally(() => setLoading(false));
  }, [q]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Search size={22} className="text-neutral-400" />
        <h1 className="text-2xl font-bold">
          Results for <span className="text-rose-400">"{q}"</span>
        </h1>
      </div>

      {/* Meta */}
      {!loading && videos.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-neutral-500 mb-6">
          <Zap size={12} />
          <span>
            {meta.totalHits} result{meta.totalHits !== 1 ? "s" : ""} in {meta.processingTimeMs}ms
            {meta.source === "meilisearch" && " · Powered by Meilisearch"}
            {meta.source === "mongodb" && " · MongoDB fallback"}
          </span>
        </div>
      )}

      {/* Results */}
      {loading ? (
        <SkeletonGrid />
      ) : videos.length === 0 ? (
        <div className="text-center py-16 text-neutral-500">
          <Search size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg">No videos found for "{q}"</p>
          <p className="text-sm mt-1">Try different keywords or check spelling.</p>
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
