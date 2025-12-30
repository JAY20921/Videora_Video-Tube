import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

export default function UserMenu() {
  const { user, handleLogout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const navigate = useNavigate();

  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  if (!user) return null;

  const initials = (user.fullName || user.username || 'U').split(' ').map(s => s[0]).join('').slice(0,2).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((s) => !s)} className="rounded-full border border-neutral-700 w-10 h-10 overflow-hidden flex items-center justify-center bg-gradient-to-tr from-rose-500 to-pink-500 text-white font-semibold">
        {user.avatar ? (
          <img src={user.avatar} alt="avatar" className="w-full h-full object-cover" />
        ) : (
          <span className="text-sm">{initials}</span>
        )}
      </button>

      {open && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="absolute right-0 mt-2 bg-neutral-900 border border-neutral-800 rounded-lg shadow-md w-56">
          <div className="p-3 border-b border-neutral-800">
            <div className="font-semibold truncate">{user.fullName || user.username}</div>
            <div className="text-xs text-neutral-400">@{user.username}</div>
          </div>

          <div className="flex flex-col p-2">
            <button onClick={() => navigate(`/profile/${user.username}`)} className="text-left px-2 py-2 rounded hover:bg-neutral-800">Profile</button>
            <button onClick={() => { handleLogout(); navigate('/login'); }} className="text-left px-2 py-2 rounded hover:bg-neutral-800">Logout</button>
            <button onClick={() => { handleLogout(); navigate('/login'); }} className="text-left px-2 py-2 rounded hover:bg-neutral-800">Switch user</button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
