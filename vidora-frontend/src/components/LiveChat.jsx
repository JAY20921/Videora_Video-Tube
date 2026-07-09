import React, { useState, useEffect, useRef } from "react";
import { Send, Users, MessageSquareOff, MessageSquare } from "lucide-react";
import { useSocket } from "../context/SocketContext";
import { useAuth } from "../context/AuthContext";

export default function LiveChat({ videoId, partyId, isHost, chatEnabled = true }) {
  const socket = useSocket();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    setMessages([]); // Clear messages when switching to/from watchparty
  }, [partyId]);

  useEffect(() => {
    if (!socket || !videoId) return;

    const handleNewChat = (data) => {
      setMessages((prev) => [...prev, data]);
    };

    socket.on("new-chat", handleNewChat);

    return () => {
      socket.off("new-chat", handleNewChat);
    };
  }, [socket, videoId, partyId]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (socket && !socket.connected) socket.connect();
    if (!input.trim() || !socket || (!chatEnabled && !isHost)) return;

    const messageData = {
      videoId,
      partyId,
      message: input.trim(),
      user: {
        _id: user?._id || "anonymous",
        username: user?.username || "Anonymous",
        avatar: user?.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=anonymous",
      },
    };

    // Emit to server
    socket.emit("send-chat", messageData);

    // Optimistically add to local state
    setMessages((prev) => [...prev, { ...messageData, timestamp: new Date() }]);
    setInput("");
  };

  const handleToggleChat = () => {
    if (isHost && socket) {
      socket.emit("toggle-chat", { partyId, enabled: !chatEnabled });
    }
  };

  return (
    <div className="flex flex-col h-full bg-neutral-900 border border-white/10 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10 bg-neutral-900/50 flex items-center gap-2">
        <Users size={18} className={partyId ? "text-purple-500" : "text-rose-500"} />
        <h3 className="font-semibold text-white">
          {partyId ? "Party Chat" : "Live Chat"}
        </h3>
        
        {isHost && (
          <button 
            onClick={handleToggleChat} 
            title={chatEnabled ? "Disable Chat for Viewers" : "Enable Chat for Viewers"}
            className={`ml-2 p-1.5 rounded-full transition-colors ${chatEnabled ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'}`}
          >
            {chatEnabled ? <MessageSquare size={14} /> : <MessageSquareOff size={14} />}
          </button>
        )}

        <span className={`ml-auto text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1.5 ${partyId ? 'bg-purple-500/10 text-purple-400' : 'bg-rose-500/10 text-rose-500'}`}>
          <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${partyId ? 'bg-purple-500' : 'bg-rose-500'}`} />
          Live
        </span>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-neutral-500 space-y-2">
            <Users size={32} className="opacity-20" />
            <p className="text-sm">No messages yet. Say hello!</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMe = msg.user._id === user?._id;
            return (
              <div key={i} className={`flex gap-3 ${isMe ? "flex-row-reverse" : ""}`}>
                <img
                  src={msg.user.avatar}
                  alt={msg.user.username}
                  className="w-8 h-8 rounded-full bg-neutral-800 object-cover border border-white/10"
                />
                <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-xs font-semibold text-white/80">
                      {isMe ? "You" : msg.user.username}
                    </span>
                    <span className="text-[10px] text-neutral-500">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div
                    className={`text-sm px-3 py-2 rounded-2xl ${
                      isMe
                        ? "bg-rose-500 text-white rounded-tr-sm"
                        : "bg-neutral-800 text-neutral-200 rounded-tl-sm border border-white/5"
                    }`}
                  >
                    {msg.message}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={sendMessage} className="p-3 bg-neutral-900 border-t border-white/10 relative">
        {!chatEnabled && !isHost && (
          <div className="absolute inset-0 bg-neutral-900/90 backdrop-blur-sm z-10 flex items-center justify-center border-t border-white/10">
            <p className="text-xs text-neutral-400 font-medium flex items-center gap-1.5">
              <MessageSquareOff size={14} /> Host has disabled chat
            </p>
          </div>
        )}
        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => { if (socket && !socket.connected) socket.connect(); }}
            disabled={!chatEnabled && !isHost}
            placeholder={partyId ? "Chat with party members..." : "Chat with others watching..."}
            className="w-full bg-neutral-800 border border-white/10 rounded-full pl-4 pr-12 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500/50 transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || (!chatEnabled && !isHost)}
            className="absolute right-1.5 p-1.5 bg-rose-500 text-white rounded-full hover:bg-rose-600 disabled:opacity-50 disabled:hover:bg-rose-500 transition-colors"
          >
            <Send size={16} className="-ml-0.5 mt-0.5" />
          </button>
        </div>
      </form>
    </div>
  );
}
