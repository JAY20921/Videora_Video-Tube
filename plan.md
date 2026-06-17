# VIDORA: Master Architecture & Transformation Plan

## 1. Product Vision
**Vidora** is not a passive YouTube clone—it is an **AI-driven contextual learning ecosystem**. It shifts video consumption from mindless watching to active, semantic learning. Users interact with the data inside the video, transforming unstructured media into structured, navigable knowledge.

## 2. Unique Selling Point (USP)
Vidora acts as a personalized learning engine. By combining adaptive HLS streaming, real-time collaboration, and advanced RAG (Retrieval-Augmented Generation) vector search, it understands exactly *what* is being taught inside every frame and allows learners to interact with that content instantly.

---

## 3. Five Stand-Out Features (Portfolio Differentiators)
These features bridge the gap between "standard college project" and "Staff-level engineering":

1. **Semantic Knowledge Graph Explorer**: Vidora extracts concepts (e.g., "Redis", "JWT") from transcripts and builds a global, visual D3.js node-graph. Clicking a node instantly navigates to the exact timestamp across *any* video where that concept is explained.
2. **Contextual AI Tutor Mode (RAG)**: Users can pause a video and ask, *"What did the creator mean at 12:31?"* The AI doesn't just answer; it grounds its answers strictly in the video's transcript and provides clickable timestamps as citations.
3. **Dynamic Skill-Tree Playlists**: A user searches *"I want to learn System Design."* The AI pulls relevant chapters from 10 different creators, sorts them by logical progression, and stitches them together into a personalized, continuous learning path.
4. **Synchronized Collaborative Learning Rooms (Watch Parties)**: Built for study groups. Synced playback via WebSockets, live chat, and a shared live Markdown/Code editor that syncs alongside the video timeline.
5. **Granular Retention Heatmaps for Creators**: Analytics that don't just show views, but a timeline heatmap of where users frequently rewind, pause, or drop off—aggregated using high-throughput background queues.

---

## 4. System Architecture
A modular monolith transitioning into event-driven microservices.
* **Core API**: Node.js/Express monolith handling fast, synchronous requests (Auth, CRUD).
* **Worker Fleet**: Separate Node.js background processes running BullMQ workers for heavy lifting (FFmpeg, AI, Analytics).
* **Storage Layer**: MongoDB (Metadata), Redis (Queues/Cache), Qdrant (Vector DB for AI), Meilisearch (Full-text search), Cloudinary (Raw Media CDN).

## 5. Database Design
* **MongoDB Atlas**: Primary store (Users, Videos, Comments, Likes, Subscriptions, Playlists, WatchHistory).
* **Redis**: Ephemeral state (Rate limiting, Queues, Session Caching, Socket.IO adapters).
* **Qdrant**: Vector storage (Chunked transcript embeddings for RAG).
* **Meilisearch**: High-speed, typo-tolerant reverse-index search engine.

## 6. Microservice Candidates (Future-Proofing)
While starting as a modular monolith, these domains are isolated for independent scaling:
1. **Transcoding Service**: Heavy CPU bound. Candidate for Golang or isolated Node/FFmpeg clusters.
2. **AI Inference Service**: Heavy memory/network bound. Manages rate limits with OpenAI APIs.
3. **Real-time/Socket Service**: High connection concurrency. Easily scaled horizontally with Redis Pub/Sub.
4. **Analytics Ingestion Service**: High write-throughput.

## 7. Distributed Systems: Redis & Queues
* **What goes into Redis**: BullMQ job state, cached API responses (e.g., trending videos), rate-limit counters, WebSocket room state.
* **Cache Invalidation**: Event-driven. When a video is updated, fire an event to delete `cache:video:{id}`.
* **Queue Design (BullMQ)**:
  - `video-processing`: Downloads raw video, runs FFmpeg HLS transcoding, uploads segments.
  - `ai-processing`: Triggers Whisper transcription, chunking, OpenAI embeddings, and Qdrant storage.
  - `analytics-ingestion`: Batches video heartbeat events every minute to reduce MongoDB write load.
