import "dotenv/config";
import fs from "fs";
import path from "path";
import axios from "axios";
import FormData from "form-data";
import { execSync } from "child_process";
import ffmpeg from "ffmpeg-static";

// Configuration
const API_URL = "http://localhost:8000/api/v1";
const TEST_DIR = path.join(process.cwd(), "tmp_test");
const VIDEO_PATH = path.join(TEST_DIR, "test-video.mp4");
const THUMB_PATH = path.join(TEST_DIR, "test-thumb.jpg");

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  console.log("🚀 Starting Upload Test...");

  // 1. Create test files
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR);
  }
  
  if (!fs.existsSync(VIDEO_PATH)) {
    console.log("Generating dummy video (11 seconds, red screen, silent audio)...");
    execSync(`"${ffmpeg}" -f lavfi -i color=c=red:s=640x360:d=11 -f lavfi -i anullsrc=r=44100:cl=stereo:d=11 -c:v libx264 -pix_fmt yuv420p -c:a aac "${VIDEO_PATH}" -y`);
  }
  
  if (!fs.existsSync(THUMB_PATH)) {
    console.log("Generating dummy thumbnail...");
    execSync(`"${ffmpeg}" -f lavfi -i color=c=blue:s=640x360:d=1 -vframes 1 "${THUMB_PATH}" -y`);
  }

  // 2. Register/Login to get token
  let token = "";
  const username = "testuser_" + Date.now();
  const email = username + "@example.com";
  
  try {
    console.log("Registering test user...");
    // Create an avatar (use thumb)
    const formData = new FormData();
    formData.append("username", username);
    formData.append("email", email);
    formData.append("password", "password123");
    formData.append("fullName", "Test User");
    formData.append("avatar", fs.createReadStream(THUMB_PATH));

    const regRes = await axios.post(`${API_URL}/users/register`, formData, {
      headers: formData.getHeaders(),
    });
    console.log("Registered:", regRes.data.message);
    
    // Login
    const loginRes = await axios.post(`${API_URL}/users/login`, {
      email,
      password: "password123"
    });
    token = loginRes.data.data.accessToken;
    console.log("Logged in successfully. Got token.");
  } catch (err) {
    console.error("Auth failed:", err.response?.data || err.message);
    return;
  }

  // 3. Upload Video
  let videoId = "";
  try {
    console.log("Uploading video...");
    const formData = new FormData();
    formData.append("title", "Test Video for Worker");
    formData.append("description", "Checking if in-process worker works.");
    formData.append("videoFile", fs.createReadStream(VIDEO_PATH));
    formData.append("thumbnail", fs.createReadStream(THUMB_PATH));

    const uploadRes = await axios.post(`${API_URL}/videos`, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${token}`
      }
    });
    videoId = uploadRes.data.data._id;
    console.log("Video Uploaded! ID:", videoId);
  } catch (err) {
    console.error("Upload failed:", err.response?.data || err.message);
    return;
  }

  // 4. Poll status
  console.log("Polling for video status...");
  let attempts = 0;
  while (attempts < 20) {
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
