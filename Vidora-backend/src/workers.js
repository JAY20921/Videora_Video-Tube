/**
 * Unified In-Process Workers
 *
 * Embeds all BullMQ workers (video-processing, ai-processing, analytics)
 * directly inside the main server process. This eliminates the need to
 * deploy (and pay for) separate worker services.
 *
 * BullMQ Workers are just Redis event listeners — they work perfectly
 * fine sharing a Node.js process with Express. Jobs still run with
 * concurrency: 1 so heavy FFmpeg work won't overlap.
 *
 * Usage:  import { startWorkers, stopWorkers } from "./workers.js";
 *         await startWorkers();   // call after DB is connected
 */

import { Worker } from "bullmq";
import { config } from "./config/index.js";
import { redisConfig } from "./config/redis.js";
import { logger } from "./utils/logger.js";
import { Video } from "./models/video.model.js";
import { Transcript } from "./models/transcript.model.js";
import { uploadOnCloudinary } from "./utils/cloudinary.js";
import { getAiQueue } from "./queues/aiQueue.js";
import { transcribeVideo } from "./services/transcription.service.js";
import { chunkTranscript } from "./services/chunking.service.js";
import { embedTexts } from "./services/embedding.service.js";
import { storeChunks } from "./services/vectorStore.service.js";
import { extractConcepts, generateChapters } from "./services/knowledgeGraph.service.js";
import { ensureCollection } from "./config/qdrant.js";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import { createWriteStream } from "fs";
import path from "path";
import https from "https";
import http from "http";
import ffmpeg from "ffmpeg-static";

const execAsync = promisify(exec);

// Keep references so we can shut them down gracefully
const _workers = [];

// ═══════════════════════════════════════════════════════════════════════════════
// Shared helpers
// ═══════════════════════════════════════════════════════════════════════════════

