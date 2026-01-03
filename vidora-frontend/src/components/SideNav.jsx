import React from "react";
import { NavLink } from "react-router-dom";
import { Home, Compass, Upload, User } from "lucide-react";
import { motion } from "framer-motion";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/upload", label: "Upload", icon: Upload },
  { to: "/login", label: "Sign in", icon: User },
];

export default function SideNav() {
  return (
    <aside className="w-72 hidden md:flex flex-col bg-neutral-950 border-r border-neutral-800 min-h-screen p-4 sticky top-0">
      <div className="mb-6 flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg bg-gradient-to-tr from-red-600 to-rose-500 flex items-center justify-center text-white font-bold shadow">
          V
        </div>
        <div>
          <div className="text-lg font-semibold">Vidora</div>
          <div className="text-xs text-neutral-400">Cinematic videos</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg transition ${
                isActive ? "bg-neutral-800 text-white" : "text-neutral-300 hover:bg-neutral-900"
              }`
            }
          >
            <motion.span initial={{ x: -8, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.2 }}>
              <Icon size={18} />
            </motion.span>
            <span className="font-medium">{label}</span>
          </NavLink>
        ))}
      </nav>

      
    </aside>
  );
}