* **Worker Responsibilities**: Pure, stateless processing. Pull job → Process → Await DB update → Acknowledge.
* **Failure Recovery**: Exponential backoff retries (e.g., if OpenAI API rate limits). Dead Letter Queues (DLQ) for permanently failed jobs requiring manual intervention.

## 8. Advanced Video Delivery
* **FFmpeg Processing Pipeline**: Raw upload → Queue → Worker → FFmpeg transcodes to multiple resolutions (360p, 480p, 720p).
* **Video Segmentation**: Video is split into 10-second `.ts` chunks with a master `.m3u8` playlist.
* **HLS & Adaptive Bitrate**: Client detects bandwidth and dynamically shifts resolutions mid-stream without buffering.
* **Signed URLs**: Media served via Cloudinary CDN using signed URLs to prevent hotlinking.
* **Playback Resume System**: Client emits heartbeats every 10s via `navigator.sendBeacon()`. MongoDB upserts `WatchHistory`. Next load fetches progress.

## 9. AI Features Integration
* **AI Knowledge Extraction**: 
  - *Trigger*: Post-transcription.
  - *Action*: GPT-4o-mini analyzes transcript, extracting keywords, topics, and learning objectives. Saves to MongoDB `Video` document.
* **AI Chapter Generator**:
  - *Action*: AI identifies topic shifts in the transcript and auto-generates timestamped chapters (e.g., *0:00 Intro, 4:12 Authentication*).
* **AI Tutor Mode**:
  - *Action*: User asks question → Embed question → Qdrant semantic search → Retrieve top 3 transcript chunks → GPT generates answer with timestamp citations.
* **AI Semantic Search**:
  - *Action*: Search "Redis real-world projects" → Qdrant vector search matches videos conceptually, bypassing rigid keyword matching.

## 10. Real-time Features (WebSockets)
* **Architecture**: Socket.IO with Redis Adapter to allow scaling across multiple Node.js instances.
* **Watch Parties**: 
  - Host emits `seek(12:30)` or `pause()`.
  - Server broadcasts to `room:video:{id}`.
  - Clients force-sync their HTML5 video players.
* **Live Features**: Real-time comments streaming into the UI (like Twitch) and live like-counters.

## 11. Search Architecture
* **Engine**: Meilisearch.
* **Pipeline**: Video created/updated → Monolith triggers async sync to Meilisearch index.
* **Features**: Instant keystroke autocomplete, typo tolerance, faceted filtering by tags.

## 12. Analytics Architecture
* **Event Collection Pipeline**: 
  - Video player fires `{ type: 'heartbeat', time: 14.5, userId }` every 5 seconds.
  - API drops event into Redis queue (fire-and-forget for client speed).
* **Worker Aggregation**: Worker aggregates events every 1 minute and bulk-writes to MongoDB `ViewEvents` time-series collection.
* **Creator Dashboard**: Aggregates `ViewEvents` to generate Retention Curves, Heatmaps, Session Lengths, and Subscriber Conversion Rates.

## 13. Recommendation System
Progressive roll-out:
* **Phase 1 (Tag-Based)**: MongoDB lookup for videos with overlapping metadata tags, excluding already watched.
* **Phase 2 (Collaborative Filtering)**: MongoDB Aggregation pipeline: "Users who watched X also watched Y."
* **Phase 3 (Graph/Semantic Engine)**: Qdrant vector search to find videos conceptually similar to the user's aggregated watch history embeddings.

## 14. Scaling Strategy
* **100 Users**: Single monolithic Express server, local MongoDB, raw MP4 delivery.
* **10,000 Users**: Migrate to HLS streaming. Introduce Redis caching for read-heavy routes. Separate Worker process for FFmpeg.
* **100,000 Users**: Docker Swarm/Kubernetes. Multiple API instances behind Nginx/AWS ALB. MongoDB replica sets. Meilisearch handles all search queries.
* **1 Million Users**: Microservices extraction (separate AI and Transcoding clusters). Global CDN edge caching. Event-driven architecture via Kafka/RabbitMQ replacing BullMQ.

