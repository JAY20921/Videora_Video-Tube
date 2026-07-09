import mongoose from "mongoose";

const viewEventSchema = new mongoose.Schema(
  {
    videoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Video",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    eventType: {
      type: String,
      enum: ["heartbeat", "seek", "pause", "play"],
      required: true,
    },
    timestamp: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

viewEventSchema.index({ videoId: 1, createdAt: -1 });
viewEventSchema.index({ createdAt: -1 });

export const ViewEvent = mongoose.model("ViewEvent", viewEventSchema);
