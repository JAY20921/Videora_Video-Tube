# 🎬 Videora - VideoTube
> **Broadcast Your World.** > A next-generation video sharing platform built for creators and viewers alike.

[![Live Demo](https://img.shields.io/badge/demo-online-green.svg)](https://videora-video-tube.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MERN Stack](https://img.shields.io/badge/Stack-MERN-blueviolet)](https://www.mongodb.com/mern-stack)

---

## 📖 Table of Contents
- [About the Project](#-about-the-project)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [Project Architecture](#-project-architecture)
- [Code Walkthrough](#-code-walkthrough)
- [Getting Started](#-getting-started)
- [Future Upgrades](#-future-upgrades)
- [Contact](#-contact)

---

## 🌟 About the Project

**Videora** is a fully functional video hosting and streaming application designed to replicate the core experience of major platforms like YouTube. It allows users to join a community, upload their own content, and engage with videos through likes and comments.

The project is split into two distinct parts:
1.  **Vidora-backend**: A robust RESTful API that handles data, authentication, and file management.
2.  **vidora-frontend**: A dynamic, responsive React application that delivers a smooth user interface.

---

## 🚀 Key Features

### 👤 User Experience
* **Secure Authentication**: JWT-based Sign Up and Login system to keep user accounts safe.
* **User Profiles**: Customizable channel pages with avatar and cover image uploads.
* **Subscriptions**: Subscribe to favorite creators and manage your feed.

### 📹 Video Management
* **Seamless Uploads**: Drag-and-drop video uploading with progress indicators.
* **Video Playback**: Custom video player with play/pause, volume control, and fullscreen modes.
* **Dashboard**: A studio dashboard to manage uploaded content.

### 💬 Engagement
* **Like & Dislike**: Real-time interaction stats on every video.
* **Comments System**: Threaded discussions under videos to foster community.
* **Search & Filter**: Find videos by title, tags, or categories instantly.

---

## 🛠 Tech Stack

### **Frontend (Client-Side)**
* **React.js**: For building the component-based UI.
* **Redux / Context API**: For global state management (User auth status, video data).
* **Tailwind CSS**: For modern, responsive styling.
* **Axios**: For making HTTP requests to the backend.

### **Backend (Server-Side)**
* **Node.js & Express.js**: The backbone of the API.
* **MongoDB & Mongoose**: NoSQL database for flexible data modeling (Users, Videos, Comments).
* **JWT (JSON Web Tokens)**: For stateless authentication.
* **Multer**: For handling file uploads (Videos/Images).
* **Cloudinary** : Cloud storage for media assets.

---

## 🏗 Project Architecture

Here is how the project codebase is organized:

```text
Videora_Video-Tube/
├── 📂 Vidora-backend/         # Server-side logic
│   ├── 📂 controllers/        # Logic for handling requests (e.g., video.controller.js)
│   ├── 📂 models/             # Database schemas (User.js, Video.js)
│   ├── 📂 routes/             # API endpoints (auth.routes.js, video.routes.js)
│   ├── 📂 utils/              # Helper functions (Cloudinary upload, Error handling)
│   ├── 📂 middlewares/        # Auth verification (multer, jwtVerify)
│   ├── app.js                 # Express app configuration
│   └── index.js               # Server entry point
│
└── 📂 vidora-frontend/        # Client-side application
    ├── 📂 src/
    │   ├── 📂 components/     # Reusable UI (Header, VideoCard, Sidebar)
    │   ├── 📂 pages/          # Full pages (Home, VideoDetail, Login)
    │   ├── 📂 store/          # State management (Redux slices)
    │   └── main.jsx           # React entry point
    └── package.json           # Frontend dependencies

