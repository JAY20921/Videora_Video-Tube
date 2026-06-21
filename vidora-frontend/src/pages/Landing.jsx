import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, Sparkles, Tv, Shield, Zap } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-neutral-950 text-gray-100 flex flex-col relative overflow-hidden">
      {/* Background Image & Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src="/images/landing-bg.png" 
          alt="Background" 
          className="w-full h-full object-cover opacity-60 mix-blend-screen"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-950/40 via-neutral-950/80 to-neutral-950"></div>
        {/* Subtle radial glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-rose-600/20 rounded-full blur-[120px] pointer-events-none"></div>
      </div>

      {/* Navigation Bar */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 lg:px-12 backdrop-blur-sm border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 to-rose-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-rose-500/20">
            V
          </div>
          <span className="text-xl font-bold tracking-tight">Vidora</span>
        </div>
        <div className="flex gap-4 items-center">
          <Link to="/login" className="text-sm font-medium hover:text-white text-gray-300 transition">
            Sign In
          </Link>
          <Link to="/register" className="text-sm font-medium bg-white text-black px-5 py-2 rounded-full hover:bg-gray-200 transition">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 text-center pb-20 mt-10 lg:mt-0">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="max-w-4xl mx-auto flex flex-col items-center"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-8 text-sm text-rose-200">
            <Sparkles size={16} />
            <span>The Next Generation of Streaming</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-tight">
            Discover, stream, and <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-red-600">
              share the extraordinary
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-neutral-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Experience video streaming like never before. High-quality content, seamless playback, and a community of creators waiting for you.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              to="/register"
              className="group flex items-center gap-2 bg-gradient-to-r from-rose-600 to-red-600 px-8 py-4 rounded-full text-white font-semibold hover:scale-105 transition-all shadow-[0_0_30px_-5px_rgba(225,29,72,0.4)]"
            >
              Start Watching Now
              <Play className="w-5 h-5 fill-white group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/login"
              className="px-8 py-4 rounded-full text-white font-semibold border border-white/10 bg-white/5 backdrop-blur-md hover:bg-white/10 transition-all"
            >
              Sign In to Account
            </Link>
          </div>
        </motion.div>

        {/* Feature Highlights */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl mt-20 md:mt-32 px-4"
        >
          {[
            { icon: Tv, title: "4K Streaming", desc: "Crystal clear playback on all your devices" },
            { icon: Zap, title: "Ultra Fast", desc: "Optimized delivery network with zero buffering" },
            { icon: Shield, title: "Ad-Free Premium", desc: "Enjoy uninterrupted viewing experiences" }
          ].map((feature, i) => (
            <div key={i} className="flex flex-col items-center text-center p-6 rounded-3xl bg-white/5 border border-white/5 backdrop-blur-sm hover:bg-white/10 transition-colors">
              <div className="w-12 h-12 bg-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-sm text-neutral-400">{feature.desc}</p>
            </div>
          ))}
        </motion.div>
      </main>
    </div>
  );
}
