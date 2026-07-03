import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useSocket } from "../context/SocketContext";
import { useToast } from "../components/ToastProvider";

export default function StudyTogether() {
  const [code, setCode] = useState("");
  const navigate = useNavigate();
  const socket = useSocket();
  const { push } = useToast();

  const handleJoin = (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    
    if (!socket) {
      push("Not connected to server", { type: "error" });
      return;
    }

    socket.emit("join-watchparty", { partyId: code.trim() }, (res) => {
      if (res.error) {
        push(res.error, { type: "error" });
      } else if (res.videoId) {
        // The join logic is inside VideoPage, so we leave the socket room here
        // and redirect the user to the video page where they can click "Join" again or auto-join
        socket.emit("leave-watchparty", { partyId: code.trim() });
        navigate(`/video/${res.videoId}`, { state: { autoJoinCode: code.trim() } });
      }
    });
  };

  return (
    <div className="max-w-2xl mx-auto mt-12 text-center">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 shadow-2xl">
        <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <BookOpen size={32} />
        </div>
        <h1 className="text-3xl font-bold mb-4">Study Together</h1>
        <p className="text-neutral-400 mb-8 max-w-md mx-auto">
          Sync your video playback with friends or study groups. Chat in real-time and learn collaboratively.
        </p>

        <form onSubmit={handleJoin} className="flex items-center gap-3 max-w-sm mx-auto mb-10">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter session code"
            className="flex-1 bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-rose-500"
          />
          <button type="submit" className="bg-rose-600 hover:bg-rose-500 text-white px-6 py-3 rounded-xl font-medium transition flex items-center gap-2">
            Join <ArrowRight size={18} />
          </button>
        </form>

        <div className="pt-8 border-t border-neutral-800 text-neutral-500">
          <p className="text-sm">Want to host your own session?</p>
          <p className="text-sm mt-1">Go to any video and click <strong className="text-neutral-300">"Host Study Together"</strong> below the player.</p>
        </div>
      </motion.div>
    </div>
  );
}
