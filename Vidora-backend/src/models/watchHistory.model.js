import mongoose, { Schema } from "mongoose";

/**
 * Separate WatchHistory collection — replaces the unbounded array on User doc.
 * Unique index on (user, video) means upserts are safe — one record per user-video pair.
 */
const watchHistorySchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    video: {
      type: Schema.Types.ObjectId,
      ref: "Video",
      required: true,
    },
    watchedAt: {
      type: Date,
      default: Date.now,
    },
    progressSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: false }
);

// Fast lookup: "all history for user, sorted newest first"
watchHistorySchema.index({ user: 1, watchedAt: -1 });

// Unique: one record per user-video pair (upsert-safe)
watchHistorySchema.index({ user: 1, video: 1 }, { unique: true });

export const WatchHistory = mongoose.model("WatchHistory", watchHistorySchema);
