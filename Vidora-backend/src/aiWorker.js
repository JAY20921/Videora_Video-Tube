/**
 * AI Processing Worker — Phase 5
 *
 * A separate Node.js process that consumes jobs from the "ai-processing" BullMQ queue.
 * Each job:
 *   1. Downloads the raw video from Cloudinary
 *   2. Extracts audio and sends to Groq Whisper for transcription
 *   3. Chunks the transcript (~200 words, 50 overlap)
 *   4. Generates embeddings for all chunks
 *   5. Stores embeddings in Qdrant vector database
 *   6. Extracts knowledge graph concepts via LLM
 *   7. Generates timestamped chapters via LLM
 *   8. Saves the Transcript document in MongoDB
 *   9. Updates the Video document (aiStatus → "ready")
 *
 * Run: `node src/aiWorker.js`
 * Requires: FFmpeg installed, Redis running, Groq API key, Qdrant available
 */

import "dotenv/config";
import { Worker } from "bullmq";
import { redisConfig } from "./config/redis.js";
import { logger } from "./utils/logger.js";
import mongoose from "mongoose";
import { Video } from "./models/video.model.js";
import { Transcript } from "./models/transcript.model.js";
import { transcribeVideo } from "./services/transcription.service.js";
import { chunkTranscript } from "./services/chunking.service.js";
import { embedTexts } from "./services/embedding.service.js";
import { storeChunks } from "./services/vectorStore.service.js";
import { extractConcepts, generateChapters } from "./services/knowledgeGraph.service.js";
import { ensureCollection } from "./config/qdrant.js";
import fs from "fs/promises";
import { createWriteStream } from "fs";
import path from "path";
import https from "https";
import http from "http";

// ─── Constants ────────────────────────────────────────────────────────────────
const TEMP_DIR = path.resolve("tmp_ai_processing");

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Job Processor ────────────────────────────────────────────────────────────

async function processAiJob(job) {
  const { videoId, rawUrl, title, duration } = job.data;
  const jobDir = path.join(TEMP_DIR, videoId);

  logger.info({ videoId, title }, "Starting AI processing");

  // Skip very short videos (< 10 seconds)
  if (duration && duration < 10) {
    logger.info({ videoId }, "Video too short for AI processing — skipping");
    await Video.findByIdAndUpdate(videoId, { aiStatus: "skipped" });
    return { videoId, status: "skipped" };
  }

  // Create or update transcript document
  let transcript = await Transcript.findOne({ video: videoId });
  if (!transcript) {
    transcript = await Transcript.create({ video: videoId, status: "pending" });
  }

  try {
    // Update status
    await Video.findByIdAndUpdate(videoId, { aiStatus: "processing" });
    transcript.status = "transcribing";
    await transcript.save();

    // 1. Create temp directory
    await fs.mkdir(jobDir, { recursive: true });
    job.updateProgress(5);

    // 2. Download raw video
    const inputPath = path.join(jobDir, "raw_input.mp4");
    logger.info({ videoId }, "Downloading raw video for AI...");
    await downloadFile(rawUrl, inputPath);
    job.updateProgress(10);

    // 3. Transcribe with Whisper
    logger.info({ videoId }, "Transcribing with Whisper...");
    let { segments, fullText, language } = await transcribeVideo(inputPath, jobDir);

    // Fallback: If no voice or very short transcript, use title and description
    if (fullText.trim().length < 20) {
      logger.info({ videoId }, "Transcript empty or too short. Using title and description as fallback.");
      const video = await Video.findById(videoId);
      const fallbackText = `${title}. ${video?.description || ""}`.trim();
      
      fullText = fallbackText;
      segments = [{
        start: 0,
        end: duration || 10,
        text: fallbackText
      }];
      language = "en"; // default to english for fallback
    }

    transcript.segments = segments;
    transcript.fullText = fullText;
    transcript.language = language;
    transcript.status = "chunking";
    await transcript.save();
    job.updateProgress(30);

    // 4. Chunk the transcript
    logger.info({ videoId }, "Chunking transcript...");
    const chunks = chunkTranscript(segments);
    transcript.status = "embedding";
    await transcript.save();
    job.updateProgress(40);

    // 5. Generate embeddings
    logger.info({ videoId, chunkCount: chunks.length }, "Generating embeddings...");
    const chunkTexts = chunks.map((c) => c.text);
    const embeddings = await embedTexts(chunkTexts);
    job.updateProgress(60);

    // 6. Store in Qdrant
    logger.info({ videoId }, "Storing vectors in Qdrant...");
    const pointIds = await storeChunks(videoId, chunks, embeddings);

    // Map point IDs back to chunks
    transcript.chunks = chunks.map((chunk, i) => ({
      ...chunk,
      qdrantPointId: pointIds[i] || "",
    }));
    transcript.status = "extracting";
    await transcript.save();
    job.updateProgress(70);

    // 7. Extract knowledge graph concepts
    logger.info({ videoId }, "Extracting knowledge graph...");
    const concepts = await extractConcepts(fullText);
    transcript.concepts = concepts;
    job.updateProgress(85);

    // 8. Generate chapters
    logger.info({ videoId }, "Generating chapters...");
    const chapters = await generateChapters(segments);
    transcript.chapters = chapters;
    job.updateProgress(95);

    // 9. Finalize
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
    // Mark as failed
    transcript.status = "failed";
    await transcript.save().catch(() => {});
    await Video.findByIdAndUpdate(videoId, { aiStatus: "failed" }).catch(() => {});

    logger.error({ err: error, videoId }, "AI processing failed");
    throw error; // BullMQ will retry based on backoff config
  } finally {
    // Cleanup temp files
    try {
      await fs.rm(jobDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

// ─── Connect to MongoDB & Start Worker ────────────────────────────────────────

async function start() {
  await fs.mkdir(TEMP_DIR, { recursive: true });

  // Connect to MongoDB
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    logger.error("MONGODB_URI is not set — AI worker cannot start");
    process.exit(1);
  }
  await mongoose.connect(`${mongoUri}/videotube`);
  logger.info("AI Worker connected to MongoDB (videotube)");

  // Ensure Qdrant collection exists
  await ensureCollection();

  // Create BullMQ worker
  const worker = new Worker("ai-processing", processAiJob, {
    connection: redisConfig,
    concurrency: 1, // Process one video at a time (API rate limits)
  });

  worker.on("completed", (job, result) => {
    logger.info({ jobId: job.id, videoId: result.videoId }, "AI job completed");
  });

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, "AI job failed");
  });

  worker.on("error", (err) => {
    logger.error({ err }, "AI Worker error");
  });

  logger.info("AI processing worker started — waiting for jobs...");

  // Graceful shutdown
  const shutdown = async (signal) => {
    logger.info(`${signal} received — closing AI worker gracefully`);
    await worker.close();
    await mongoose.disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((err) => {
  logger.error({ err }, "AI Worker failed to start");
  process.exit(1);
});
