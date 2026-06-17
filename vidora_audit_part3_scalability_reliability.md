# Vidora Video Tube — Production Engineering Audit (Part 3)
## Scalability Engineering & Reliability/SRE Review

---

# 4. Scalability Engineering

## Stage 1: 100 DAU

| Area | Strategy | Notes |
|------|----------|-------|
| **Database** | MongoDB Atlas M0 free tier (512MB). Add compound indexes | Sufficient for ~10K documents |
| **Backend** | Single Node.js process on Render/Railway free tier | Handles ~50 concurrent requests |
| **Caching** | None needed. HTTP `Cache-Control` headers on static assets | Browser cache is sufficient |
| **Search** | MongoDB `$text` index on `title` + `description` | Replace `$regex` with `$text` search |
| **Media** | Cloudinary free tier (25GB storage, 25GB bandwidth/month) | Sufficient for ~250 videos at 100MB avg |
| **Upload** | Current synchronous flow is acceptable | Keep as-is |
| **Queues** | Not needed | Overkill at this scale |
| **Cost** | $0/month | All free tiers |

**Introduce at this stage:** Database indexes, input validation, security headers, `.env.example`

**Do NOT introduce:** Redis, CDN, queues, microservices, Kubernetes

---

## Stage 2: 10,000 DAU

| Area | Strategy | Notes |
|------|----------|-------|
| **Database** | MongoDB Atlas M10 ($57/mo) or self-hosted. Read preference: `secondaryPreferred` | ~500K documents, need proper indexing |
| **Backend** | PM2 cluster mode (4 workers) on single VPS ($5-10/mo DigitalOcean) | Handles ~500 concurrent requests |
| **Caching** | ✅ Introduce Redis for session cache + hot video metadata | Redis Cloud free tier (30MB) or local |
| **Search** | MongoDB Atlas Search (free on M10+) or Meilisearch | `$text` becomes slow at 50K+ videos |
| **Media** | Cloudinary paid plan ($89/mo) + Cloudinary auto-format/quality | ~5K videos, need cost management |
| **Upload** | ✅ Move to background processing with BullMQ + Redis | Unblock Express workers |
| **Queues** | ✅ BullMQ for video processing jobs | Redis-backed, open-source |
| **Cost** | $50-150/month | VPS + DB + media storage |

**Introduce at this stage:** Redis, BullMQ background jobs, PM2 clustering, proper monitoring (UptimeRobot + Sentry)

---

## Stage 3: 100,000 DAU

| Area | Strategy | Notes |
|------|----------|-------|
| **Database** | MongoDB Atlas M30 or self-hosted replica set. Sharding for `videos` and `likes` collections | ~5M documents |
| **Backend** | Docker containers on 2-3 VPS nodes behind Nginx load balancer | Horizontal scaling |
| **Caching** | Redis cluster with cache-aside pattern for video metadata, channel stats | 1-2GB Redis |
| **Search** | ✅ Meilisearch or Elasticsearch (self-hosted, open-source) | MongoDB text search too slow |
| **Media** | ✅ CDN (Cloudflare free tier) in front of Cloudinary | Edge caching for video delivery |
| **Upload** | Chunked/resumable uploads via `tus` protocol | Large file reliability |
| **Queues** | BullMQ with dedicated worker processes | Separate from API processes |
| **Cost** | $300-800/month | Multi-server infrastructure |

**Introduce at this stage:** CDN, dedicated search engine, Docker orchestration, chunked uploads, HLS streaming

---

## Stage 4: 1,000,000 DAU

| Area | Strategy | Notes |
|------|----------|-------|
| **Database** | Sharded MongoDB cluster. Separate read replicas. Consider TimescaleDB for analytics | ~50M+ documents |
| **Backend** | Kubernetes cluster or managed container service | Auto-scaling based on CPU/memory |
| **Caching** | Redis Cluster (multi-node). CDN edge caching for API responses | Multi-GB Redis |
| **Search** | Elasticsearch cluster with dedicated indexing pipeline | Real-time search across millions |
| **Media** | Multi-CDN strategy (Cloudflare + BunnyCDN). HLS adaptive bitrate | Global edge delivery |
| **Upload** | Dedicated upload service with S3-compatible storage (MinIO/Backblaze B2) | Separate from API |
| **Queues** | ✅ Consider Kafka for event streaming (view events, analytics) | High-throughput event pipeline |
| **Cost** | $2,000-10,000/month | Production infrastructure |

**Introduce at this stage:** Microservices (if needed), Kafka, multi-CDN, auto-scaling, dedicated analytics pipeline

## When to Introduce Key Technologies

| Technology | When | Why |
|-----------|------|-----|
| **Redis** | 5,000+ DAU | Session caching, rate limiting, BullMQ backing store |
| **CDN** | 50,000+ DAU | Video delivery bandwidth costs become significant |
| **Queue system (BullMQ)** | 1,000+ uploads/day | Synchronous uploads block Express workers |
| **Background workers** | Same as queues | Process video transcoding, send notifications |
| **Separate search engine** | 50,000+ videos | MongoDB text search degrades at scale |
| **Microservices** | 500,000+ DAU | Only if monolith is proven bottleneck (rare) |
| **Object storage change** | 10,000+ videos | Cloudinary costs grow; move to Backblaze B2 + CDN |

---

# 5. Reliability and SRE Review

