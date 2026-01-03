import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Compass, Upload, User } from "lucide-react";

export default function Sidebar() {
  const { pathname } = useLocation();
  const linkClasses = (path) =>
    `flex items-center gap-3 px-4 py-2 rounded-md transition ${
      pathname === path
        ? "bg-violet-600 text-white"
        : "hover:bg-gray-100 text-gray-700"
    }`;

  return (
    <aside className="w-64 hidden md:block border-r bg-white">
      <nav className="p-4 space-y-1">
        <Link to="/" className={linkClasses("/")}>
          <Home size={18} /> Home
        </Link>
        <Link to="/explore" className={linkClasses("/explore")}>
          <Compass size={18} /> Explore
        </Link>
        <Link to="/upload" className={linkClasses("/upload")}>
          <Upload size={18} /> Upload
        </Link>
        <Link to="/login" className={linkClasses("/login")}>
          <User size={18} /> Sign in
        </Link>
      </nav>
    </aside>
  );
}
