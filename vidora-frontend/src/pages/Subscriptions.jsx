import React, { useEffect, useState } from "react";
import { getSubscribedChannels } from "../api/users";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import Loading from "../components/Loading";
import { Users } from "lucide-react";

export default function Subscriptions() {
  const { user } = useAuth();
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?._id) return;
    getSubscribedChannels(user._id)
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setChannels(list);
      })
      .catch(() => setChannels([]))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <Loading text="Loading subscriptions..." />;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Users size={22} className="text-purple-400" />
        <h1 className="text-2xl font-bold">Subscriptions</h1>
        <span className="text-sm text-neutral-500 ml-1">{channels.length} channel{channels.length !== 1 ? "s" : ""}</span>
      </div>

      {channels.length === 0 ? (
        <div className="text-center py-16 text-neutral-500">
          <Users size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg">No subscriptions yet</p>
          <p className="text-sm mt-1">Channels you subscribe to will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {channels.map((sub) => {
            const ch = sub.channel || sub;
            return (
              <Link
                key={sub._id || ch._id}
                to={`/profile/${ch.username}`}
                className="flex items-center gap-4 bg-neutral-800/40 border border-neutral-800 rounded-xl p-4 hover:bg-neutral-800/70 transition group"
              >
                <div className="w-14 h-14 rounded-full bg-neutral-700 overflow-hidden flex-shrink-0">
                  {ch.avatar ? (
                    <img src={ch.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-lg font-bold text-white">
                      {ch.fullName?.[0]?.toUpperCase() || ch.username?.[0]?.toUpperCase() || "?"}
                    </div>
                  )}
                </div>
                <div>
                  <div className="font-semibold text-white group-hover:text-rose-400 transition">
                    {ch.fullName || ch.username}
                  </div>
                  <div className="text-xs text-neutral-500">@{ch.username}</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
