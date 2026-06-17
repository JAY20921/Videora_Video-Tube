# Vidora Video Tube — Production Engineering Audit (Part 2)
## System Design Review

---

# 3. System Design Review

## 3.1 High Level Design (HLD)

```mermaid
graph TB
    subgraph "Client Layer"
        Browser[React SPA - Vite]
    end

    subgraph "API Layer"
        LB[Load Balancer / Reverse Proxy]
        API1[Express Server - Node.js]
    end

    subgraph "Data Layer"
        MongoDB[(MongoDB Atlas)]
        Cloudinary[Cloudinary CDN + Storage]
    end

    subgraph "Future - Background Processing"
        Queue[BullMQ / Redis Queue]
        Worker[Worker Process]
    end

    Browser -->|HTTPS + Cookies| LB
    LB --> API1
    API1 -->|Mongoose ODM| MongoDB
    API1 -->|Upload SDK| Cloudinary
    API1 -.->|Enqueue| Queue
    Queue -.->|Dequeue| Worker
    Worker -.->|Process| Cloudinary
    Browser -->|Direct playback URL| Cloudinary
```

**Current state:** The system is a classic 3-tier monolith (Client → API → DB + Storage). This is perfectly appropriate for the current scale and should NOT be changed to microservices.

## 3.2 Low Level Design (LLD)

```mermaid
graph LR
    subgraph "Express Application"
        MW1[CORS] --> MW2[JSON Parser]
        MW2 --> MW3[Cookie Parser]
        MW3 --> MW4[Static Files]
        MW4 --> Router[Route Dispatcher]

        Router --> UR[User Routes]
        Router --> VR[Video Routes]
        Router --> CR[Comment Routes]
        Router --> LR[Like Routes]
        Router --> SR[Subscription Routes]
        Router --> PR[Playlist Routes]
        Router --> TR[Tweet Routes]
        Router --> DR[Dashboard Routes]
        Router --> HR[Healthcheck Routes]

        UR --> AuthMW[verifyJWT Middleware]
        VR --> AuthMW
        AuthMW --> Controllers[Controllers]
        Controllers --> Services["Business Logic (in controllers)"]
        Services --> Models[Mongoose Models]
        Services --> CloudUtil[Cloudinary Utility]
    end
```

## 3.3 Component Breakdown

| Component | Responsibility | Files | Issues |
|-----------|---------------|-------|--------|
| **Auth** | Register, login, logout, token refresh | `user.controller.js`, `auth.middleware.js`, `user.model.js` | Password logged to console, long token expiry |
| **Video CRUD** | Upload, list, search, update, delete | `video.controller.js`, `video.model.js`, `video.routes.js` | No file validation, client-trusted duration |
| **Engagement** | Likes, comments, subscriptions | `like.controller.js`, `comment.controller.js`, `subscription.controller.js` | No indexes, no pagination on some endpoints |
| **Playlists** | CRUD + add/remove videos | `playlist.controller.js`, `playlist.model.js` | `desciption` typo, no pagination |
| **Dashboard** | Channel stats | `dashboard.controller.js` | Expensive aggregation, no caching |
| **Tweets** | Community posts | `tweet.controller.js`, `tweet.model.js` | No pagination |
| **Media** | Upload → Cloudinary pipeline | `multer.middleware.js`, `cloudinary.js` | No type/size limits, folder param unused |

## 3.4 Request Flow Analysis

### Authentication Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Express Server
    participant DB as MongoDB
    
    Note over C,DB: Registration
    C->>S: POST /api/v1/users/register (FormData)
    S->>S: Multer saves avatar/cover to ./public/temp
    S->>DB: Check existing user (email/username)
    S->>S: Upload files to Cloudinary
    S->>S: Delete temp files
    S->>DB: Create user (password auto-hashed via pre-save hook)
    S->>C: 201 + user object (no password/refreshToken)

    Note over C,DB: Login
    C->>S: POST /api/v1/users/login {email, password}
    S->>DB: Find user by email/username
    S->>S: bcrypt.compare(password, hash)
    S->>S: Generate accessToken (1d) + refreshToken (10d)
    S->>DB: Save refreshToken to user document
    S->>C: 200 + Set-Cookie (httpOnly) + JSON body with tokens

    Note over C,DB: Token Refresh
    C->>S: POST /api/v1/users/refresh-token
    S->>S: Extract refreshToken from cookie
    S->>S: jwt.verify(token, REFRESH_TOKEN_SECRET)
    S->>DB: Find user, compare stored refreshToken
    S->>S: Generate new token pair
    S->>DB: Save new refreshToken
    S->>C: 200 + new cookies + new tokens
```

**Issues identified:**
- Access token in BOTH cookie AND response body — the body copy can be stored insecurely by client
- No refresh token rotation validation window
- Access token `1d` expiry is too long

### Upload Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Express Server
    participant Disk as Local Disk
    participant Cloud as Cloudinary

    C->>S: POST /api/v1/videos (FormData: videoFile, thumbnail, title, desc)
    Note over C,S: Axios onUploadProgress tracks %
    S->>Disk: Multer writes to ./public/temp/
    S->>Cloud: cloudinary.uploader.upload(localPath, {resource_type: auto})
    Note over S,Cloud: Synchronous upload - server blocked
    Cloud-->>S: {url, public_id, duration, ...}
    S->>Disk: fs.unlinkSync(localPath) - cleanup
    S->>S: Repeat for thumbnail
    S->>S: Create Video document with URLs
    S-->>C: 201 + video object

    Note over C: Client polls getVideoById for processing status
    Note over C: (Polling is unnecessary - Cloudinary returns ready URL)
```

