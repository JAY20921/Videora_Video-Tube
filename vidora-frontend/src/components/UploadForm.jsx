import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { uploadVideo, getVideoStatus } from "../api/videos";
import { useToast } from "./ToastProvider";
import Loading from "./Loading";
import { UploadCloud, Image as ImageIcon, Video as VideoIcon, X, CheckCircle2, Film, Loader2 } from "lucide-react";

export default function UploadForm() {
  const [videoFile, setVideoFile] = useState(null);
  const [thumbnail, setThumbnail] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState(""); // e.g., uploading, processing, done
  const [formError, setFormError] = useState(null);
  const push = useToast();
  const abortRef = useRef(null);

  const pollProcessing = async (videoId) => {
    setStatus("processing");
    const start = Date.now();
    const timeout = 1000 * 60 * 10; // 10 minutes max
    while (Date.now() - start < timeout) {
      try {
        const data = await getVideoStatus(videoId);
        const p = data?.progress || 0;
        setProgress(p);

        if (data?.status === "ready") {
          setStatus("done");
          return data;
        }
        if (data?.status === "failed") {
          setStatus("failed");
          return null;
        }
      } catch (e) {
        console.warn("Polling error", e);
      }
      // wait before next poll
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 3000));
    }
    setStatus("timeout");
    return null;
  };

  const submit = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!videoFile) return push("Please select a video file", { type: "error" });

    const fd = new FormData();
    fd.append("videoFile", videoFile);
    if (thumbnail) fd.append("thumbnail", thumbnail);
    fd.append("title", title);
    fd.append("description", description);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setUploading(true);
      setProgress(0);
      setStatus("uploading");

      const result = await uploadVideo(fd, (percent) => {
        setProgress(Math.min(Math.max(percent || 0, 0), 100));
      }, { signal: controller.signal });

      push("Upload finished! File received by server. Processing...", { type: "success" });

      // if server returned id, poll processing status
      // If server returned the created video and it already has a playable URL,
      // we can consider it ready and skip polling. Otherwise, poll for processing.
      const createdVideo = result?.video ?? result?.data ?? result?.created ?? result;
      const id = createdVideo?._id ?? result?._id ?? result?.id;
      if (createdVideo && createdVideo.videoFile) {
        setStatus('done');
        push('Video published and ready', { type: 'success' });
      } else if (id) {
        const processed = await pollProcessing(id);
        if (processed) {
          push("Video processed and ready", { type: "success" });
        } else {
          push("Video upload succeeded but processing timed out", { type: "warning" });
        }
      }

      // Reset form
      setVideoFile(null);
      setThumbnail(null);
      setTitle("");
      setDescription("");
      setProgress(0);
      setStatus("");
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') {
        push('Upload cancelled', { type: 'info' });
        setStatus('cancelled');
      } else {
        console.error(err);
        const data = err?.response?.data;
        if (data?.errors && Array.isArray(data.errors)) {
          // Validation array from Zod middleware
          setFormError({
            message: data.message || "Validation failed",
            details: data.errors.map(e => e.message || e.field)
          });
        } else {
          setFormError({
            message: data?.message || err.message || "Upload failed",
            details: []
          });
        }
        push(data?.message || "Upload failed", { type: "error" });
        setStatus('error');
      }
    } finally {
      setUploading(false);
      abortRef.current = null;
    }
  };

  const cancelUpload = () => {
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch (e) { console.warn(e); }
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8">
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-neutral-900/80 backdrop-blur-xl border border-neutral-800 rounded-3xl shadow-2xl p-8 md:p-10"
      >
        <div className="flex items-center gap-4 mb-8 border-b border-neutral-800 pb-6">
          <div className="w-12 h-12 bg-rose-500/10 text-rose-500 flex items-center justify-center rounded-2xl">
            <UploadCloud size={24} />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white">Upload Video</h3>
            <p className="text-sm text-neutral-400">Share your latest creation with the world</p>
          </div>
        </div>

        {formError && (
          <div className="mb-8 p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex flex-col gap-2 text-rose-400">
            <div className="flex items-center gap-2 font-semibold">
              <span className="w-5 h-5 flex items-center justify-center bg-rose-500 text-white rounded-full text-xs font-bold shrink-0">!</span>
              {formError.message}
            </div>
            {formError.details?.length > 0 && (
              <ul className="list-disc pl-9 text-sm space-y-1">
                {formError.details.map((detail, idx) => (
                  <li key={idx}>{detail}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="space-y-8">
          {/* Video File Input */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-3">Video File *</label>
            <div className={`relative border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center transition-all ${videoFile ? 'border-rose-500 bg-rose-500/5' : 'border-neutral-700 hover:border-neutral-500 hover:bg-neutral-800/50 bg-neutral-900/50'}`}>
              <input
                required={!videoFile}
                type="file"
                accept="video/*"
                onChange={(e) => setVideoFile(e.target.files[0])}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={uploading}
              />
              {videoFile ? (
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-rose-500/20 text-rose-400 flex items-center justify-center rounded-2xl mb-4">
                    <Film size={32} />
                  </div>
                  <p className="text-white font-medium text-lg mb-1">{videoFile.name}</p>
                  <p className="text-neutral-400 text-sm">{(videoFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-neutral-800 text-neutral-400 flex items-center justify-center rounded-2xl mb-4">
                    <VideoIcon size={32} />
                  </div>
                  <p className="text-white font-medium text-lg mb-1">Click or drag video to upload</p>
                  <p className="text-neutral-400 text-sm">MP4, WebM, or OGG (Max. 10GB)</p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Title & Description */}
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Title *</label>
                <input
                  required
                  minLength={3}
                  className="w-full bg-neutral-900/50 border border-neutral-700/50 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none transition"
                  placeholder="Enter a catchy title (min 3 chars)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={uploading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Description *</label>
                <textarea
                  required
                  minLength={10}
                  className="w-full bg-neutral-900/50 border border-neutral-700/50 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none transition min-h-[140px] resize-none"
                  placeholder="Tell viewers about your video... (min 10 chars)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={uploading}
                />
              </div>
            </div>

            {/* Thumbnail Input */}
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Thumbnail (Optional)</label>
              <div className={`relative border-2 border-dashed rounded-3xl p-6 h-[230px] flex flex-col items-center justify-center transition-all ${thumbnail ? 'border-rose-500 bg-rose-500/5' : 'border-neutral-700 hover:border-neutral-500 hover:bg-neutral-800/50 bg-neutral-900/50'}`}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setThumbnail(e.target.files[0])}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={uploading}
                />
                {thumbnail ? (
                  <div className="absolute inset-2 rounded-2xl overflow-hidden">
                    <img src={URL.createObjectURL(thumbnail)} alt="Thumbnail preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <span className="text-white font-medium bg-black/60 px-4 py-2 rounded-lg">Change Image</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-neutral-800 text-neutral-400 flex items-center justify-center rounded-xl mb-3">
                      <ImageIcon size={24} />
                    </div>
                    <p className="text-neutral-300 font-medium mb-1">Upload Thumbnail</p>
                    <p className="text-neutral-500 text-xs px-4">JPG, PNG, or WEBP. 1280x720 recommended.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Progress and Actions */}
        <div className="mt-10 pt-6 border-t border-neutral-800">
          <AnimatePresence>
            {uploading && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }} 
                animate={{ opacity: 1, height: 'auto' }} 
                exit={{ opacity: 0, height: 0 }}
                className="mb-8"
              >
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <p className="text-sm font-medium text-white">
                      {status === 'processing'
                        ? (progress <= 0 ? 'Queued for processing…'
                          : progress < 15 ? 'Downloading source…'
                          : progress < 60 ? 'Transcoding video…'
                          : progress < 70 ? 'Generating spritesheet…'
                          : progress < 90 ? 'Uploading HLS segments…'
                          : progress < 100 ? 'Finalizing…'
                          : 'Complete!')
                        : 'Uploading…'}
                    </p>
                    <p className="text-xs text-neutral-400">{videoFile?.name}</p>
                  </div>
                  <span className="text-rose-400 font-bold tabular-nums">{Math.round(progress)}%</span>
                </div>
                <div className="w-full bg-neutral-800 rounded-full h-3 overflow-hidden shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-rose-600 to-rose-400 transition-all duration-300 rounded-full relative"
                    style={{ width: `${progress}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-between">
            {!uploading && status === 'done' ? (
              <div className="flex items-center gap-2 text-emerald-400 bg-emerald-400/10 px-4 py-2 rounded-lg">
                <CheckCircle2 size={18} />
                <span className="font-medium">Upload Complete!</span>
              </div>
            ) : (
              <div className="text-sm text-neutral-500">
                {!uploading && status && status !== 'done' && <span>Status: {status}</span>}
              </div>
            )}
            
            <div className="flex items-center gap-3 ml-auto">
              {uploading && (
                <button 
                  type="button" 
                  onClick={cancelUpload} 
                  className="flex items-center gap-2 px-5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl font-medium transition"
                >
                  <X size={18} /> Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={uploading || !videoFile}
                className="flex items-center gap-2 px-8 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-semibold rounded-xl transition-all shadow-[0_0_15px_-3px_rgba(225,29,72,0.4)] disabled:opacity-50 disabled:shadow-none"
              >
                {uploading ? <Loader2 size={18} className="animate-spin text-white" /> : <UploadCloud size={20} />}
                {uploading ? 'Uploading...' : 'Publish Video'}
              </button>
            </div>
          </div>
        </div>
      </motion.form>
    </div>
  );
}
