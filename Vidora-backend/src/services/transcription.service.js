/**
 * Phase 5: Transcription service.
 *
 * Downloads audio from a video URL, converts to compressed format via FFmpeg,
 * and sends to Groq Whisper Large V3 Turbo for timestamped transcription.
 */
import { getGroqClient } from "../config/groq.js";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import { createReadStream } from "fs";
import path from "path";
import ffmpeg from "ffmpeg-static";

const execAsync = promisify(exec);

/**
 * Extract audio from a video file and compress to MP3.
 * Groq Whisper accepts max 25MB audio files.
 *
 * @param {string} videoPath - Local path to the video file
 * @param {string} outputPath - Local path for the output audio file
 * @returns {Promise<string>} Path to the compressed audio file
 */
async function extractAudio(videoPath, outputPath) {
  // Extract audio, downsample to 16kHz mono (optimal for Whisper), compress to 64kbps MP3
  const cmd = [
    `"${ffmpeg}"`,
    `-i "${videoPath}"`,
    `-threads 1`, // Locked to 1 thread to prevent OOM in production
    `-vn`,                    // no video
    `-acodec libmp3lame`,     // MP3 codec
    `-ar 16000`,              // 16kHz sample rate (Whisper optimal)
    `-ac 1`,                  // mono
    `-b:a 64k`,               // 64kbps bitrate (small file)
    `-y`,                     // overwrite
    `"${outputPath}"`,
  ].join(" ");

  await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024 });
  return outputPath;
}

/**
 * Transcribe a video file using Groq Whisper Large V3 Turbo.
 *
 * @param {string} videoPath - Local path to the downloaded video file
 * @param {string} workDir - Temporary working directory for audio extraction
 * @returns {Promise<{ segments: Array<{start: number, end: number, text: string}>, fullText: string, language: string }>}
 */
export async function transcribeVideo(videoPath, workDir) {
  const groq = getGroqClient();
  if (!groq) throw new Error("Groq client not available — GROQ_API_KEY not set");

  // 1. Extract and compress audio
  const audioPath = path.join(workDir, "audio.mp3");
  logger.info("Extracting audio from video...");
  await extractAudio(videoPath, audioPath);

  // 2. Check file size (Groq limit: 25MB)
  const stat = await fs.stat(audioPath);
  if (stat.size > 25 * 1024 * 1024) {
    throw new Error(`Audio file too large (${Math.round(stat.size / 1024 / 1024)}MB) — max 25MB`);
  }

  logger.info({ audioSize: `${Math.round(stat.size / 1024)}KB` }, "Sending audio to Whisper...");

  // 3. Send to Groq Whisper
  const transcription = await groq.audio.transcriptions.create({
    file: createReadStream(audioPath),
    model: config.groq.whisperModel,
    response_format: "verbose_json",  // includes timestamped segments
    language: "en",
    timestamp_granularities: ["segment"],
  });

  // 4. Parse response
  const segments = (transcription.segments || []).map((seg) => ({
    start: Math.round(seg.start * 100) / 100,
    end: Math.round(seg.end * 100) / 100,
    text: seg.text.trim(),
  }));

  const fullText = segments.map((s) => s.text).join(" ");
  const language = transcription.language || "en";

  logger.info(
    { segmentCount: segments.length, textLength: fullText.length, language },
    "Transcription complete"
  );

  // 5. Cleanup audio file
  await fs.unlink(audioPath).catch(() => {});

  return { segments, fullText, language };
}
