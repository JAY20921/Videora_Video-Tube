import React from "react";
import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Explore from "./pages/Explore";
import SearchResults from "./pages/SearchResults";
import Profile from "./pages/Profile";
import VideoPage from "./pages/VideoPage";
import Upload from "./pages/Upload";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Navbar from "./components/Navbar";
import SideNav from "./components/SideNav";
import ProtectedRoute from "./components/ProtectedRoute";
import { motion } from "framer-motion";
import "./index.css";
export default function App() {
  return (
    <div className="min-h-screen bg-neutral-900 text-gray-100 flex">
      <SideNav />
      <div className="flex-1 flex flex-col">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-6">
          <motion.div
            key="page"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35 }}
          >
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/explore" element={<Explore />} />
              <Route path="/search" element={<SearchResults />} />
              <Route path="/profile/:username" element={<Profile />} />
              <Route path="/video/:id" element={<VideoPage />} />
              <Route
                path="/upload"
                element={
                  <ProtectedRoute>
                    <Upload />
                  </ProtectedRoute>
                }
              />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
            </Routes>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
