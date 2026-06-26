/**
 * Video Processing Worker — Phase 3
 *
 * A separate Node.js process that consumes jobs from the "video-processing" BullMQ queue.
 * Each job:
 *   1. Downloads the raw MP4 from Cloudinary
 *   2. Transcodes it into multi-bitrate HLS using FFmpeg (360p, 480p, 720p)
 *   3. Uploads all .ts segments and .m3u8 playlists back to Cloudinary
 *   4. Updates the Video document in MongoDB (status → "ready", sets hlsUrl)
 *
 * Run: `node src/worker.js`
 * Requires: FFmpeg installed on the system/container, Redis running
 */

import "dotenv/config";
import { Worker } from "bullmq";
import { redisConfig } from "./config/redis.js";
import { logger } from "./utils/logger.js";
import mongoose from "mongoose";
import { Video } from "./models/video.model.js";
import { uploadOnCloudinary } from "./utils/cloudinary.js";
import { getAiQueue } from "./queues/aiQueue.js";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import { createWriteStream } from "fs";
import path from "path";
import https from "https";
import http from "http";
import ffmpeg from "ffmpeg-static";

const execAsync = promisify(exec);

// ─── Constants ────────────────────────────────────────────────────────────────
const TEMP_DIR = path.resolve("tmp_video_processing");

