import "dotenv/config";
import fs from "fs";
import path from "path";
import { transcribeVideo } from "../services/transcription.service.js";

const VIDEO_PATH = "D:\\Downloads\\vidssave.com Arijit Singh - Tujhko (from Cocktail 2) Rashmika Mandanna, Shahid Kapoor & Kriti _ Love Song 2026 240P.mp4";
const WORK_DIR = path.join(process.cwd(), "tmp_test");

async function testWhisper() {
  console.log("🚀 Testing Groq Whisper Transcription...");
  
  if (!fs.existsSync(VIDEO_PATH)) {
    console.error("❌ Video file not found at:", VIDEO_PATH);
    return;
  }

  if (!fs.existsSync(WORK_DIR)) {
    fs.mkdirSync(WORK_DIR, { recursive: true });
  }

  try {
    const { segments, fullText, language } = await transcribeVideo(VIDEO_PATH, WORK_DIR);
    
    console.log("✅ Whisper Transcription Successful!");
    console.log("Language Detected:", language);
    console.log("Number of Segments:", segments.length);
    console.log("\n--- Full Text Snippet ---");
    console.log(fullText.substring(0, 300) + "...\n-------------------------");
    
  } catch (error) {
    console.error("❌ Whisper Transcription Failed:");
    console.error(error.message || error);
  }
}

testWhisper();