## 15. DevOps Strategy
* **Docker**: Multi-stage builds for Frontend (Nginx) and Backend (Node Alpine). Non-root users.
* **Docker Compose**: Orchestrates Node, Redis, Meilisearch locally.
* **CI/CD**: GitHub Actions runs ESLint, tests, `npm audit`, and Docker build verification on every PR to `main`.
* **Health Checks**: Deep ping endpoint validating Mongo and Redis connectivity.
* **Monitoring & Alerting**: Sentry for error tracking, Pino for structured JSON logging.

## 16. Security Design
* **Auth**: Short-lived JWTs (15m) in memory, HTTP-only Secure Refresh tokens (7d).
* **Protection**: Helmet (HSTS, CSP, CORS), express-rate-limit.
* **Validation**: Zod schema parsing on all boundaries to prevent NoSQL injection.
* **DDoS/Abuse Mitigation**: Upload limits (5 per hour), rigid file type/size validation via hardened Multer.

## 17. Resume Impact Analysis
This architecture signals to a FAANG/Startup hiring manager:
* *You understand trade-offs* (Monolith vs. Microservices, Sync vs. Async).
* *You handle background processing & distributed state* (Redis/BullMQ).
* *You know modern AI engineering* (RAG, Vector DBs, not just thin API wrappers).
* *You build for production* (CI/CD, strict security, analytics ingestion).
* *You possess Product vision* (building a unique learning ecosystem, not a tutorial clone).

---

## 18. DETAILED EXECUTION PLAN & ARCHITECTURAL ROADMAP

This section defines the exact High-Level Design (HLD), Low-Level Design (LLD), Tech Stack, and CI/CD steps for every remaining phase. 

**Current State**: Phase 0 (Security & DB Fixes) and Phase 1 (Docker/CI/CD Infrastructure) are **COMPLETE**.

---

### Phase 2: Watch History & Progress Systems
*The foundation for personalized analytics and recommendations.*

* **Tech Stack**: React, Express.js, MongoDB, `navigator.sendBeacon`
* **HLD**: The client player emits heartbeat events capturing the user's current video timestamp. The API upserts this into the `WatchHistory` collection. The home feed queries this collection to build the "Continue Watching" UI.
* **LLD**:
  - **Frontend**: A `useVideoProgress` custom hook attaches to the `<video>` element. It debounces `timeupdate` events (every 10s) and uses the browser's `navigator.sendBeacon` on `beforeunload` to ensure the final timestamp is saved even if the user closes the tab abruptly.
  - **Backend**: `POST /api/v1/watch-progress`. Uses MongoDB `$upsert` against a compound unique index `({ user: 1, video: 1 })` to prevent duplicates.
* **DevOps/CI**: Standard unit tests added for the heartbeat endpoints in GitHub Actions.

---

### Phase 3: Video Processing Pipeline (Distributed Systems)
*Moving from raw MP4s to Adaptive Bitrate Streaming (HLS) off the main thread.*

* **Tech Stack**: Redis, BullMQ, Node.js Worker Process, FFmpeg, Cloudinary, `hls.js`.
* **HLD**: The monolith API no longer waits for video processing. It saves the raw file, creates a `Video` document marked `status: "processing"`, and pushes a job to a Redis queue. A separate Worker Process picks up the job, runs FFmpeg to segment the video into `.ts` chunks and `.m3u8` playlists, uploads them to Cloudinary, and updates the database.
* **LLD**:
  - **Queueing**: BullMQ queue named `video-jobs`.
  - **Worker**: Spawns a child process for FFmpeg. Transcodes into 3 streams: `360p` (800k bitrate), `480p` (1400k), and `720p` (2800k).
  - **Frontend**: Detects `.m3u8` extension. Instantiates `hls.js`, attaches it to the video reference, and mounts a quality-selector UI (Auto, 720p, 480p).
* **DevOps/CI**: 
  - Add `worker` service to `docker-compose.yml`.
  - Dockerfile updated to install `ffmpeg` OS packages.

---

### Phase 4: Fast Search Engine
*Replacing slow MongoDB regex scans with an instant, typo-tolerant reverse-index.*

