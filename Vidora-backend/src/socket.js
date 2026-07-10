import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { redisConfig } from "./config/redis.js";
import { logger } from "./utils/logger.js";
import Redis from "ioredis";

let io;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN?.split(",").map((s) => s.trim()) || "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Setup Redis Adapter for multi-server scaling
  // CRITICAL: Error handlers MUST be attached before any I/O.
  // Without them, Redis disconnect emits an unhandled 'error' event
  // which crashes the entire Node.js process.
  try {
    const pubClient = new Redis({ ...redisConfig, retryStrategy: (times) => Math.min(times * 500, 5000) });
    const subClient = pubClient.duplicate();

    pubClient.on("error", (err) => {
      logger.warn({ err: err.message }, "Socket.IO Redis pubClient error (non-fatal)");
    });
    subClient.on("error", (err) => {
      logger.warn({ err: err.message }, "Socket.IO Redis subClient error (non-fatal)");
    });

    io.adapter(createAdapter(pubClient, subClient));
  } catch (err) {
    logger.warn({ err: err.message }, "Redis adapter setup failed — Socket.IO running without clustering");
  }

  // Watch Parties State (In-memory for now, move to Redis for multi-server)
  const watchparties = new Map();

  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id }, "Client connected to WebSocket");

    // Create Watch Party
    socket.on("create-watchparty", ({ videoId }, callback) => {
      const partyId = Math.random().toString(36).substring(2, 9);
      watchparties.set(partyId, { hostId: socket.id, videoId, chatEnabled: true });
      socket.join(`party-${partyId}`);
      logger.info({ socketId: socket.id, partyId }, "Watchparty created");
      if (callback) callback({ partyId });
    });

    // Join Watch Party
    socket.on("join-watchparty", ({ partyId }, callback) => {
      const party = watchparties.get(partyId);
      if (!party) {
        if (callback) callback({ error: "Watchparty not found" });
        return;
      }
      socket.join(`party-${partyId}`);
      logger.info({ socketId: socket.id, partyId }, "Client joined watchparty");
      if (callback) callback({ success: true, videoId: party.videoId, chatEnabled: party.chatEnabled });
    });

    // Leave Watch Party
    socket.on("leave-watchparty", ({ partyId }) => {
      socket.leave(`party-${partyId}`);
      const party = watchparties.get(partyId);
      if (party && party.hostId === socket.id) {
        // Host left, end party
        io.to(`party-${partyId}`).emit("watchparty-ended");
        watchparties.delete(partyId);
      }
    });

    // Toggle Chat
    socket.on("toggle-chat", ({ partyId, enabled }) => {
      const party = watchparties.get(partyId);
      if (party && party.hostId === socket.id) {
        party.chatEnabled = enabled;
        io.to(`party-${partyId}`).emit("chat-toggled", enabled);
      }
    });

    // Watch Party / Video Rooms
    socket.on("join-video-room", (videoId) => {
      socket.join(`video-${videoId}`);
      logger.info({ socketId: socket.id, videoId }, "Client joined video room");
    });

    socket.on("leave-video-room", (videoId) => {
      socket.leave(`video-${videoId}`);
      logger.info({ socketId: socket.id, videoId }, "Client left video room");
    });

    // Real-time Collaboration Events (Host -> Viewers)
    socket.on("sync-seek", ({ videoId, partyId, time }) => {
      if (partyId) {
        const party = watchparties.get(partyId);
        if (party && party.hostId === socket.id) {
          socket.to(`party-${partyId}`).emit("sync-seek", time);
        }
      }
    });

    socket.on("sync-play", ({ videoId, partyId, time }) => {
      if (partyId) {
        const party = watchparties.get(partyId);
        if (party && party.hostId === socket.id) {
          socket.to(`party-${partyId}`).emit("sync-play", time);
        }
      }
    });

    socket.on("sync-pause", ({ videoId, partyId }) => {
      if (partyId) {
        const party = watchparties.get(partyId);
        if (party && party.hostId === socket.id) {
          socket.to(`party-${partyId}`).emit("sync-pause");
        }
      }
    });

    // Chat Messages
    socket.on("send-chat", ({ videoId, partyId, message, user }) => {
      if (partyId) {
        const party = watchparties.get(partyId);
        if (!party) return;
        if (!party.chatEnabled && party.hostId !== socket.id) {
          socket.emit("chat-error", "Host has disabled chat.");
          return;
        }
        socket.to(`party-${partyId}`).emit("new-chat", { message, user, timestamp: new Date() });
      } else {
        // Broadcast to video room except sender
        socket.to(`video-${videoId}`).emit("new-chat", { message, user, timestamp: new Date() });
      }
      
      // TODO: Buffer messages in Redis and flush to MongoDB periodically
    });

    socket.on("disconnect", () => {
      logger.info({ socketId: socket.id }, "Client disconnected from WebSocket");
      for (const [partyId, party] of watchparties.entries()) {
        if (party.hostId === socket.id) {
          io.to(`party-${partyId}`).emit("watchparty-ended");
          watchparties.delete(partyId);
          logger.info({ partyId }, "Watchparty ended due to host disconnect");
        }
      }
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};
