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
    spritesheetUrl: {
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

// ─── Phase 4: Meilisearch sync hooks ─────────────────────────────────────────
// These run asynchronously and never block the main request.

videoSchema.post("save", async function (doc) {
  try {
    // Dynamic import to avoid circular deps and keep the hook lightweight
    const { syncVideoToSearch } = await import("../services/searchSync.js");

    // Populate owner if it's just an ObjectId
    if (doc.owner && !doc.owner.username) {
      await doc.populate({ path: "owner", select: "fullName username avatar" });
    }

    // Only sync published videos
    if (doc.isPublished) {
      await syncVideoToSearch(doc);
    }
  } catch {
    // Never let search sync failures affect the main request
  }
});

videoSchema.post("findOneAndDelete", async function (doc) {
  if (!doc) return;
  try {
    const { removeVideoFromSearch } = await import("../services/searchSync.js");
    await removeVideoFromSearch(doc._id);
  } catch {
    // Silent — search sync is best-effort
  }
});

videoSchema.plugin(mongooseAggregatePaginate);

export const Video = mongoose.model("Video", videoSchema);