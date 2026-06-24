# Vidora Video Tube — Production Engineering Audit (Part 1)
## Executive Summary & Gap Analysis

---

# 1. Executive Summary

## Production Readiness Score: 3.5 / 10

The application has a solid feature set and clean architectural patterns (MVC separation, custom error/response wrappers, async handlers). However, it has **critical security vulnerabilities**, zero testing, no CI/CD, no observability, missing input validation, no graceful shutdown, and secrets committed to version control.

## 🚨 Top 5 Risks

| # | Risk | Severity | Current State |
|---|------|----------|---------------|
| 1 | **Secrets in `.env` committed to Git** — MongoDB credentials, JWT secrets, Cloudinary keys are all in plaintext in the repo | CRITICAL | `.env` is tracked; passwords and API keys are exposed |
| 2 | **No input validation/sanitization** — All controllers trust `req.body` directly. NoSQL injection is trivially possible via `$gt`, `$regex` operators in login fields | CRITICAL | Zero use of `joi`, `zod`, or `express-validator` |
| 3 | **No rate limiting** — Login, register, upload endpoints have zero throttling. Brute-force attacks and API abuse are trivial | HIGH | No `express-rate-limit` or equivalent |
| 4 | **No file upload restrictions** — Multer accepts any file type, any size. An attacker can upload 10GB files or executable scripts | HIGH | No `fileFilter`, no `limits` in multer config |
| 5 | **Duplicate route registration** — `app.js` line 50 and line 61 both mount `userRouter` on `/api/v1/users`, causing unpredictable behavior | MEDIUM | Duplicate `app.use("/api/v1/users", userRouter)` |

## ✅ Top 5 Highest-Impact Upgrades

| # | Upgrade | Effort | Impact |
|---|---------|--------|--------|
| 1 | Add input validation with `zod` across all controllers | 1-2 days | Eliminates NoSQL injection, XSS, bad data |
| 2 | Add `helmet`, rate limiting, cookie security flags (`sameSite`, `secure`, `maxAge`) | 2-4 hours | Closes top OWASP vulnerabilities |
| 3 | Dockerize both services + add GitHub Actions CI | 1-2 days | Reproducible builds, automated testing |
| 4 | Add database indexes on hot query paths | 1-2 hours | 10-100x query performance improvement |
| 5 | Add structured logging with `pino` | 3-4 hours | Debuggability, incident response capability |

## 💪 What Is Already Strong

- **Clean MVC architecture** — Models, controllers, routes, middlewares, and utils are well-separated
- **Custom `ApiError`/`ApiResponse`/`asyncHandler` pattern** — Consistent error handling foundation
- **JWT access + refresh token rotation** — Correct dual-token architecture with DB-stored refresh tokens
- **Aggregate pipelines** — Channel profile stats use proper MongoDB aggregation with `$lookup`
- **Video player** — HLS.js integration with fallback, PiP support, playback rate control
- **Upload UX** — Progress tracking, abort controller, polling for processing status
- **Pagination** — `mongoose-aggregate-paginate-v2` is correctly used for comments
- **Owner-only authorization** — Update/delete operations correctly check `video.owner === req.user._id`

---

# 2. Gap Analysis by Category

## 2.1 Architecture

**What's good:** Clean MVC separation. ES Modules. Modular route files.

**What's missing:**
- No global error-handling middleware (Express catches `next(error)` but you have no `app.use((err, req, res, next) => ...)`)
- Duplicate route mounting (`app.js` lines 50 and 61 both mount `userRouter`)
- No service layer — business logic lives directly in controllers, making testing harder
- No configuration module — `process.env` accessed scattered across files

**How to fix:**
```javascript
// src/middlewares/errorHandler.middleware.js
export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  
  // Don't leak stack traces in production
  const response = {
    success: false,
    statusCode,
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  };

  res.status(statusCode).json(response);
};
```

