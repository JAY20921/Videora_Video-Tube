import React, { useState } from "react";
import { motion } from "framer-motion";
import { toggleSubscription } from "../api/users";
import { useAuth } from "../context/AuthContext";

/**
 * SubscribeButton — toggles channel subscription.
 * @param {string} channelId - the channel owner's user ID
 * @param {boolean} initialSubscribed
 * @param {number} subscriberCount
 * @param {function} onToggle - optional callback after toggle
 */
export default function SubscribeButton({ channelId, initialSubscribed = false, subscriberCount = 0, onToggle }) {
  const { user } = useAuth();
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [count, setCount] = useState(subscriberCount);
  const [loading, setLoading] = useState(false);

  // Don't show subscribe button for own channel
  if (user && user._id === channelId) return null;

  const handleToggle = async () => {
    if (loading) return;
    setLoading(true);

    // Optimistic
    setSubscribed((prev) => !prev);
    setCount((prev) => (subscribed ? prev - 1 : prev + 1));

    try {
      const res = await toggleSubscription(channelId);
      onToggle?.(res);
    } catch {
      // Revert
      setSubscribed((prev) => !prev);
      setCount((prev) => (subscribed ? prev + 1 : prev - 1));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={handleToggle}
        disabled={loading}
        className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
          subscribed
            ? "bg-neutral-800 border border-neutral-600 text-neutral-300 hover:bg-neutral-700"
            : "bg-white text-neutral-900 hover:bg-neutral-200"
        }`}
      >
        {subscribed ? "Subscribed" : "Subscribe"}
      </motion.button>
      {count > 0 && (
        <span className="text-xs text-neutral-500">{count.toLocaleString()} subscriber{count !== 1 ? "s" : ""}</span>
      )}
    </div>
  );
}
