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
  const pubClient = new Redis(redisConfig);
  const subClient = pubClient.duplicate();
  io.adapter(createAdapter(pubClient, subClient));

  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id }, "Client connected to WebSocket");

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
    socket.on("sync-seek", ({ videoId, time }) => {
      socket.to(`video-${videoId}`).emit("sync-seek", time);
    });

    socket.on("sync-play", ({ videoId }) => {
      socket.to(`video-${videoId}`).emit("sync-play");
    });

    socket.on("sync-pause", ({ videoId }) => {
      socket.to(`video-${videoId}`).emit("sync-pause");
    });

    // Chat Messages
    socket.on("send-chat", ({ videoId, message, user }) => {
      // Broadcast to room
      io.to(`video-${videoId}`).emit("new-chat", { message, user, timestamp: new Date() });
      
      // TODO: Buffer messages in Redis and flush to MongoDB periodically
    });

    socket.on("disconnect", () => {
      logger.info({ socketId: socket.id }, "Client disconnected from WebSocket");
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