```javascript
// src/config/index.js — Centralized config
import dotenv from "dotenv";
dotenv.config();

export const config = Object.freeze({
  port: parseInt(process.env.PORT, 10) || 8000,
  mongoUri: process.env.MONGODB_URI,
  dbName: process.env.DB_NAME || "vidora",
  jwt: {
    accessSecret: process.env.ACCESS_TOKEN_SECRET,
    refreshSecret: process.env.REFRESH_TOKEN_SECRET,
    accessExpiry: process.env.ACCESS_TOKEN_EXPIRY || "1d",
    refreshExpiry: process.env.REFRESH_TOKEN_EXPIRY || "10d",
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
  corsOrigin: process.env.CORS_ORIGIN || "",
  nodeEnv: process.env.NODE_ENV || "development",
});
```

**Keep as-is:** The route/controller/model file naming convention is clean and should stay.

---

## 2.2 Security

**What's missing (CRITICAL):**

| Vulnerability | Location | Fix |
|--------------|----------|-----|
| Secrets in Git | `.env` committed to repo | Add `.env` to `.gitignore`, rotate ALL secrets immediately |
| No `helmet` middleware | `app.js` | `app.use(helmet())` — sets security headers |
| No rate limiting | All routes | `express-rate-limit` on auth and upload routes |
| No input sanitization | All controllers | `mongo-sanitize` or `zod` validation |
| Cookie missing `sameSite` | `user.controller.js` L150 | Add `sameSite: "strict"`, `maxAge` |
| No CSRF protection | Cookies used for auth | `sameSite: "strict"` is the minimum |
| `console.log` of passwords | `user.controller.js` L32 | Remove `console.log` of user credentials |
| No file type validation | `multer.middleware.js` | Add `fileFilter` to restrict to video/image MIME types |
| No file size limits | `multer.middleware.js` | Add `limits: { fileSize: 100 * 1024 * 1024 }` |

**Immediate fix for cookies:**
```javascript
const options = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: 24 * 60 * 60 * 1000, // 1 day for access token
};
```

---

## 2.3 Authentication / Session Management

**What's good:** Dual JWT token pattern with refresh rotation. Refresh token stored in DB for invalidation. `bcrypt` with salt rounds of 10.

**What's missing:**
- `generateAccessToken` and `generateRefreshToken` methods accept an unused `password` parameter (code smell, not a vulnerability)
- No token blacklisting on logout (refresh token is `$unset`, which is correct, but access token remains valid until expiry)
- No max login attempts / account lockout
- `refreshAccessToken` has missing status code in `ApiError` calls (lines 202, 206)
- Access token expiry of `1d` is too long — industry standard is 15-30 minutes

**How to fix:**
```javascript
// Fix: user.model.js — remove unused password parameter
userSchema.methods.generateAccessToken = function () { ... }
userSchema.methods.generateRefreshToken = function () { ... }

// Fix: Shorten access token to 15 minutes
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d
```

---

## 2.4 File Upload and Media Handling

**What's good:** Multer → local temp → Cloudinary → cleanup pattern is correct. Error path also cleans up temp files.

**What's missing:**
- No file type validation (accepts `.exe`, `.sh`, `.php`)
- No file size limits (server can be crashed with large uploads)
- No virus/malware scanning
- Old Cloudinary assets not deleted when avatar/cover image is updated (storage leak)
- `folder` parameter passed to `uploadOnCloudinary` but never used in the Cloudinary upload call
- Video duration is sent from the client and trusted — should be extracted server-side

**How to fix — Multer hardening:**
```javascript
// src/middlewares/multer.middleware.js
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const fileFilter = (req, file, cb) => {
  const allowed = [...ALLOWED_VIDEO_TYPES, ...ALLOWED_IMAGE_TYPES];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, `File type ${file.mimetype} not allowed`), false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max
    files: 2,
  },
});
```

**Fix Cloudinary folder parameter:**
```javascript
const response = await cloudinary.uploader.upload(localFilePath, {
  resource_type: "auto",
  folder: folder || "vidora", // Actually use the folder param
});
```

---

