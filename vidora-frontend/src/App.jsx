import React, { Suspense, lazy } from "react";
import { Routes, Route, Link, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { motion } from "framer-motion";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";

// ─── Lazy-loaded pages ────────────────────────────────────────────────────────
const Home          = lazy(() => import("./pages/Home"));
const Explore       = lazy(() => import("./pages/Explore"));
const SearchResults = lazy(() => import("./pages/SearchResults"));
const Profile       = lazy(() => import("./pages/Profile"));
const VideoPage     = lazy(() => import("./pages/VideoPage"));
const Upload        = lazy(() => import("./pages/Upload"));
const Login         = lazy(() => import("./pages/Login"));
const Register      = lazy(() => import("./pages/Register"));
const Landing       = lazy(() => import("./pages/Landing"));
const Dashboard     = lazy(() => import("./pages/Dashboard"));
const LikedVideos   = lazy(() => import("./pages/LikedVideos"));
const Subscriptions = lazy(() => import("./pages/Subscriptions"));
const StudyTogether = lazy(() => import("./pages/StudyTogether"));
const SkillTree     = lazy(() => import("./pages/SkillTree"));

// ─── Eagerly-loaded layout components (small, needed immediately) ─────────────
import Navbar          from "./components/Navbar";
import SideNav         from "./components/SideNav";
import ProtectedRoute  from "./components/ProtectedRoute";

// ─── Minimal fallback while a lazy chunk loads ────────────────────────────────
const PageLoader = () => (
  <div className="flex-1 flex items-center justify-center text-neutral-500 text-sm">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
      <span>Loading…</span>
    </div>
  </div>
);

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-gray-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-red-600 to-rose-500 flex items-center justify-center text-white font-bold text-xl shadow-lg animate-pulse">
            V
          </div>
          <span className="text-neutral-500 text-sm">Loading Vidora…</span>
        </div>
      </div>
    );
  }

  // ─── Unauthenticated shell ────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="min-h-screen bg-neutral-950 text-gray-100 flex flex-col">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login"    element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="*" element={<Landing />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </div>
    );
  }

  // ─── Authenticated shell ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-neutral-950 text-gray-100 flex">
      <SideNav />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />
        <main className="flex-1 px-4 lg:px-8 py-6">
          <motion.div
            key="page"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
          >
            <ErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/"                    element={<Home />} />
                  <Route path="/explore"             element={<Explore />} />
                  <Route path="/search"              element={<SearchResults />} />
                  <Route path="/profile/:username"   element={<Profile />} />
                  <Route path="/video/:id"           element={<VideoPage />} />
                  <Route path="/liked"               element={<LikedVideos />} />
                  <Route path="/subscriptions"       element={<Subscriptions />} />
                  <Route path="/study-together"      element={<StudyTogether />} />
                  <Route path="/skill-tree/:id"      element={<SkillTree />} />
                  <Route
                    path="/upload"
                    element={<ProtectedRoute><Upload /></ProtectedRoute>}
                  />
                  <Route
                    path="/dashboard"
                    element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
                  />
                  {/* Redirect authenticated users away from auth pages */}
                  <Route path="/login"    element={<Navigate to="/" replace />} />
                  <Route path="/register" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
