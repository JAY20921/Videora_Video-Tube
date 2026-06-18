import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const videoSchema = new Schema(
  {
    videoFile: {
      type: String,
      required: true,
    },
    thumbnail: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    duration: {
      type: Number,
      required: true,
    },
    views: {
      type: Number,
      default: 0,
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
    /**
     * Phase 3: Processing pipeline status.
     * - "ready"      — playable (raw MP4 or HLS transcoded)
     * - "processing"  — FFmpeg transcoding in progress
     * - "failed"      — transcoding failed after all retries
     */
    status: {
      type: String,
      enum: ["processing", "ready", "failed"],
      default: "ready",
    },
    /**
     * Phase 3: Master HLS playlist URL (.m3u8).
     * Empty string for legacy MP4-only videos.
     */
    hlsUrl: {
      type: String,
      default: "",
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Fast retrieval of a channel's videos, newest first
videoSchema.index({ owner: 1, createdAt: -1 });

// Full-text search index for $text queries (Phase 0: replaces $regex)
videoSchema.index({ title: "text", description: "text" });

videoSchema.plugin(mongooseAggregatePaginate);

export const Video = mongoose.model("Video", videoSchema);