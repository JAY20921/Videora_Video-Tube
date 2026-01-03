import React, { useState, useRef } from "react";
import { motion } from "framer-motion";
import { uploadVideo } from "../api/videos";
import { useToast } from "./ToastProvider";
import Loading from "./Loading";
import { getVideoById } from "../api/videos";

export default function UploadForm() {
  const [videoFile, setVideoFile] = useState(null);
  const [thumbnail, setThumbnail] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState(""); // e.g., uploading, processing, done
  const push = useToast();
  const abortRef = useRef(null);

  const pollProcessing = async (videoId) => {
    setStatus("processing");
    const start = Date.now();
    const timeout = 1000 * 60 * 5; // 5 minutes max
    while (Date.now() - start < timeout) {
      try {
        const res = await getVideoById(videoId);
        const v = res?.video ?? res?.data ?? res;
        // backend may provide status or processing flag — try common fields
        if (v?.status && v.status !== "processing") {
          setStatus(v.status);
          return v;
        }
        if (v?.processed || v?.isProcessed || v?.ready) {
          setStatus("done");
          return v;
        }
      } catch (e) {
        console.warn("Polling error", e);
      }
      // wait before next poll
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 2500));
    }
    setStatus("timeout");
    return null;
  };

  const submit = async (e) => {
    e.preventDefault();
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
        push(err?.response?.data?.message || "Upload failed", { type: "error" });
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
    <motion.form
      onSubmit={submit}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-blue rounded-lg shadow p-6 max-w-3xl mx-auto"
    >
      <h3 className="text-xl font-semibold mb-4">Upload a video</h3>

      <label className="block mb-3">
        <div className="text-sm text-gray-600">Video file</div>
        <input
          required
          type="file"
          accept="video/*"
          onChange={(e) => setVideoFile(e.target.files[0])}
          className="mt-2"
        />
      </label>

      <label className="block mb-3">
        <div className="text-sm text-gray-600">Thumbnail (optional)</div>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setThumbnail(e.target.files[0])}
          className="mt-2"
        />
      </label>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <input
          className="border rounded px-3 py-2"
          placeholder="Video title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className="border rounded px-3 py-2"
          placeholder="Short description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={uploading}
          className="px-4 py-2 bg-violet-600 text-white rounded-lg shadow hover:shadow-lg transition disabled:opacity-60"
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </button>

        {uploading && (
          <>
            <button type="button" onClick={cancelUpload} className="px-3 py-2 bg-gray-700 text-white rounded">Cancel</button>
            <div className="w-48">
              <div className="text-xs text-gray-600 mb-1">{status === 'processing' ? 'Processing...' : `${progress}%`}</div>
              <div className="w-full bg-gray-200 rounded h-2 overflow-hidden">
                <div
                  className="h-2 bg-violet-600 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </>
        )}

        {!uploading && status && (
          <div className="text-sm text-neutral-400">Status: {status}</div>
        )}
      </div>
    </motion.form>
  );
}