## 2.5 Database Design and Indexing

**What's good:** Schema design is appropriate for a video platform. `watchHistory` as an array of ObjectId refs is simple and effective at small scale.

**What's missing:**
- **Zero compound indexes** — The `Like` model has no indexes. Querying `{ video: videoId, likedBy: userId }` does a full collection scan
- **`watchHistory` unbounded array** — Will grow infinitely, eventually exceeding MongoDB's 16MB document limit
- **Playlist `desciption` typo** — Field is misspelled as `desciption` everywhere
- **No index on `videos.owner`** — `getChannelVideos` and `getAllVideos` with `userId` filter do collection scans
- **No index on `comments.video`** — `getVideoComments` aggregation does collection scan
- **No index on `subscriptions` compound key** — `{subscriber, channel}` needs a unique compound index

**Critical indexes to add:**
```javascript
// video.model.js
videoSchema.index({ owner: 1, createdAt: -1 });
videoSchema.index({ title: "text", description: "text" }); // For search
videoSchema.index({ isPublished: 1, createdAt: -1 });

// like.model.js
likeSchema.index({ video: 1, likedBy: 1 }, { unique: true, sparse: true });
likeSchema.index({ comment: 1, likedBy: 1 }, { unique: true, sparse: true });
likeSchema.index({ tweet: 1, likedBy: 1 }, { unique: true, sparse: true });

// comment.model.js
commentSchema.index({ video: 1, createdAt: -1 });

// subscription.model.js
subscriptionSchema.index({ subscriber: 1, channel: 1 }, { unique: true });
subscriptionSchema.index({ channel: 1 }); // For subscriber count
```

---

## 2.6 API Design and Validation

**What's good:** Consistent `ApiResponse` wrapper. Proper HTTP status codes (201 for creation, 200 for updates). ObjectId validation before DB queries.

**What's missing:**
- Zero request body validation — No schema validation library
- `getAllVideos` accepts `sortBy` directly from user input into MongoDB sort — potential injection vector
- `updateVideo` accepts `req.files?.thumbnail?.[0]?.path` but route mounts `upload.single("thumbnail")` — mismatch between `req.files` and `req.file`
- No pagination on `getLikedVideos`, `getChannelVideos`, `getUserTweets`, `getUserPlaylists`
- API versioning is correct (`/api/v1/`) — keep this
- `view/:videoId` route is unauthenticated but calls `incrementVideoView` which tries `req.user?._id` — this silently works but the auth middleware never runs

**How to fix — Add Zod validation middleware:**
```javascript
// src/middlewares/validate.middleware.js
import { z } from "zod";

export const validate = (schema) => (req, res, next) => {
  try {
    schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    next();
  } catch (err) {
    const messages = err.errors.map((e) => e.message).join(", ");
    next(new ApiError(400, messages));
  }
};

// Usage in routes:
import { z } from "zod";
const loginSchema = z.object({
  body: z.object({
    email: z.string().email().optional(),
    username: z.string().min(3).optional(),
    password: z.string().min(6),
  }).refine(data => data.email || data.username, {
    message: "Email or username required"
  }),
});
router.route("/login").post(validate(loginSchema), loginUser);
```

---

## 2.7 Error Handling and Logging

**What's good:** `asyncHandler` correctly forwards errors to Express error chain. `ApiError` captures stack traces.

**What's missing:**
- **No global error handler middleware** — Errors forwarded by `asyncHandler` via `next(error)` go to Express default handler (HTML error page in dev, empty in prod)
- **`console.log` everywhere** — No structured logging. Credentials logged to console (line 32 of `user.controller.js`)
- **No request ID tracking** — No way to correlate logs across a request lifecycle
- **Swallowed errors** — `incrementVideoView` catches and ignores watch history errors silently

**How to fix:** Add `pino` (free, open-source, fastest Node.js logger):
```javascript
// src/utils/logger.js
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: process.env.NODE_ENV === "development"
    ? { target: "pino-pretty" }
    : undefined,
  redact: ["req.headers.authorization", "req.headers.cookie"],
});
```

