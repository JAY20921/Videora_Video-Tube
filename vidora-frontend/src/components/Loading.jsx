import React from "react";
import { motion } from "framer-motion";

export default function Loading({ text = "Loading..." }) {
  return (
    <div className="w-full h-[60vh] flex flex-col items-center justify-center gap-6">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
        className="w-16 h-16 rounded-full border-4 border-neutral-700 border-t-transparent"
      />
      <div className="text-sm text-neutral-400">{text}</div>
    </div>
  );
}
