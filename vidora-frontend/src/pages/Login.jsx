import React, { useState } from "react";
import { login } from "../api/auth";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/ToastProvider";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Mail, Lock, Play, Upload, Brain, Users,
  Sparkles, ChevronLeft, ChevronRight, BookOpen, Tv, Eye,
} from "lucide-react";

// ─── Feature Guide Data ────────────────────────────────────────────────────────
const GUIDE_STEPS = [
  {
    icon: Tv,
    title: "Discover & Stream",
    desc: "Browse a curated feed of videos. Watch in multi-quality HLS with adaptive streaming — from 360p to original quality.",
    image: "/images/guide-dashboard.png",
    color: "from-rose-500 to-red-600",
  },
  {
    icon: Upload,
    title: "Upload & Share",
    desc: "Upload your videos with a drag-and-drop interface. Videos are automatically transcoded into HLS format for smooth playback on all devices.",
    image: "/images/guide-upload.png",
    color: "from-violet-500 to-purple-600",
  },
  {
    icon: Brain,
    title: "AI-Powered Learning",
    desc: "Every video gets AI transcription, auto-generated chapters, a knowledge graph, and an interactive AI Tutor you can chat with about the content.",
    image: "/images/guide-ai-tutor.png",
    color: "from-sky-500 to-blue-600",
  },
  {
    icon: Users,
    title: "Study Together",
    desc: "Create watch parties and invite friends. Synchronized playback, real-time chat, and collaborative learning — all in one place.",
    image: null,
    color: "from-emerald-500 to-green-600",
    features: ["🎬 Synced video playback", "💬 Live chat", "👥 Room sharing via link", "🎯 AI Skill-Tree playlists"],
  },
];

function FeatureGuide() {
  const [step, setStep] = useState(0);
  const current = GUIDE_STEPS[step];
  const Icon = current.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="w-full max-w-md relative z-10 mb-8"
    >
      <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/[0.08] rounded-3xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 pt-5 pb-3 flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${current.color} flex items-center justify-center text-white shadow-lg`}>
            <Icon size={18} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <BookOpen size={14} className="text-neutral-400" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Quick Guide · {step + 1}/{GUIDE_STEPS.length}
              </span>
            </div>
            <h3 className="text-white font-bold text-lg leading-tight">{current.title}</h3>
          </div>
        </div>

        {/* Image or feature list */}
        <div className="px-5 pb-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              {current.image ? (
                <div className="rounded-2xl overflow-hidden border border-white/[0.06] shadow-lg">
                  <img
                    src={current.image}
                    alt={current.title}
                    className="w-full h-40 object-cover object-top"
                    loading="lazy"
                  />
                </div>
              ) : (
                <div className={`rounded-2xl bg-gradient-to-br ${current.color} p-[1px]`}>
                  <div className="bg-neutral-950/80 rounded-2xl p-4">
                    <div className="grid grid-cols-2 gap-2">
                      {current.features?.map((f, i) => (
                        <div key={i} className="text-sm text-neutral-300 bg-white/5 rounded-xl px-3 py-2.5 text-center">
                          {f}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Description */}
        <div className="px-6 py-3">
          <p className="text-neutral-400 text-sm leading-relaxed">{current.desc}</p>
        </div>

        {/* Navigation */}
        <div className="px-5 pb-4 flex items-center justify-between">
          {/* Step dots */}
          <div className="flex gap-1.5">
            {GUIDE_STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? "w-6 bg-rose-500" : "w-1.5 bg-white/20 hover:bg-white/40"
                }`}
              />
            ))}
          </div>

          {/* Arrows */}
          <div className="flex gap-1.5">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 transition"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setStep((s) => Math.min(GUIDE_STEPS.length - 1, s + 1))}
              disabled={step === GUIDE_STEPS.length - 1}
              className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 transition"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Login Page ────────────────────────────────────────────────────────────────
function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const response = await login({ email, password });
      // Persist the token so the user stays logged in after refresh
      if (response?.accessToken) {
        localStorage.setItem("accessToken", response.accessToken);
      }
      setUser(response?.user || response);
      toast("Logged in", { type: "success" });
      navigate("/");
    } catch (err) {
      // Show a specific inline message (the global toast handles the rest)
      toast(err.response?.data?.message || "Invalid email or password", { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row items-center justify-center min-h-screen relative overflow-hidden py-10 px-4 gap-6 lg:gap-12">
      {/* Background Image & Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src="/images/landing-bg.png" 
          alt="Background" 
          className="w-full h-full object-cover opacity-60 mix-blend-screen"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-950/60 via-neutral-950/80 to-neutral-950"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-rose-600/10 rounded-full blur-[100px] pointer-events-none"></div>
      </div>

      {/* Feature Guide (left side on desktop, top on mobile) */}
      <div className="w-full max-w-md lg:order-1 order-2">
        <FeatureGuide />
      </div>

      {/* Login Form (right side on desktop, first on mobile) */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10 lg:order-2 order-1"
      >
        <Link to="/" className="inline-flex items-center gap-2 text-neutral-400 hover:text-white mb-6 transition-colors group">
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          <span>Back to Home</span>
        </Link>
        
        <form onSubmit={handleSubmit} className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl rounded-3xl p-8 sm:p-10 w-full">
          <div className="text-center mb-8">
            <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-tr from-red-600 to-rose-500 flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-rose-500/20 mb-4">
              V
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
            <p className="text-neutral-400 text-sm">Sign in to continue to Vidora</p>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-neutral-300 text-sm font-medium mb-2">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                  <Mail size={18} />
                </div>
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e)=>setEmail(e.target.value)} 
                  required 
                  placeholder="name@example.com"
                  className="w-full rounded-xl bg-neutral-900/50 border border-neutral-700/50 pl-10 pr-4 py-3 text-white placeholder-neutral-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none transition" 
                />
              </div>
            </div>

            <div>
              <label className="block text-neutral-300 text-sm font-medium mb-2">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                  <Lock size={18} />
                </div>
                <input 
                  type="password" 
                  value={password} 
                  onChange={(e)=>setPassword(e.target.value)} 
                  required 
                  placeholder="••••••••"
                  className="w-full rounded-xl bg-neutral-900/50 border border-neutral-700/50 pl-10 pr-4 py-3 text-white placeholder-neutral-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none transition" 
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 disabled:opacity-60 text-white font-semibold py-3.5 rounded-xl transition-all shadow-[0_0_20px_-5px_rgba(225,29,72,0.4)] hover:shadow-[0_0_25px_-5px_rgba(225,29,72,0.6)] mt-8"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
          
          <p className="text-center text-sm text-neutral-400 mt-6">
            Don't have an account? <Link to="/register" className="text-rose-400 font-semibold hover:text-rose-300 transition-colors">Create one</Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
}

export default Login;
