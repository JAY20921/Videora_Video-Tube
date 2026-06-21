import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Clock, Zap } from "lucide-react";
import { instantSearch } from "../api/search";

function formatDuration(s) {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [searchTime, setSearchTime] = useState(0);
  const [totalHits, setTotalHits] = useState(0);

  const navigate = useNavigate();
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const debounceRef = useRef(null);

  // ─── Debounced search ─────────────────────────────────────────────────────
  const doSearch = useCallback(async (q) => {
    if (!q.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    try {
      const data = await instantSearch(q, 8);
      setResults(data.hits || []);
      setSearchTime(data.processingTimeMs || 0);
      setTotalHits(data.totalHits || 0);
      setIsOpen(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      doSearch(query);
    }, 250);

    return () => clearTimeout(debounceRef.current);
  }, [query, doSearch]);

  // ─── Click outside to close ───────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ─── Navigate to result ───────────────────────────────────────────────────
  const goToVideo = (hit) => {
    setIsOpen(false);
    setQuery("");
    navigate(`/video/${hit.id}`);
  };

  const goToSearchPage = () => {
    if (!query.trim()) return;
    setIsOpen(false);
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  // ─── Keyboard navigation ─────────────────────────────────────────────────
  const onKeyDown = (e) => {
    if (!isOpen || results.length === 0) {
      if (e.key === "Enter") {
        e.preventDefault();
        goToSearchPage();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && results[activeIndex]) {
          goToVideo(results[activeIndex]);
        } else {
          goToSearchPage();
        }
        break;
      case "Escape":
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  const clearQuery = () => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-xl mx-auto">
      {/* Search input */}
      <div className="relative flex items-center">
        <Search size={16} className="absolute left-3 text-neutral-500 pointer-events-none" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(-1);
          }}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search videos, creators, topics..."
          className="w-full pl-9 pr-9 py-2.5 rounded-full bg-neutral-800/80 border border-neutral-700 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500/50 focus:bg-neutral-800 transition-all"
        />
        {query && (
          <button
            onClick={clearQuery}
            className="absolute right-3 text-neutral-500 hover:text-white transition"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Autocomplete dropdown */}
      <AnimatePresence>
        {isOpen && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-2 w-full bg-neutral-900 border border-neutral-700/70 rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-50"
          >
            {/* Results */}
            <div className="max-h-[360px] overflow-y-auto">
              {results.map((hit, i) => (
                <button
                  key={hit.id}
                  onClick={() => goToVideo(hit)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    i === activeIndex
                      ? "bg-neutral-800"
                      : "hover:bg-neutral-800/50"
                  }`}
                >
                  {/* Thumbnail */}
                  {hit.thumbnail && (
                    <div className="w-16 h-9 rounded-md overflow-hidden bg-neutral-800 flex-shrink-0">
                      <img src={hit.thumbnail} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div
                      className="text-sm text-white font-medium truncate"
                      dangerouslySetInnerHTML={{
                        __html: hit._formatted?.title || hit.title,
                      }}
                    />
                    <div className="flex items-center gap-2 text-xs text-neutral-500 mt-0.5">
                      <span>{hit.ownerName || "Unknown"}</span>
                      {hit.views > 0 && (
                        <>
                          <span>·</span>
                          <span>{hit.views.toLocaleString()} views</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Duration badge */}
                  {hit.duration > 0 && (
                    <span className="text-[10px] text-neutral-400 bg-neutral-800 rounded px-1.5 py-0.5 flex-shrink-0">
                      {formatDuration(hit.duration)}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="border-t border-neutral-800 px-4 py-2 flex items-center justify-between text-[10px] text-neutral-600">
              <div className="flex items-center gap-1">
                <Zap size={10} />
                <span>{totalHits} result{totalHits !== 1 ? "s" : ""} in {searchTime}ms</span>
              </div>
              <button
                onClick={goToSearchPage}
                className="text-rose-400 hover:text-rose-300 transition font-medium text-xs"
              >
                See all results →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading indicator */}
      {loading && query && (
        <div className="absolute top-full mt-2 w-full bg-neutral-900 border border-neutral-700/70 rounded-xl py-6 text-center z-50">
          <div className="w-5 h-5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <span className="text-xs text-neutral-500">Searching...</span>
        </div>
      )}

      {/* No results */}
      {isOpen && !loading && query && results.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute top-full mt-2 w-full bg-neutral-900 border border-neutral-700/70 rounded-xl py-6 text-center z-50"
        >
          <span className="text-sm text-neutral-500">No results for "{query}"</span>
        </motion.div>
      )}
    </div>
  );
}
