import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Send, X, MessageSquare, FileText, BookOpen,
  Loader2, Clock, ChevronRight, Bot, User, AlertCircle
} from "lucide-react";
import { askQuestion, getTranscript, getAiStatus } from "../api/ai";

/* ──────────────────────── Helpers ──────────────────────── */
const fmt = (s) => {
  if (!s && s !== 0) return "0:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};

/* Render markdown-like text with clickable [MM:SS] timestamps */
function renderAnswer(text, onTimestamp) {
  if (!text) return null;

  // Split on timestamp patterns like [0:00], [1:23], [01:23:45]
  const parts = text.split(/(\[\d{1,2}:\d{2}(?::\d{2})?\])/g);

  return parts.map((part, i) => {
    const tsMatch = part.match(/^\[(\d{1,2}:\d{2}(?::\d{2})?)\]$/);
    if (tsMatch) {
      const timeStr = tsMatch[1];
      const segments = timeStr.split(":").map(Number);
      let seconds = 0;
      if (segments.length === 3) seconds = segments[0] * 3600 + segments[1] * 60 + segments[2];
      else seconds = segments[0] * 60 + segments[1];

      return (
        <button
          key={i}
          onClick={() => onTimestamp(seconds)}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5 rounded-md bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 hover:text-rose-300 transition text-xs font-mono font-semibold cursor-pointer"
        >
          <Clock size={10} />
          {timeStr}
        </button>
      );
    }

    // Basic markdown: **bold**
    const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
    return (
      <span key={i}>
        {boldParts.map((bp, j) => {
          const boldMatch = bp.match(/^\*\*(.+)\*\*$/);
          if (boldMatch) return <strong key={j} className="text-white font-semibold">{boldMatch[1]}</strong>;
          return <span key={j}>{bp}</span>;
        })}
      </span>
    );
  });
}

/* ──────────────────────── Component ──────────────────────── */
export default function AiTutor({ videoId, onSeekTo }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("chat"); // chat | transcript | chapters
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState(null);
  const [aiStatus, setAiStatus] = useState("pending");
  const [statusLoading, setStatusLoading] = useState(true);

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  // Poll AI status
  useEffect(() => {
    if (!videoId) return;
    let cancelled = false;

    const check = async () => {
      try {
        const data = await getAiStatus(videoId);
        if (!cancelled) {
          setAiStatus(data.aiStatus || "pending");
          setStatusLoading(false);
        }
      } catch {
        if (!cancelled) setStatusLoading(false);
      }
    };

    check();

    // Poll every 5s if still processing
    const iv = setInterval(async () => {
      if (aiStatus === "processing" || aiStatus === "pending") {
        await check();
      }
    }, 5000);

    return () => { cancelled = true; clearInterval(iv); };
  }, [videoId, aiStatus]);

  // Load transcript when switching to transcript/chapters tab
  useEffect(() => {
    if ((tab === "transcript" || tab === "chapters") && !transcript && aiStatus === "ready") {
      getTranscript(videoId)
        .then(setTranscript)
        .catch(() => {});
    }
  }, [tab, transcript, aiStatus, videoId]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when opening
  useEffect(() => {
    if (open && tab === "chat") {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open, tab]);

  const handleSend = useCallback(async () => {
    const q = input.trim();
    if (!q || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setLoading(true);

    try {
      const data = await askQuestion(videoId, q);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.answer || "I couldn't generate a response.",
          citations: data.citations || [],
        },
      ]);
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to get a response. Please try again.";
      setMessages((prev) => [...prev, { role: "error", text: msg }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, videoId]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSeek = (seconds) => {
    onSeekTo?.(seconds);
  };

  const isReady = aiStatus === "ready";
  const isProcessing = aiStatus === "processing" || aiStatus === "pending";

  return (
    <>
      {/* Floating trigger button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-rose-600 to-pink-600 text-white font-semibold text-sm shadow-[0_0_30px_rgba(225,29,72,0.4)] hover:shadow-[0_0_40px_rgba(225,29,72,0.6)] hover:scale-105 active:scale-95 transition-all duration-200"
            title="Ask AI about this video"
          >
            <Sparkles size={18} />
            Ask AI
          </motion.button>
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[420px] flex flex-col bg-neutral-950/95 backdrop-blur-2xl border-l border-white/10 shadow-[-20px_0_60px_rgba(0,0,0,0.5)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-lg">
                  <Sparkles size={16} className="text-white" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">AI Tutor</div>
                  <div className="text-[10px] text-neutral-500 uppercase tracking-wider font-medium">
                    {isReady ? "Ready" : isProcessing ? "Processing…" : aiStatus}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/5">
              {[
                { id: "chat", icon: MessageSquare, label: "Chat" },
                { id: "transcript", icon: FileText, label: "Transcript" },
                { id: "chapters", icon: BookOpen, label: "Chapters" },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold uppercase tracking-wider transition ${
                    tab === t.id
                      ? "text-rose-400 border-b-2 border-rose-500 bg-rose-500/5"
                      : "text-neutral-500 hover:text-neutral-300 hover:bg-white/5"
                  }`}
                >
                  <t.icon size={14} />
                  {t.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* ── Processing state ── */}
              {isProcessing && (
                <div className="flex-1 flex items-center justify-center p-6">
                  <div className="text-center space-y-4">
                    <div className="relative mx-auto w-14 h-14">
                      <div className="absolute inset-0 rounded-full bg-rose-500/20 animate-ping" />
                      <div className="relative w-14 h-14 rounded-full bg-neutral-900 border border-white/10 flex items-center justify-center">
                        <Loader2 size={24} className="animate-spin text-rose-500" />
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-white">Analyzing video content…</div>
                    <div className="text-xs text-neutral-500 max-w-[240px] mx-auto leading-relaxed">
                      Transcribing audio, generating embeddings, and building the knowledge graph. This may take a few minutes.
                    </div>
                    <div className="flex items-center justify-center gap-2 text-[10px] text-neutral-600 bg-white/5 px-3 py-1.5 rounded-full border border-white/5 mx-auto w-fit">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      AI pipeline in progress
                    </div>
                  </div>
                </div>
              )}

              {/* ── Failed / Skipped ── */}
              {(aiStatus === "failed" || aiStatus === "skipped") && (
                <div className="flex-1 flex items-center justify-center p-6">
                  <div className="text-center space-y-3">
                    <AlertCircle size={32} className="mx-auto text-neutral-600" />
                    <div className="text-sm text-neutral-400">
                      {aiStatus === "failed"
                        ? "AI processing failed for this video. Try re-uploading."
                        : "This video is too short for AI analysis."}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Chat tab ── */}
              {isReady && tab === "chat" && (
                <>
                  <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                    {messages.length === 0 && (
                      <div className="text-center py-10 space-y-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500/20 to-pink-500/10 border border-rose-500/20 mx-auto flex items-center justify-center">
                          <Sparkles size={20} className="text-rose-400" />
                        </div>
                        <div className="text-sm font-semibold text-white">Ask me anything about this video</div>
                        <div className="text-xs text-neutral-500 max-w-[260px] mx-auto leading-relaxed">
                          I've analyzed the full transcript and can answer questions with exact timestamp references.
                        </div>
                        <div className="flex flex-wrap gap-2 justify-center pt-2">
                          {["What are the main topics?", "Summarize the key points", "What was discussed at the beginning?"].map((q) => (
                            <button
                              key={q}
                              onClick={() => { setInput(q); inputRef.current?.focus(); }}
                              className="text-[11px] px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-neutral-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition"
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {messages.map((msg, i) => (
                      <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                        {msg.role !== "user" && (
                          <div className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center ${
                            msg.role === "error" ? "bg-red-500/20" : "bg-gradient-to-br from-rose-500 to-pink-600"
                          }`}>
                            {msg.role === "error" ? <AlertCircle size={14} className="text-red-400" /> : <Bot size={14} className="text-white" />}
                          </div>
                        )}
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                            msg.role === "user"
                              ? "bg-rose-500/20 text-white border border-rose-500/30"
                              : msg.role === "error"
                                ? "bg-red-500/10 text-red-300 border border-red-500/20"
                                : "bg-white/5 text-neutral-300 border border-white/5"
                          }`}
                        >
                          <div className="whitespace-pre-wrap">
                            {msg.role === "user" ? msg.text : renderAnswer(msg.text, handleSeek)}
                          </div>
                          {msg.citations?.length > 0 && (
                            <div className="mt-3 pt-2.5 border-t border-white/5 space-y-1.5">
                              <div className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">Sources</div>
                              {msg.citations.map((c, j) => (
                                <button
                                  key={j}
                                  onClick={() => handleSeek(c.startTime)}
                                  className="w-full flex items-start gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition text-left group"
                                >
                                  <Clock size={12} className="mt-0.5 text-rose-400 flex-shrink-0" />
                                  <div>
                                    <div className="text-[10px] text-rose-400 font-mono font-bold">
                                      {fmt(c.startTime)} – {fmt(c.endTime)}
                                    </div>
                                    <div className="text-[11px] text-neutral-500 group-hover:text-neutral-400 transition line-clamp-2">
                                      {c.text}
                                    </div>
                                  </div>
                                  <ChevronRight size={12} className="mt-0.5 text-neutral-600 group-hover:text-neutral-400 flex-shrink-0 ml-auto" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {msg.role === "user" && (
                          <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center bg-neutral-800">
                            <User size={14} className="text-neutral-400" />
                          </div>
                        )}
                      </div>
                    ))}

                    {loading && (
                      <div className="flex gap-3">
                        <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-rose-500 to-pink-600">
                          <Bot size={14} className="text-white" />
                        </div>
                        <div className="bg-white/5 border border-white/5 rounded-2xl px-4 py-3">
                          <div className="flex gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-rose-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                            <div className="w-2 h-2 rounded-full bg-rose-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                            <div className="w-2 h-2 rounded-full bg-rose-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                          </div>
                        </div>
                      </div>
                    )}

                    <div ref={chatEndRef} />
                  </div>

                  {/* Input */}
                  <div className="px-4 pb-4 pt-2 border-t border-white/5">
                    <div className="flex items-end gap-2 bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 focus-within:border-rose-500/50 transition">
                      <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask about the video…"
                        rows={1}
                        className="flex-1 bg-transparent text-sm text-white placeholder-neutral-600 resize-none outline-none max-h-24"
                        style={{ minHeight: "24px" }}
                      />
                      <button
                        onClick={handleSend}
                        disabled={!input.trim() || loading}
                        className="p-2 rounded-xl bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-30 disabled:hover:bg-rose-500 transition flex-shrink-0"
                      >
                        <Send size={14} />
                      </button>
                    </div>
                    <div className="text-[10px] text-neutral-600 text-center mt-2">
                      AI answers are grounded in the video transcript
                    </div>
                  </div>
                </>
              )}

              {/* ── Transcript tab ── */}
              {isReady && tab === "transcript" && (
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
                  {!transcript?.segments?.length ? (
                    <div className="text-center py-10 text-sm text-neutral-500">
                      <Loader2 size={20} className="animate-spin mx-auto mb-3 text-neutral-600" />
                      Loading transcript…
                    </div>
                  ) : (
                    transcript.segments.map((seg, i) => (
                      <button
                        key={i}
                        onClick={() => handleSeek(seg.start)}
                        className="w-full flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition text-left group"
                      >
                        <span className="text-[11px] font-mono text-rose-400/70 group-hover:text-rose-400 transition mt-0.5 min-w-[40px]">
                          {fmt(seg.start)}
                        </span>
                        <span className="text-sm text-neutral-400 group-hover:text-neutral-200 transition leading-relaxed">
                          {seg.text}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* ── Chapters tab ── */}
              {isReady && tab === "chapters" && (
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
                  {!transcript?.chapters?.length ? (
                    <div className="text-center py-10 text-sm text-neutral-500">
                      {transcript ? "No chapters generated for this video" : "Loading chapters…"}
                    </div>
                  ) : (
                    transcript.chapters.map((ch, i) => (
                      <button
                        key={i}
                        onClick={() => handleSeek(ch.startTime)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 transition text-left group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 text-xs font-bold flex-shrink-0">
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-neutral-200 group-hover:text-white transition truncate">
                            {ch.title}
                          </div>
                          <div className="text-[11px] text-neutral-600 font-mono">
                            {fmt(ch.startTime)}
                          </div>
                        </div>
                        <ChevronRight size={14} className="text-neutral-700 group-hover:text-neutral-400 transition flex-shrink-0" />
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
