import React, { useEffect, useState } from "react";
import { getAllVideos } from "../api/videos";
import { generateSkillTree } from "../api/ai";
import VideoCard from "../components/VideoCard";
import SkeletonGrid from "../components/SkeletonGrid";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/ToastProvider";

export default function Explore() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [topic, setTopic] = useState("");
  const [generating, setGenerating] = useState(false);
  const navigate = useNavigate();
  const push = useToast();

  useEffect(() => {
    getAllVideos()
      .then((res) => {
        const arr = res?.data?.videos || [];
        setVideos(arr);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!topic.trim()) return;
    setGenerating(true);
    try {
      const res = await generateSkillTree(topic);
      if (res && res._id) {
        push("Skill Tree Generated!", { type: "success" });
        navigate(`/skill-tree/${res._id}`);
      }
    } catch (err) {
      push(err.response?.data?.message || "Failed to generate skill tree", { type: "error" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="pb-10">
      {/* Hero Section - Clean & Professional */}
      <div className="relative border-b border-neutral-800 pb-16 pt-8 mb-12">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
            <h1 className="text-4xl md:text-5xl font-semibold mb-5 tracking-tight text-white">
              Master any topic.
            </h1>
            <p className="text-neutral-400 text-lg mb-10 max-w-xl mx-auto">
              Enter a subject you want to learn. Our engine will construct a structured, step-by-step curriculum using the best video content available.
            </p>
            
            <form onSubmit={handleGenerate} className="flex flex-col sm:flex-row items-center gap-3 max-w-2xl mx-auto">
              <div className="relative flex-1 w-full">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-neutral-500">
                  <Sparkles size={18} />
                </div>
                <input
                  type="text"
                  placeholder="e.g. System Design, Advanced React, Machine Learning..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  disabled={generating}
                  className="w-full bg-neutral-900 border border-neutral-800 text-white pl-12 pr-4 py-4 rounded-xl focus:outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500 transition-colors placeholder:text-neutral-600 text-base"
                />
              </div>
              
              <button 
                type="submit" 
                disabled={generating || !topic.trim()}
                className="w-full sm:w-auto bg-white text-black hover:bg-neutral-200 disabled:bg-neutral-800 disabled:text-neutral-500 px-8 py-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 min-w-[140px]"
              >
                {generating ? (
                  <><Loader2 size={18} className="animate-spin" /> Building...</>
                ) : (
                  <>Generate</>
                )}
              </button>
            </form>
          </motion.div>
        </div>
      </div>

      <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
        Trending Videos
      </h2>
      
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
