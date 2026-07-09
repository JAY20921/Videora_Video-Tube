import "dotenv/config";
import fs from "fs";
import path from "path";
import axios from "axios";
import FormData from "form-data";
import { execSync } from "child_process";
import ffmpeg from "ffmpeg-static";

// Configuration
const API_URL = "http://localhost:8000/api/v1";
const VIDEO_PATH = "D:\\Downloads\\vidssave.com Arijit Singh - Tujhko (from Cocktail 2) Rashmika Mandanna, Shahid Kapoor & Kriti _ Love Song 2026 240P.mp4";
const THUMB_PATH = path.join(process.cwd(), "tmp_test", "test-thumb.jpg");

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  console.log("🚀 Starting Upload Test for Real Video...");
  
  if (!fs.existsSync(VIDEO_PATH)) {
    console.error("❌ Video file not found at:", VIDEO_PATH);
    return;
  }

  const testDir = path.join(process.cwd(), "tmp_test");
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir);
  
  if (!fs.existsSync(THUMB_PATH)) {
    console.log("Generating dummy thumbnail...");
    execSync(`"${ffmpeg}" -f lavfi -i color=c=blue:s=640x360:d=1 -vframes 1 "${THUMB_PATH}" -y`);
  }

  let token = "";
  const username = "testuser_real_" + Date.now();
  const email = username + "@example.com";
  
  try {
    console.log("Registering test user...");
    const formData = new FormData();
    formData.append("username", username);
    formData.append("email", email);
    formData.append("password", "password123");
    formData.append("fullName", "Test User");
    formData.append("avatar", fs.createReadStream(THUMB_PATH));

    const regRes = await axios.post(`${API_URL}/users/register`, formData, { headers: formData.getHeaders() });
    
    const loginRes = await axios.post(`${API_URL}/users/login`, { email, password: "password123" });
    token = loginRes.data.data.accessToken;
    console.log("Logged in successfully. Got token.");
  } catch (err) {
    console.error("Auth failed:", err.response?.data || err.message);
    return;
  }

  let videoId = "";
  try {
    console.log("Uploading video...");
    const formData = new FormData();
    formData.append("title", "Arijit Singh - Tujhko (from Cocktail 2)");
    formData.append("description", "Testing real upload pipeline");
    formData.append("videoFile", fs.createReadStream(VIDEO_PATH));
    formData.append("thumbnail", fs.createReadStream(THUMB_PATH));

    const uploadRes = await axios.post(`${API_URL}/videos`, formData, {
      headers: { ...formData.getHeaders(), Authorization: `Bearer ${token}` }
    });
    videoId = uploadRes.data.data._id;
    console.log("Video Uploaded! ID:", videoId);
  } catch (err) {
    console.error("Upload failed:", err.response?.data || err.message);
    return;
  }

  console.log("Polling for video status...");
  let attempts = 0;
  while (attempts < 60) { // 3 minutes total poll time
    await sleep(3000);
    attempts++;
    
    try {
      const statusRes = await axios.get(`${API_URL}/videos/status/${videoId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const { status, aiStatus, hlsUrl, progress } = statusRes.data.data;
      
      console.log(`[Attempt ${attempts}] Video: ${status} (Progress: ${progress}%) | AI: ${aiStatus}`);
      
      if (status === "ready" && (aiStatus === "ready" || aiStatus === "skipped" || aiStatus === "failed")) {
        console.log("✅ Processing complete!");
        console.log("HLS URL:", hlsUrl);
        break;
      }
      
      if (status === "failed") {
        console.log("❌ Video processing failed.");
        break;
      }
    } catch (err) {
      console.error("Status check failed:", err.response?.data || err.message);
    }
  }

  console.log("Test finished.");
}

runTest();
