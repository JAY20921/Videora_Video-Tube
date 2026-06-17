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

// ─── Eagerly-loaded layout components (small, needed immediately) ─────────────
import Navbar          from "./components/Navbar";
import SideNav         from "./components/SideNav";
import ProtectedRoute  from "./components/ProtectedRoute";

// ─── Minimal fallback while a lazy chunk loads ────────────────────────────────
const PageLoader = () => (
  <div className="flex-1 flex items-center justify-center text-neutral-500 text-sm">
    Loading…
  </div>
);

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-900 text-gray-100 flex items-center justify-center">
        Loading…
      </div>
    );
  }

  // ─── Unauthenticated shell ────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="min-h-screen bg-neutral-900 text-gray-100 flex flex-col items-center justify-center">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login"    element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route
                path="*"
                element={
                  <div className="text-center">
                    <h1 className="text-3xl font-bold mb-4">Login to watch the videos</h1>
                    <div className="flex gap-4 justify-center mt-6">
                      <Link
                        to="/login"
                        className="bg-rose-600 px-6 py-2 rounded-md hover:bg-rose-700 transition font-medium"
                      >
                        Login
                      </Link>
                      <Link
                        to="/register"
                        className="bg-neutral-800 border border-neutral-700 px-6 py-2 rounded-md hover:bg-neutral-700 transition font-medium"
                      >
                        Register
                      </Link>
                    </div>
                  </div>
                }
              />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </div>
    );
  }

  // ─── Authenticated shell ──────────────────────────────────────────────────
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
            <ErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/"                    element={<Home />} />
                  <Route path="/explore"             element={<Explore />} />
                  <Route path="/search"              element={<SearchResults />} />
                  <Route path="/profile/:username"   element={<Profile />} />
                  <Route path="/video/:id"           element={<VideoPage />} />
                  <Route
                    path="/upload"
                    element={
                      <ProtectedRoute>
                        <Upload />
                      </ProtectedRoute>
                    }
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