// HLS transcoding profiles
const PROFILES = [
  { name: "360p", width: 640, height: 360, bitrate: "800k", maxrate: "856k", bufsize: "1200k" },
  { name: "480p", width: 854, height: 480, bitrate: "1400k", maxrate: "1498k", bufsize: "2100k" },
  { name: "720p", width: 1280, height: 720, bitrate: "2800k", maxrate: "2996k", bufsize: "4200k" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Download a file from a URL to a local path.
 */
async function downloadFile(url, destPath) {
  const proto = url.startsWith("https") ? https : http;
  return new Promise((resolve, reject) => {
    const file = createWriteStream(destPath);
    proto.get(url, (response) => {
      // Follow redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        return downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        file.close();
        return reject(new Error(`Download failed: HTTP ${response.statusCode}`));
      }
      response.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
      file.on("error", reject);
    }).on("error", reject);
  });
}

/**
 * Run FFmpeg sequentially to transcode the video into multi-bitrate HLS.
 * This prevents high memory spikes (OOM crashes) on constrained environments like Render Free Tier.
 * Produces one .m3u8 variant per profile + a master.m3u8 playlist.
 */
async function runSequentialTranscoding(inputPath, outputDir, videoId) {
  for (let i = 0; i < PROFILES.length; i++) {
    const p = PROFILES[i];
    logger.info({ videoId, profile: p.name }, `Transcoding profile ${p.name}...`);
    
    const cmd = [
      `"${ffmpeg}" -i "${inputPath}" -y`,
      `-threads 1`,
      `-max_muxing_queue_size 1024`,
      `-c:v libx264 -preset fast -g 48 -sc_threshold 0`,
      `-b:v ${p.bitrate} -maxrate:v ${p.maxrate} -bufsize:v ${p.bufsize}`,
      `-vf "scale=w=${p.width}:h=${p.height}:force_original_aspect_ratio=decrease,pad=${p.width}:${p.height}:(ow-iw)/2:(oh-ih)/2"`,
      `-c:a aac -b:a 128k -ac 2`,
      `-f hls`,
      `-hls_time 10`,
      `-hls_playlist_type vod`,
      `-hls_flags independent_segments`,
      `-hls_segment_filename "${path.join(outputDir, `stream_${i}_%03d.ts`)}"`,
      `"${path.join(outputDir, `stream_${i}.m3u8`)}"`,
    ].join(" ");

    await execAsync(cmd, { maxBuffer: 50 * 1024 * 1024 }); // 50MB stdout buffer
  }

  // Write master playlist manually after all sequential FFmpeg runs complete
  const masterContent = [
    "#EXTM3U",
    "#EXT-X-VERSION:3",
    ...PROFILES.map((p, i) => `#EXT-X-STREAM-INF:BANDWIDTH=${parseInt(p.bitrate) * 1000},RESOLUTION=${p.width}x${p.height}\nstream_${i}.m3u8`)
  ].join("\n");
  
  await fs.writeFile(path.join(outputDir, "master.m3u8"), masterContent);
}

// ─── Job Processor ────────────────────────────────────────────────────────────

async function processVideoJob(job) {
  const { videoId, rawUrl, title } = job.data;
  const jobDir = path.join(TEMP_DIR, videoId);

  logger.info({ videoId, title }, "Starting video transcoding");

  try {
    // 1. Create temp directory
    await fs.mkdir(jobDir, { recursive: true });

    // 2. Download raw video from Cloudinary
    const inputPath = path.join(jobDir, "raw_input.mp4");
    job.updateProgress(5);
    logger.info({ videoId }, "Downloading raw video...");
    await downloadFile(rawUrl, inputPath);
    job.updateProgress(15);

    // 3. Create output directory
    const hlsDir = path.join(jobDir, "hls");
    await fs.mkdir(hlsDir, { recursive: true });

    // 4. Run FFmpeg (Sequentially to save memory)
    logger.info({ videoId }, "Running sequential FFmpeg transcoding...");
    await runSequentialTranscoding(inputPath, hlsDir, videoId);
    job.updateProgress(60);

    // 4.5 Generate Spritesheet for hover thumbnails
    logger.info({ videoId }, "Generating spritesheet...");
    const spritePath = path.join(jobDir, "sprite.jpg");
    // Extract 1 frame every 10s, scale width to 160px, tile up to 10x10 (max 100 frames = 1000s)
    const spriteCmd = `"${ffmpeg}" -i "${inputPath}" -vf "fps=1/10,scale=160:-1,tile=10x10" -frames:v 1 -y "${spritePath}"`;
    await execAsync(spriteCmd).catch(e => logger.warn("Spritesheet generation failed: " + e.message));

    let spritesheetUrl = "";
    try {
      const stat = await fs.stat(spritePath);
      if (stat.isFile()) {
        const uploadedSprite = await uploadOnCloudinary(spritePath, `sprites/${videoId}`);
        if (uploadedSprite?.url) spritesheetUrl = uploadedSprite.url;
      }
    } catch {
      // ignore if sprite wasn't created
    }
    job.updateProgress(70);

    // 5. Upload all HLS files to Cloudinary
    logger.info({ videoId }, "Uploading HLS segments to Cloudinary...");
    const hlsFiles = await fs.readdir(hlsDir);
    const uploadedFiles = {};

    for (const file of hlsFiles) {
      const filePath = path.join(hlsDir, file);
      // HLS segments (.ts) and playlists (.m3u8) should be uploaded as 'raw' 
      // so Cloudinary doesn't try to process them as individual videos and fail.
      const uploaded = await uploadOnCloudinary(filePath, `hls/${videoId}`, "raw");
      if (uploaded?.url) {
        uploadedFiles[file] = uploaded.url;
      }
    }
    job.updateProgress(90);

    // 6. Get the master playlist URL
    let masterUrl = uploadedFiles["master.m3u8"];
    if (!masterUrl) {
      throw new Error("Master playlist upload failed — master.m3u8 not found in uploads");
    }

    // Strip version tag from URL (e.g., /v1234567/) so relative paths don't break
    masterUrl = masterUrl.replace(/\/v\d+\//, '/');

    // 7. Update MongoDB — video is now ready
    await Video.findByIdAndUpdate(videoId, {
      status: "ready",
      hlsUrl: masterUrl,
      spritesheetUrl: spritesheetUrl,
    });
    job.updateProgress(100);

    logger.info({ videoId, hlsUrl: masterUrl }, "Video transcoding completed successfully");

    // Phase 5: Chain AI processing job after successful transcoding
    try {
      await getAiQueue().add(
        "ai-process",
        {
          videoId,
          rawUrl,
          title,
          duration: job.data.duration || 0,
        },
        { jobId: `ai-${videoId}` }
      );
      logger.info({ videoId }, "AI processing job enqueued");
    } catch (aiErr) {
      // AI queue failure should not affect video transcoding success
      logger.warn({ err: aiErr.message, videoId }, "Failed to enqueue AI job — AI features skipped");
      await Video.findByIdAndUpdate(videoId, { aiStatus: "skipped" });
    }

    return { videoId, hlsUrl: masterUrl };
  } catch (error) {
    // Mark video as failed
    await Video.findByIdAndUpdate(videoId, { status: "failed" }).catch(() => {});
    logger.error({ err: error, videoId }, "Video transcoding failed");
    throw error; // BullMQ will retry based on backoff config
  } finally {
    // 8. Cleanup temp files
    try {
      await fs.rm(jobDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

// ─── Connect to MongoDB & Start Worker ────────────────────────────────────────

async function start() {
  // Ensure temp directory exists
  await fs.mkdir(TEMP_DIR, { recursive: true });

  // Connect to MongoDB — explicitly target 'videotube' database
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    logger.error("MONGODB_URI is not set — worker cannot start");
    process.exit(1);
  }
  await mongoose.connect(`${mongoUri}/videotube`);
  logger.info("Worker connected to MongoDB (videotube)");

  // Render Free Tier Hack: Bind to a port so Render thinks this is a valid Web Service
  const port = process.env.VIDEO_WORKER_PORT || 8081; // separate from main API's PORT
  http.createServer((req, res) => {
    res.writeHead(200);
    res.end("Video Worker is running");
  }).listen(port, () => {
    logger.info(`Dummy HTTP server listening on port ${port} (Render Free Tier bypass)`);
  });

  // Create BullMQ worker
  const worker = new Worker("video-processing", processVideoJob, {
    connection: redisConfig,
    concurrency: 1, // Process one video at a time (FFmpeg is CPU-heavy)
  });

  worker.on("completed", (job, result) => {
    logger.info({ jobId: job.id, videoId: result.videoId }, "Job completed");
  });

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, "Job failed");
  });

  worker.on("error", (err) => {
    logger.error({ err }, "Worker error");
  });

  logger.info("Video processing worker started — waiting for jobs...");

  // Graceful shutdown
  const shutdown = async (signal) => {
    logger.info(`${signal} received — closing worker gracefully`);
    await worker.close();
    await mongoose.disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((err) => {
  logger.error({ err }, "Worker failed to start");
  process.exit(1);
});
