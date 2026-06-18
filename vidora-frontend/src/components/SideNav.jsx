import React from "react";
import { NavLink } from "react-router-dom";
import { Compass, Upload, User, History, BarChart3, Heart, Users, Home } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";

const navItem = (to, icon, label, delay = 0) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 ${
        isActive
          ? "bg-neutral-800 text-white shadow-sm"
          : "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
      }`
    }
  >
    <motion.span
      initial={{ x: -6, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.2, delay }}
    >
      {React.createElement(icon, { size: 18 })}
    </motion.span>
    <span className="text-sm font-medium">{label}</span>
  </NavLink>
);

export default function SideNav() {
  const { user } = useAuth();

  return (
    <aside className="w-60 hidden md:flex flex-col bg-neutral-950 border-r border-neutral-800 min-h-screen p-3 sticky top-0">
      {/* Logo */}
      <div className="mb-6 flex items-center gap-3 px-2 pt-1">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-red-600 to-rose-500 flex items-center justify-center text-white font-bold shadow-lg">
          V
        </div>
        <div>
          <div className="text-lg font-bold tracking-tight">Vidora</div>
          <div className="text-[10px] text-neutral-500 -mt-0.5">Stream • Share • Shine</div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5">
        {/* Main */}
        <div className="text-[10px] uppercase tracking-wider text-neutral-600 font-semibold px-3 mb-2">Main</div>
        {navItem("/", Home, "Home", 0)}
        {navItem("/explore", Compass, "Explore", 0.05)}

        {user && (
          <>
            {/* Library */}
            <div className="text-[10px] uppercase tracking-wider text-neutral-600 font-semibold px-3 mt-5 mb-2">Library</div>
            {navItem("/liked", Heart, "Liked Videos", 0.1)}
            {navItem("/subscriptions", Users, "Subscriptions", 0.15)}

            {/* Creator */}
            <div className="text-[10px] uppercase tracking-wider text-neutral-600 font-semibold px-3 mt-5 mb-2">Creator</div>
            {navItem("/upload", Upload, "Upload", 0.2)}
            {navItem("/dashboard", BarChart3, "Dashboard", 0.25)}

            {/* Account */}
            <div className="text-[10px] uppercase tracking-wider text-neutral-600 font-semibold px-3 mt-5 mb-2">Account</div>
            {navItem(`/profile/${user.username}`, User, "My Profile", 0.3)}
          </>
        )}

        {!user && (
          <>
            <div className="mt-5" />
            {navItem("/login", User, "Sign in", 0.1)}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="text-[10px] text-neutral-600 text-center py-3 border-t border-neutral-800/50">
        © 2026 Vidora
      </div>
    </aside>
  );
}