async function downloadFile(url, destPath) {
  const proto = url.startsWith("https") ? https : http;
  return new Promise((resolve, reject) => {
    const file = createWriteStream(destPath);
    proto.get(url, (response) => {
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

// ═══════════════════════════════════════════════════════════════════════════════
// 1. VIDEO TRANSCODING WORKER
// ═══════════════════════════════════════════════════════════════════════════════

const VIDEO_TEMP_DIR = path.resolve("tmp_video_processing");

const PROFILES = [
  { name: "original", bitrate: "5000k", maxrate: "5350k", bufsize: "7500k" },
  { name: "720p", width: 1280, height: 720, bitrate: "2800k", maxrate: "2996k", bufsize: "4200k" },
];

async function runSequentialTranscoding(inputPath, outputDir, videoId) {
  for (let i = 0; i < PROFILES.length; i++) {
    const p = PROFILES[i];
    logger.info({ videoId, profile: p.name }, `Transcoding profile ${p.name}...`);

    const cmdArgs = [
      `"${ffmpeg}" -i "${inputPath}" -y`,
      `-threads 1`, // Locked to 1 thread to prevent OOM in production
      `-max_muxing_queue_size 1024`,
      `-c:v libx264 -preset ultrafast -g 48 -sc_threshold 0`,
      `-b:v ${p.bitrate} -maxrate:v ${p.maxrate} -bufsize:v ${p.bufsize}`,
    ];

    if (p.width && p.height) {
      cmdArgs.push(`-vf "scale=w=${p.width}:h=${p.height}:force_original_aspect_ratio=decrease,pad=${p.width}:${p.height}:(ow-iw)/2:(oh-ih)/2"`);
    }

    cmdArgs.push(
      `-c:a aac -b:a 128k -ac 2`,
      `-f hls`,
      `-hls_time 10`,
      `-hls_playlist_type vod`,
      `-hls_flags independent_segments`,
      `-hls_segment_filename "${path.join(outputDir, `stream_${i}_%03d.ts`)}"`,
      `"${path.join(outputDir, `stream_${i}.m3u8`)}"`
    );

    const cmd = cmdArgs.join(" ");

    await execAsync(cmd, { maxBuffer: 50 * 1024 * 1024 });
  }

  const masterContent = [
    "#EXTM3U",
    "#EXT-X-VERSION:3",
    ...PROFILES.map((p, i) => {
      const resString = p.width ? `,RESOLUTION=${p.width}x${p.height}` : "";
      return `#EXT-X-STREAM-INF:BANDWIDTH=${parseInt(p.bitrate) * 1000}${resString}\nstream_${i}.m3u8`;
    })
  ].join("\n");

  await fs.writeFile(path.join(outputDir, "master.m3u8"), masterContent);
}

async function processVideoJob(job) {
  const { videoId, rawUrl, title } = job.data;
  const jobDir = path.join(VIDEO_TEMP_DIR, videoId);

  logger.info({ videoId, title }, "[In-Process] Starting video transcoding");

  try {
    await fs.mkdir(jobDir, { recursive: true });

    const inputPath = path.join(jobDir, "raw_input.mp4");
    job.updateProgress(5);
    await Video.findByIdAndUpdate(videoId, { progress: 5 });
    logger.info({ videoId }, "Downloading raw video...");
    await downloadFile(rawUrl, inputPath);
    job.updateProgress(15);
    await Video.findByIdAndUpdate(videoId, { progress: 15 });

    const hlsDir = path.join(jobDir, "hls");
    await fs.mkdir(hlsDir, { recursive: true });

    logger.info({ videoId }, "Running sequential FFmpeg transcoding...");
    await runSequentialTranscoding(inputPath, hlsDir, videoId);
    job.updateProgress(60);
    await Video.findByIdAndUpdate(videoId, { progress: 60 });

    // Generate Spritesheet
    logger.info({ videoId }, "Generating spritesheet...");
    const spritePath = path.join(jobDir, "sprite.jpg");
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
    await Video.findByIdAndUpdate(videoId, { progress: 70 });

    // Upload HLS
    // Upload HLS in parallel batches to speed things up
    logger.info({ videoId, totalFiles: hlsFiles.length }, "Uploading HLS segments to Cloudinary...");
    const uploadedFiles = {};
    const BATCH_SIZE = 5; // Upload 5 segments concurrently

    for (let i = 0; i < hlsFiles.length; i += BATCH_SIZE) {
      const batch = hlsFiles.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (file) => {
        const filePath = path.join(hlsDir, file);
        const uploaded = await uploadOnCloudinary(filePath, `hls/${videoId}`, "raw");
        return { file, url: uploaded?.url };
      });
      
      const results = await Promise.all(batchPromises);
      for (const res of results) {
        if (res.url) uploadedFiles[res.file] = res.url;
      }
    }
    job.updateProgress(90);
    await Video.findByIdAndUpdate(videoId, { progress: 90 });

    let masterUrl = uploadedFiles["master.m3u8"];
    if (!masterUrl) {
      throw new Error("Master playlist upload failed — master.m3u8 not found in uploads");
    }

    masterUrl = masterUrl.replace(/\/v\d+\//, '/');

    await Video.findByIdAndUpdate(videoId, {
      status: "ready",
      hlsUrl: masterUrl,
      spritesheetUrl: spritesheetUrl,
      progress: 100,
    });
    job.updateProgress(100);

    logger.info({ videoId, hlsUrl: masterUrl }, "Video transcoding completed successfully");

    // Chain AI processing job
    try {
      await getAiQueue().add(
        "ai-process",
        { videoId, rawUrl, title, duration: job.data.duration || 0 },
        { jobId: `ai-${videoId}` }
      );
      logger.info({ videoId }, "AI processing job enqueued");
    } catch (aiErr) {
      logger.warn({ err: aiErr.message, videoId }, "Failed to enqueue AI job — AI features skipped");
      await Video.findByIdAndUpdate(videoId, { aiStatus: "skipped" });
    }

    return { videoId, hlsUrl: masterUrl };
  } catch (error) {
    await Video.findByIdAndUpdate(videoId, { status: "failed" }).catch(() => {});
    logger.error({ err: error, videoId }, "Video transcoding failed");
    throw error;
  } finally {
    try {
      await fs.rm(jobDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. AI PROCESSING WORKER
// ═══════════════════════════════════════════════════════════════════════════════

const AI_TEMP_DIR = path.resolve("tmp_ai_processing");

async function processAiJob(job) {
  const { videoId, rawUrl, title, duration } = job.data;
  const jobDir = path.join(AI_TEMP_DIR, videoId);

  logger.info({ videoId, title }, "[In-Process] Starting AI processing");

  if (duration && duration < 10) {
    logger.info({ videoId }, "Video too short for AI processing — skipping");
    await Video.findByIdAndUpdate(videoId, { aiStatus: "skipped" });
    return { videoId, status: "skipped" };
  }

  let transcript = await Transcript.findOne({ video: videoId });
  if (!transcript) {
    transcript = await Transcript.create({ video: videoId, status: "pending" });
  }

  try {
    await Video.findByIdAndUpdate(videoId, { aiStatus: "processing" });
    transcript.status = "transcribing";
    await transcript.save();

    await fs.mkdir(jobDir, { recursive: true });
    job.updateProgress(5);

    const inputPath = path.join(jobDir, "raw_input.mp4");
    logger.info({ videoId }, "Downloading raw video for AI...");
    await downloadFile(rawUrl, inputPath);
    job.updateProgress(10);

    logger.info({ videoId }, "Transcribing with Whisper...");
    let { segments, fullText, language } = await transcribeVideo(inputPath, jobDir);

    const cleanText = fullText
      .replace(/(thank you|thanks for watching|subscribe|thanks|you|bye)/gi, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .trim();

    if (cleanText.length < 50) {
      logger.info({ videoId, cleanTextLength: cleanText.length }, "Transcript empty or hallucinated. Using title and description as fallback.");
      const video = await Video.findById(videoId);
      const fallbackText = `${title}. ${video?.description || ""}`.trim();

      fullText = fallbackText;
      segments = [{ start: 0, end: duration || 10, text: fallbackText }];
      language = "en";
    }

    transcript.segments = segments;
    transcript.fullText = fullText;
    transcript.language = language;
    transcript.status = "chunking";
    await transcript.save();
    job.updateProgress(30);

    logger.info({ videoId }, "Chunking transcript...");
    const chunks = chunkTranscript(segments);
    transcript.status = "embedding";
    await transcript.save();
    job.updateProgress(40);

    logger.info({ videoId, chunkCount: chunks.length }, "Generating embeddings...");
    const chunkTexts = chunks.map((c) => c.text);
    const embeddings = await embedTexts(chunkTexts);
    job.updateProgress(60);

    logger.info({ videoId }, "Storing vectors in Qdrant...");
    const pointIds = await storeChunks(videoId, chunks, embeddings);

    transcript.chunks = chunks.map((chunk, i) => ({
      ...chunk,
      qdrantPointId: pointIds[i] || "",
    }));
    transcript.status = "extracting";
    await transcript.save();
    job.updateProgress(70);

    logger.info({ videoId }, "Extracting knowledge graph...");
    const concepts = await extractConcepts(fullText);
    transcript.concepts = concepts;
    job.updateProgress(85);

    logger.info({ videoId }, "Generating chapters...");
    const chapters = await generateChapters(segments);
    transcript.chapters = chapters;
    job.updateProgress(95);

    transcript.status = "ready";
    await transcript.save();

    await Video.findByIdAndUpdate(videoId, {
      aiStatus: "ready",
      transcript: transcript._id,
    });
    job.updateProgress(100);

    logger.info(
      { videoId, chunks: chunks.length, concepts: concepts.length, chapters: chapters.length },
      "AI processing completed successfully"
    );

    return { videoId, transcriptId: String(transcript._id) };
  } catch (error) {
    transcript.status = "failed";
    await transcript.save().catch(() => {});
    await Video.findByIdAndUpdate(videoId, { aiStatus: "failed" }).catch(() => {});

    logger.error({ err: error, videoId }, "AI processing failed");
    throw error;
  } finally {
    try {
      await fs.rm(jobDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. ANALYTICS WORKER
// ═══════════════════════════════════════════════════════════════════════════════

let eventBuffer = [];
let flushTimeout = null;

async function flushBuffer() {
  if (eventBuffer.length === 0) return;
  const eventsToInsert = [...eventBuffer];
  eventBuffer = [];

  try {
    // Dynamic import to avoid circular dependency issues at module load time
    const { ViewEvent } = await import("./models/viewEvent.model.js");
    await ViewEvent.insertMany(eventsToInsert, { ordered: false });
    logger.info(`Inserted ${eventsToInsert.length} analytics events`);
  } catch (error) {
    logger.error({ err: error.message }, "Failed to bulk insert analytics events");
  }
}

async function processAnalyticsJob(job) {
  const data = job.data;
  eventBuffer.push(data);

  if (eventBuffer.length >= 100) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
    await flushBuffer();
  } else if (!flushTimeout) {
    flushTimeout = setTimeout(async () => {
      flushTimeout = null;
      await flushBuffer();
    }, 5000);
  }

  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Lifecycle: start / stop
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Start all BullMQ workers in-process.
 * Call this AFTER mongoose.connect() has succeeded.
 */
export async function startWorkers() {
  // Ensure temp directories
  await fs.mkdir(VIDEO_TEMP_DIR, { recursive: true });
  await fs.mkdir(AI_TEMP_DIR, { recursive: true });

  // Ensure Qdrant collection exists (non-blocking — logs warning if unavailable)
  await ensureCollection().catch((err) =>
    logger.warn({ err: err.message }, "Qdrant collection setup failed — AI vector search may not work")
  );

  // ── Video Transcoding Worker ──────────────────────────────────────────────
  const videoWorker = new Worker("video-processing", processVideoJob, {
    connection: redisConfig,
    concurrency: 1, // FFmpeg is CPU-heavy — one at a time
  });

  videoWorker.on("completed", (job, result) => {
    logger.info({ jobId: job.id, videoId: result.videoId }, "Video job completed");
  });
  videoWorker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, "Video job failed");
  });
  videoWorker.on("error", (err) => {
    logger.error({ err }, "Video worker error");
  });

  _workers.push(videoWorker);

  // ── AI Processing Worker ──────────────────────────────────────────────────
  const aiWorker = new Worker("ai-processing", processAiJob, {
    connection: redisConfig,
    concurrency: 1, // API rate limits — one at a time
  });

  aiWorker.on("completed", (job, result) => {
    logger.info({ jobId: job.id, videoId: result.videoId }, "AI job completed");
  });
  aiWorker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, "AI job failed");
  });
  aiWorker.on("error", (err) => {
    logger.error({ err }, "AI worker error");
  });

  _workers.push(aiWorker);

  // ── Analytics Worker ──────────────────────────────────────────────────────
  const analyticsWorker = new Worker("analytics-jobs", processAnalyticsJob, {
    connection: redisConfig,
    concurrency: 50,
  });

  analyticsWorker.on("failed", (job, err) => {
    logger.error({ jobId: job.id, err: err.message }, "Analytics job failed");
  });
  analyticsWorker.on("error", (err) => {
    logger.error({ err }, "Analytics worker error");
  });

  _workers.push(analyticsWorker);

  logger.info(
    "✅ All workers started in-process (video-processing, ai-processing, analytics)"
  );
}

/**
 * Gracefully close all workers.
 * Call this during shutdown before disconnecting from MongoDB.
 */
export async function stopWorkers() {
  // Flush any buffered analytics events
  await flushBuffer();

  // Close all workers
  await Promise.allSettled(_workers.map((w) => w.close()));
  logger.info("All in-process workers stopped");
}