## 5.1 Health Checks

**Current state:** Basic `GET /api/v1/healthcheck` returns `{ status: "ok" }` without checking any dependencies.

**Required enhancement:**
```javascript
// src/controllers/healthcheck.controller.js
const healthcheck = asyncHandler(async (req, res) => {
  const checks = {};

  // Database connectivity
  try {
    await mongoose.connection.db.admin().ping();
    checks.database = { status: "ok", latencyMs: 0 };
  } catch (e) {
    checks.database = { status: "error", message: e.message };
  }

  // Cloudinary connectivity
  try {
    const start = Date.now();
    await cloudinary.api.ping();
    checks.cloudinary = { status: "ok", latencyMs: Date.now() - start };
  } catch (e) {
    checks.cloudinary = { status: "degraded", message: e.message };
  }

  const allHealthy = Object.values(checks).every(c => c.status === "ok");

  return res.status(allHealthy ? 200 : 503).json(
    new ApiResponse(allHealthy ? 200 : 503, {
      status: allHealthy ? "healthy" : "degraded",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      checks,
    })
  );
});
```

**Readiness probe:** `GET /api/v1/healthcheck` — returns 200 only when DB is connected
**Liveness probe:** `GET /api/v1/healthcheck/live` — returns 200 if process is alive (simple)

## 5.2 Graceful Shutdown

**Current state:** None. `process.exit(1)` in DB connection failure. No SIGTERM handler. Active requests are killed on deploy.

**Required fix** (already shown in Part 1, section 2.15)

## 5.3 Retry Strategy

| Operation | Current | Required |
|-----------|---------|----------|
| Cloudinary upload | No retry, returns null | Retry once with exponential backoff |
| MongoDB query | No retry | Mongoose handles reconnection automatically |
| JWT verification | No retry | Not applicable (deterministic) |

## 5.4 Timeout Strategy

```javascript
// Add to axiosInstance.js (frontend)
const instance = axios.create({
  baseURL: ...,
  timeout: 30000, // 30s for normal requests
  withCredentials: true,
});

// For uploads, use a longer timeout
export const uploadVideo = async (formData, onProgress, opts) => {
  return axios.post("/videos", formData, {
    timeout: 300000, // 5 minutes for uploads
    ...opts,
  });
};
```

## 5.5 Rate Limiting

```javascript
// src/middlewares/rateLimiter.middleware.js
import rateLimit from "express-rate-limit";

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: { success: false, message: "Too many attempts. Try again later." },
  standardHeaders: true,
});

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 uploads per hour
});

// Usage in routes:
router.route("/login").post(authLimiter, loginUser);
router.route("/register").post(authLimiter, upload.fields(...), registerUser);
```

## 5.6 Backup Strategy

- **MongoDB Atlas:** Enable automatic daily backups (free on M10+). For M0 free tier, use `mongodump` via cron
- **Cloudinary:** No backup needed — Cloudinary is the canonical storage. Store `public_id` in DB for recovery
- **Code:** Git is the backup. Ensure all branches are pushed

## 5.7 SLA / SLO / Error Budgets

| Metric | SLO | Measurement |
|--------|-----|-------------|
| Availability | 99.5% (allows ~3.6 hrs/month downtime) | UptimeRobot |
| API latency (p95) | < 500ms for reads, < 5s for uploads | Application logs |
| Error rate | < 1% of requests return 5xx | Log analysis |
| Upload success rate | > 95% | Upload endpoint metrics |

**Error budget:** 0.5% downtime = ~3.6 hours/month. If budget is spent, freeze deployments and focus on reliability.

## 5.8 Production Outage Runbook

```
INCIDENT RESPONSE CHECKLIST:
1. Acknowledge: Note time, check monitoring dashboard
2. Assess: Is it full outage or partial? Which service?
3. Communicate: Update status page (if applicable)
4. Diagnose:
   a. Check health endpoint: GET /api/v1/healthcheck
   b. Check server logs: docker logs vidora-backend --tail 100
   c. Check MongoDB Atlas status: cloud.mongodb.com
   d. Check Cloudinary status: status.cloudinary.com
   e. Check hosting provider status
5. Mitigate:
   a. DB down → Check Atlas, verify connection string
   b. Server crash → Restart: pm2 restart all
   c. Bad deploy → Rollback: git revert + redeploy
   d. High CPU → Check for infinite loops, restart
6. Resolve: Fix root cause, deploy fix
7. Post-mortem: Document what happened, add monitoring
```

## 5.9 Solo Developer Operations Checklist

| Frequency | Task |
|-----------|------|
| **Daily** | Check UptimeRobot notifications |
| **Weekly** | Review error logs, check Cloudinary bandwidth usage |
| **Monthly** | Review MongoDB Atlas metrics, rotate secrets if needed, `npm audit` |
| **Per deploy** | Run tests, check health endpoint after deploy, monitor error rate for 30 min |

## 5.10 Alerting Signals

| Signal | Tool | Threshold |
|--------|------|-----------|
| Server down | UptimeRobot (free) | Health endpoint returns non-200 for >2 min |
| High error rate | Sentry (free tier) | >10 errors/hour |
| MongoDB slow queries | Atlas alerts | Query >1s |
| Disk space | Server monitoring | >80% usage |
| SSL certificate expiry | UptimeRobot | <14 days before expiry |