**Bottlenecks:**
1. **Synchronous upload blocks the event loop** — A 500MB video upload holds the Express worker for minutes
2. **No upload size limit** — Server can be OOM killed
3. **`resource_type: "auto"` accepts any file type** — Security risk
4. **No resumable uploads** — If connection drops at 99%, start over
5. **Duration trusted from client** — Should be extracted from Cloudinary response

### Playback Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Express
    participant Cloud as Cloudinary CDN

    C->>S: GET /api/v1/videos/:id
    S->>S: Video.findById().populate("owner")
    S-->>C: {videoFile: "https://res.cloudinary.com/...", ...}
    C->>Cloud: Direct HTTP request for video stream
    Note over C,Cloud: Progressive download (not adaptive streaming)
    Cloud-->>C: Video bytes (single quality)
```

**Issues:**
- No HLS/DASH adaptive streaming — single quality progressive download
- No CDN optimization beyond Cloudinary's built-in
- View increment is a separate API call (`POST /view/:videoId`) — could be abused

### Search Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Express
    participant DB as MongoDB

    C->>S: GET /api/v1/videos?query=cats
    S->>DB: Video.find({$or: [{title: {$regex: "cats", $options: "i"}}, {description: {$regex: ...}}]})
    Note over DB: FULL COLLECTION SCAN - no text index!
    DB-->>S: Matching documents
    S-->>C: Paginated results
```

**Fix:** Add text index on `title` and `description`, use `$text` operator instead of `$regex`.

### Feed / Recommendation Flow

**Current state:** There is NO recommendation system. `Home.jsx` fetches all videos sorted by `createdAt` descending. Every user sees the same feed.

### Comment / Like / Subscription Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Express
    participant DB as MongoDB

    Note over C,DB: Toggle Like (idempotent toggle pattern)
    C->>S: POST /api/v1/likes/toggle/v/:videoId
    S->>DB: Like.findOne({video: videoId, likedBy: userId})
    Note over DB: No index - collection scan
    alt Like exists
        S->>DB: deleteOne()
        S-->>C: "Video unliked"
    else No like
        S->>DB: Like.create()
        S-->>C: "Video liked"
    end
```

**Issues:** No compound index on `{video, likedBy}` means every like toggle does a full collection scan.

## 3.5 Failure Scenarios and Fallback Behavior

| Scenario | Current Behavior | Correct Behavior |
|----------|-----------------|-------------------|
| MongoDB goes down | `process.exit(1)` on startup. No reconnection during runtime | Mongoose auto-reconnects. Add connection event handlers + health check |
| Cloudinary upload fails | Returns `null`, controller throws 500 | Should retry once, then return user-friendly error |
| Large file fills disk | Server crashes (no disk space) | Set multer `limits.fileSize`, use streaming upload |
| JWT secret missing | `jwt.sign` throws, 500 error | Validate env vars on startup, fail fast |
| Concurrent like toggles | Race condition — double likes possible | Add unique compound index |

## 3.6 Bottleneck Analysis

1. **Database queries without indexes** — Every `Like.findOne`, `Comment.find({video})`, `Video.find({owner})` is O(n)
2. **Synchronous Cloudinary uploads** — Express worker blocked during multi-minute video uploads
3. **Dashboard aggregation** — 3 separate DB queries + 1 aggregation for channel stats, no caching
4. **`$regex` search** — Full collection scan on every search query
5. **Unbounded `watchHistory` array** — Will hit 16MB document limit at ~1M entries
6. **No connection pooling config** — Default Mongoose pool size may not be optimal

## 3.7 Scaling Limits of Current Design

| Metric | Current Limit | Reason |
|--------|--------------|--------|
| Concurrent uploads | ~2-5 | Synchronous Cloudinary upload blocks event loop |
| Search latency | O(n) | `$regex` without text index |
| Like/Comment queries | O(n) | No compound indexes |
| User document size | ~16MB | Unbounded `watchHistory` array |
| API throughput | ~100-500 req/s | Single Node process, no clustering |
| Video delivery | No adaptive bitrate | Single quality progressive download |

## 3.8 Future Scaling Path

```mermaid
graph TD
    A[Current: Single Monolith] --> B[Phase 1: Add Indexes + Caching]
    B --> C[Phase 2: Background Jobs via BullMQ + Redis]
    C --> D[Phase 3: Horizontal Scaling via PM2/Docker]
    D --> E[Phase 4: CDN + HLS Streaming]
    E --> F[Phase 5: Read Replicas + Sharding]
    F --> G[Phase 6: Service Decomposition if needed]
```

**Key principle:** Do NOT split into microservices until you have proven the monolith cannot scale further. For a video platform, the scaling bottleneck is almost always **media delivery** (solved by CDN), not application logic.
