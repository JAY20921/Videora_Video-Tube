import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

export default function SearchBar() {
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  const onSubmit = (e) => {
    e.preventDefault();
    if (!q) return;
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <motion.form onSubmit={onSubmit} className="flex items-center gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search videos, creators, tags..."
        className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500"
      />
      <button type="submit" className="px-3 py-2 rounded-lg bg-neutral-800 border hover:bg-neutral-700">
        Search
      </button>
    </motion.form>
  );
}
