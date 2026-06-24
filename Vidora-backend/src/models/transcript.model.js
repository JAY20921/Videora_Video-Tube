import mongoose, { Schema } from "mongoose";

/**
 * Phase 5: Transcript model.
 *
 * Stores the AI-generated transcript, chunked segments, embeddings metadata,
 * extracted knowledge graph concepts, and auto-generated chapters.
 * One-to-one relationship with Video.
 */
const transcriptSchema = new Schema(
  {
    video: {
      type: Schema.Types.ObjectId,
      ref: "Video",
      required: true,
      unique: true, // one transcript per video
    },
    language: {
      type: String,
      default: "en",
    },
    /** Complete transcript text (for display in the UI) */
    fullText: {
      type: String,
      default: "",
    },
    /** Timestamped segments from Whisper */
    segments: [
      {
        start: { type: Number, required: true },  // seconds
        end: { type: Number, required: true },
        text: { type: String, required: true },
      },
    ],
    /** ~200-word chunks with overlap, mapped to Qdrant vectors */
    chunks: [
      {
        index: { type: Number, required: true },
        text: { type: String, required: true },
        startTime: { type: Number, required: true },
        endTime: { type: Number, required: true },
        qdrantPointId: { type: String, default: "" }, // UUID of the Qdrant vector point
      },
    ],
    /** Extracted knowledge graph concepts */
    concepts: [
      {
        name: { type: String, required: true },
        related: [
          {
            name: { type: String, required: true },
            relationship: { type: String, required: true },
          },
        ],
      },
    ],
    /** AI-generated chapter markers */
    chapters: [
      {
        title: { type: String, required: true },
        startTime: { type: Number, required: true }, // seconds
      },
    ],
    /** Processing pipeline status */
    status: {
      type: String,
      enum: ["pending", "transcribing", "chunking", "embedding", "extracting", "ready", "failed"],
      default: "pending",
    },
  },
  { timestamps: true }
);

export const Transcript = mongoose.model("Transcript", transcriptSchema);
