import mongoose, { Schema } from "mongoose";

const subscriptionSchema = new Schema(
  {
    subscriber: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    channel: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Unique: a user can only subscribe to a channel once
subscriptionSchema.index({ subscriber: 1, channel: 1 }, { unique: true });

// Fast lookup: all subscribers for a given channel
subscriptionSchema.index({ channel: 1 });

export const Subscription = mongoose.model("Subscription", subscriptionSchema);