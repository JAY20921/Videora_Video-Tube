/**
 * Phase 4: Search synchronization service.
 *
 * Keeps the Meilisearch `videos` index in sync with MongoDB.
 * Called from Mongoose hooks and the bulk sync script.
 */
import { getVideosIndex } from "../config/meilisearch.js";
import { logger } from "../utils/logger.js";

/**
 * Transform a Mongoose video document into a Meilisearch-compatible object.
 */
function toSearchDoc(video) {
  const owner = video.owner || {};
  return {
    id: String(video._id),
    title: video.title || "",
    description: video.description || "",
    thumbnail: video.thumbnail || "",
    duration: video.duration || 0,
    views: video.views || 0,
    ownerName: owner.fullName || owner.username || "",
    ownerUsername: owner.username || "",
    ownerAvatar: owner.avatar || "",
    ownerId: String(owner._id || video.owner),
    createdAt: video.createdAt ? new Date(video.createdAt).getTime() : Date.now(),
  };
}

/**
 * Upsert a single video to the search index.
 * Safe to call even if Meilisearch is down — logs a warning and returns.
 */
export async function syncVideoToSearch(video) {
  try {
    const index = await getVideosIndex();
    if (!index) return;

    const doc = toSearchDoc(video);
    await index.addDocuments([doc]);
    logger.debug({ videoId: doc.id }, "Video synced to Meilisearch");
  } catch (err) {
    logger.warn({ err: err.message, videoId: String(video._id) }, "Failed to sync video to Meilisearch");
  }
}

/**
 * Remove a video from the search index.
 */
export async function removeVideoFromSearch(videoId) {
  try {
    const index = await getVideosIndex();
    if (!index) return;

    await index.deleteDocument(String(videoId));
    logger.debug({ videoId }, "Video removed from Meilisearch");
  } catch (err) {
    logger.warn({ err: err.message, videoId }, "Failed to remove video from Meilisearch");
  }
}

/**
 * Bulk sync all videos from MongoDB to Meilisearch.
 * Used for initial migration and re-indexing.
 *
 * @param {import('mongoose').Model} VideoModel — the Video Mongoose model
 */
export async function bulkSyncVideos(VideoModel) {
  const index = await getVideosIndex();
  if (!index) {
    logger.error("Meilisearch not available — cannot bulk sync");
    return { synced: 0 };
  }

  const videos = await VideoModel.find({ isPublished: true })
    .populate({ path: "owner", select: "fullName username avatar" })
    .lean();

  if (videos.length === 0) {
    logger.info("No videos to sync");
    return { synced: 0 };
  }

  const docs = videos.map(toSearchDoc);

  // Meilisearch handles batching internally — safe to send all at once for <100K docs
  const task = await index.addDocuments(docs);
  logger.info({ count: docs.length, taskUid: task.taskUid }, "Bulk sync initiated");

  return { synced: docs.length, taskUid: task.taskUid };
}