---

## 2.8 Frontend Architecture

**What's good:** React Router v7, Framer Motion animations, Tailwind CSS, component separation.

**What's missing:**
- **Unused dependencies** — `three`, `video.js`, `react-player`, `cors`, `env` are in `package.json` but appear unused
- **No lazy loading / code splitting** — All pages imported eagerly in `App.jsx`
- **No error boundaries** — A crash in any component takes down the entire app
- **`console.log` in production code** — Multiple debug logs scattered across components
- **`styled jsx` in PlayerWrapper** — Doesn't work in plain React/Vite (it's a Next.js feature)
- **No SEO** — No `<title>`, `<meta>` tags, or `react-helmet`

**How to fix — Lazy loading:**
```javascript
// App.jsx
const Home = React.lazy(() => import("./pages/Home"));
const VideoPage = React.lazy(() => import("./pages/VideoPage"));
// ... wrap routes in <Suspense fallback={<Loading />}>
```

---

## 2.9 State Management

**What's good:** `AuthContext` is appropriate for auth state. Not over-engineered.

**What's missing:**
- No caching of API responses — Every navigation refetches data
- No optimistic updates for likes/subscriptions
- `Home.jsx` refetches all videos when `user` changes (including `null` → loaded), causing double fetch on mount

**Keep as-is:** Context API is the right choice at this scale. Do NOT add Redux/Zustand yet.

---

## 2.10 Testing

**Current state:** ZERO tests. No test framework installed. No test scripts in `package.json`.

**How to fix:**
```bash
# Backend
npm i -D vitest supertest @faker-js/faker mongodb-memory-server

# Frontend  
npm i -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

Priority test targets:
1. Auth flow (register → login → refresh → logout)
2. Video CRUD (create, read, update, delete)
3. Authorization checks (only owner can delete)
4. Input validation (malformed data rejected)

---

## 2.11 CI/CD

**Current state:** None. No GitHub Actions, no automated checks.

**How to fix:**
```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: cd Vidora-backend && npm ci && npm test
      - run: cd vidora-frontend && npm ci && npm run lint && npm run build
```

---

## 2.12 Observability

**Current state:** Zero observability. No structured logs, no metrics, no tracing, no health check beyond basic `{ status: "ok" }`.

**How to fix (all free):**
- **Logging:** `pino` + `pino-pretty` (open-source)
- **Uptime monitoring:** UptimeRobot free tier (50 monitors)
- **Error tracking:** Sentry free tier (5K events/month)
- **Health check:** Enhance to check MongoDB connection status

---

## 2.13 Performance and Caching

**What's missing:**
- No HTTP caching headers (`Cache-Control`, `ETag`)
- No response compression (`compression` middleware)
- No database query caching
- `getChannelStats` runs 3 separate aggregations — can be combined
- `$regex` search without text index is O(n)
- Frontend doesn't cache API responses

**Quick wins:**
```javascript
import compression from "compression";
app.use(compression()); // Gzip responses — free 60-80% bandwidth savings
```

---

## 2.14 Documentation and Developer Experience

**Current state:** README files are placeholder text. No API documentation. No setup guide.

**How to fix:**
- Add Swagger/OpenAPI docs with `swagger-jsdoc` + `swagger-ui-express` (free)
- Write proper README with setup instructions, env var table, architecture diagram
- Add `.env.example` (without real values)

---

## 2.15 Deployment and Release Process

**What's good:** `vercel.json` configured for frontend SPA routing.

**What's missing:**
- No Dockerfile for backend
- No staging environment
- No rollback strategy
- No health checks for deployment readiness
- No graceful shutdown handling
- Backend deployment strategy unclear

**How to fix — Graceful shutdown:**
```javascript
// src/index.js
const server = app.listen(PORT, "0.0.0.0", () => { ... });

const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    await mongoose.connection.close();
    logger.info("Server closed");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000); // Force kill after 10s
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
```