* **Tech Stack**: Meilisearch, Mongoose Hooks.
* **HLD**: MongoDB acts as the source of truth, but Meilisearch acts as the read-optimized search layer. The frontend hits the Meilisearch API for instant autocomplete results as the user types.
* **LLD**:
  - **Synchronization**: Mongoose `post('save')` and `post('findOneAndDelete')` hooks trigger an async function that mirrors the changes to the Meilisearch `videos` index.
  - **Indexing**: Documents are indexed with fields: `title`, `description`, `tags`, `ownerName`. Meilisearch is configured to allow 1 typo per 5 characters.
* **DevOps/CI**:
  - Add Meilisearch container to `docker-compose.yml`.
  - CI pipeline spins up ephemeral Meilisearch instance to run search integration tests.

---

### Phase 5: The AI Layer (RAG & NLP)
*The crown jewel. Transforming video into queryable semantic knowledge.*

* **Tech Stack**: BullMQ, OpenAI API (Whisper, GPT-4o-mini, text-embedding-3-small), Qdrant (Vector DB), D3.js.
* **HLD**: When a video processing job completes, a chained `ai-job` is triggered. It generates a transcript, chunks it, embeds it, and stores it in Qdrant. The user interacts via a Chat UI, which performs a vector search against Qdrant to pull relevant transcript context before passing it to GPT.
* **LLD**:
  - **Transcription**: Send raw audio to OpenAI Whisper. Receive WebVTT and raw JSON.
  - **Chunking Strategy**: Split transcript into ~200-word chunks with a 50-word overlap to preserve context.
  - **RAG Prompt**: *"You are an AI Tutor. Answer the user's question using ONLY the provided transcript chunks. Cite the start timestamp."*
  - **Knowledge Graph**: Prompt GPT to extract `(Node A) -> [Relationship] -> (Node B)`. Render on frontend using `d3-force`.
* **DevOps/CI**:
  - Provision Qdrant cloud cluster (free tier).
  - Mock OpenAI responses in CI to prevent API charges during automated testing.

---

### Phase 6: Real-Time & Collaboration
*Adding live engagement through WebSockets.*

* **Tech Stack**: Socket.IO, Redis Pub/Sub Adapter.
* **HLD**: Users viewing the same video connect to a shared WebSocket namespace. Actions by a "Host" in a Watch Party are broadcasted to all connected clients, forcing their local video players to sync.
* **LLD**:
  - **Scaling**: Using `@socket.io/redis-adapter` so that if we scale to 5 Node.js API servers, a message sent on Server A successfully reaches a client connected to Server B.
  - **Watch Parties**: Concept of "Rooms". Host emits `sync_seek(12:45)`. Server broadcasts to room. Client receives event and calls `videoRef.current.currentTime = 12.45`.
  - **Live Chat**: Ephemeral chat arrays maintained in Redis, flushed to MongoDB periodically.
* **DevOps/CI**:
  - Nginx configuration updated to support `Upgrade: websocket` headers.

---

### Phase 7: Analytics & Recommendations
*Closing the loop with creator insights and automated discovery.*

* **Tech Stack**: BullMQ (Buffering), MongoDB (Time-Series / Aggregation), Recharts (Frontend).
* **HLD**: High-frequency telemetry data (views, watch time, drop-offs) would crash MongoDB if written synchronously. We buffer these events in Redis queues and process them in bulk.
* **LLD**:
  - **Ingestion**: `POST /analytics/event`. API immediately returns `202 Accepted` and pushes to BullMQ.
  - **Aggregation**: A cron-style worker runs every 1 minute, pulling all events and executing bulk `updateMany` operations into a time-series MongoDB collection.
  - **Recommendations**: Aggregation pipeline `$graphLookup` for collaborative filtering (Users who watched X watched Y). Fallback to Qdrant semantic search if no user history exists.
  - **Frontend**: Render interactive line charts and heatmaps using `Recharts`.
* **DevOps/CI**:
  - Add load-testing to the CI pipeline (e.g., using Artillery) to verify the ingestion endpoint can handle 5,000 req/sec without spiking API response times.
