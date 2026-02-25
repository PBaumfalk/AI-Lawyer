# Phase 1: Infrastructure Foundation - Research

**Researched:** 2026-02-24
**Domain:** Background job processing, real-time WebSocket communication, Docker orchestration
**Confidence:** HIGH

## Summary

Phase 1 establishes the foundational infrastructure for all background job processing and real-time communication in the AI-Lawyer platform. The core stack is Redis 7 + BullMQ 5.x for job queues, Socket.IO 4.x for real-time browser notifications, and a custom `server.ts` that wraps Next.js to serve both HTTP and WebSocket traffic on a single port.

The most significant architectural challenge is that Next.js `output: "standalone"` mode does not trace custom server files. The solution is to bundle the custom `server.ts` separately using esbuild, then copy the bundled output alongside the standalone build in Docker. This is a well-documented pattern with multiple production references.

The worker process runs as a separate Docker container using the same image but a different entrypoint (`node dist-worker/index.js` instead of `node dist-server/index.js`). The worker communicates notifications back to connected browsers via `@socket.io/redis-emitter`, which publishes to the same Redis instance that the Socket.IO server subscribes to via `@socket.io/redis-adapter`.

**Primary recommendation:** Use esbuild to separately bundle both `server.ts` (Next.js + Socket.IO) and `worker.ts` (BullMQ processors), share a single Redis 7 instance with AOF persistence, and use `@socket.io/redis-emitter` from the worker to push notifications to connected browsers through the Socket.IO server.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Dedicated /admin/jobs page (not dashboard widget) using Bull Board (@bull-board/api with adapter) for full job explorer
- Shows all job states: pending, active, completed, failed with payload inspection, logs, timing
- ADMIN role only for /admin/jobs
- Auto-discovers all BullMQ queues
- Toast popups in bottom-right corner, auto-dismiss after 5 seconds, clickable to navigate
- Optional sound per event type, configurable in user settings (default: off)
- Browser push notifications (Notification API) with permission prompt on first login
- Bell icon in header with unread count badge
- Notification center dropdown: last 50 notifications, click to navigate, mark as read/dismiss
- Both ADMIN and affected user notified on final failure
- User sees friendly German message + retry button: "PDF-Verarbeitung fehlgeschlagen. Erneut versuchen?"
- No technical error details shown to non-admin users
- Admin sees full error in Bull Board + notification center
- 3 automatic retries with exponential backoff: 10s, 60s, 5min
- Failed jobs kept 7 days then auto-cleaned; completed jobs cleaned after 24h
- Separate Docker containers for app and worker (same image, different entrypoint)
- Docker Compose with `restart: unless-stopped` on all containers
- Redis 7 with AOF persistence
- Full /api/health endpoint returning JSON with status of every service
- Docker Compose health checks use /api/health
- Separate /admin/system page showing service health indicators + system status
- Structured JSON logs (timestamp, level, message, context fields: userId, akteId, jobId)
- File-based logging to /var/log/ai-lawyer/ (or configurable path)
- Log rotation needed
- Default log level: INFO, switchable to DEBUG via LOG_LEVEL env var
- /admin/system page includes basic log viewer: last 200 lines, filterable by level and source, auto-refresh toggle
- Per-user rooms: `user:{id}` -- auto-joined on connect
- Per-Akte rooms: `akte:{id}` -- joined when viewing an Akte
- Per-role rooms: `role:{ROLE}` -- auto-joined on connect
- JWT authentication in Socket.IO handshake middleware (validates NextAuth session token)
- Unauthenticated connections rejected
- Auto-reconnect + catch-up: client fetches missed notifications since disconnect timestamp
- Infrastructure settings in .env only; runtime settings in /admin/settings (no restart needed)
- Build /admin/settings page in Phase 1 as foundation for all future settings
- Runtime setting changes propagated via Redis pub/sub
- Comprehensive .env.example with all env vars documented
- SystemSetting Prisma model for DB-backed runtime settings

### Claude's Discretion
- Exact toast component library/implementation (sonner, react-hot-toast, or custom)
- Bull Board styling/theming to fit within app layout
- Log rotation configuration details
- Notification center component design (shadcn/ui based)
- Exact Socket.IO namespace structure
- Worker concurrency defaults per queue type

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REQ-IF-001 | Redis 7 in Docker Compose (BullMQ Job-Queue + Socket.IO Pub/Sub) | Standard Stack: Redis 7 alpine image with AOF, `maxmemory-policy: noeviction`; shared by BullMQ (ioredis) and Socket.IO (redis-adapter) |
| REQ-IF-002 | Worker-Prozess (worker.ts, BullMQ-Prozessoren, gleiche Codebasis wie App) | Architecture: Separate esbuild-bundled `worker.ts` entry, same Docker image with different CMD; BullMQ Worker class with typed processors |
| REQ-IF-003 | Custom server.ts (Next.js + Socket.IO WebSocket auf gleichem Port) | Architecture: esbuild-bundled `server.ts` wrapping Next.js + Socket.IO on single HTTP server; Redis adapter for cross-process communication; standalone mode preserved via separate bundling |
| REQ-IF-005 | Graceful Shutdown fuer Worker (laufende Jobs abschliessen) | Code Examples: SIGINT/SIGTERM handlers calling `await worker.close()` which waits for in-flight jobs to complete |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| bullmq | ^5.70 | Job queue with Redis backend | De facto standard for Node.js job queues; Redis Streams-based events; built-in retry, backoff, rate limiting, priorities |
| socket.io | ^4.8 | Real-time WebSocket server | Most mature WebSocket library for Node.js; rooms, namespaces, auto-reconnect, fallback transports |
| socket.io-client | ^4.8 | Browser WebSocket client | Paired client for socket.io server |
| @socket.io/redis-adapter | ^8.3 | Socket.IO multi-process support via Redis pub/sub | Enables worker process to emit to connected browsers through Redis |
| @socket.io/redis-emitter | ^5.1 | Emit Socket.IO events from non-Socket.IO processes | Worker process uses this to send notifications through Redis to the Socket.IO server |
| ioredis | ^5.4 | Redis client for Node.js | Required by BullMQ; also used for Socket.IO adapter; supports Redis 7 features |
| pino | ^9.6 | Structured JSON logger | 5x faster than Winston; JSON output by default; child loggers for context; first-class TypeScript support |
| pino-pretty | ^13.0 | Human-readable log formatting for development | Transforms JSON logs to colored, readable output in dev mode |
| pino-roll | ^4.0 | Log file rotation transport | Automatic file rotation by size/time; symlink to current log; retention policies |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @bull-board/api | ^6.5 | Bull Board core API for queue inspection dashboard | Admin job monitoring page (/admin/jobs) |
| @bull-board/hono | ^6.5 | Hono server adapter for Bull Board | Integrating Bull Board into Next.js App Router via Hono catch-all route |
| hono | ^4.7 | Lightweight web framework | Adapter layer for Bull Board inside Next.js API routes; minimal overhead |
| sonner | ^1.7.1 | Toast notification component | Already installed in project; shadcn/ui ecosystem standard; opinionated API |
| esbuild | ^0.25 | Bundle server.ts and worker.ts | Build step to create standalone server/worker bundles that work with Next.js standalone output |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pino | winston | Winston is more flexible but 5x slower; pino's JSON-first output better for structured logging requirement |
| @bull-board/hono | @bull-board/express | Express adapter requires Express as dependency; Hono is lighter and integrates cleanly with Next.js App Router via `hono/vercel` handle() |
| @socket.io/redis-adapter | @socket.io/redis-streams-adapter | Streams adapter is newer but less battle-tested; standard Redis adapter is sufficient for single-Redis-instance deployment |
| sonner | react-hot-toast | sonner is already installed, adopted by shadcn/ui, simpler API; no reason to switch |

**Installation:**
```bash
npm install bullmq ioredis socket.io socket.io-client @socket.io/redis-adapter @socket.io/redis-emitter pino pino-roll @bull-board/api @bull-board/hono hono
npm install -D pino-pretty esbuild @types/node
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── server.ts                    # Custom server: Next.js + Socket.IO (bundled by esbuild)
├── worker.ts                    # Worker entrypoint: BullMQ processors (bundled by esbuild)
├── lib/
│   ├── redis.ts                 # Shared Redis connection factory (ioredis)
│   ├── logger.ts                # Pino logger factory with context support
│   ├── queue/
│   │   ├── connection.ts        # BullMQ connection config
│   │   ├── queues.ts            # Queue definitions (exported for both app + worker)
│   │   └── processors/          # Job processor functions
│   │       └── test.processor.ts
│   ├── socket/
│   │   ├── server.ts            # Socket.IO server setup + Redis adapter
│   │   ├── auth.ts              # JWT handshake middleware
│   │   ├── rooms.ts             # Room join/leave logic (user, akte, role)
│   │   └── emitter.ts           # Redis emitter for worker process
│   ├── notifications/
│   │   ├── service.ts           # Notification creation, storage, retrieval
│   │   └── types.ts             # Notification event types
│   ├── settings/
│   │   ├── service.ts           # SystemSetting CRUD + cache
│   │   └── defaults.ts          # Default runtime settings
│   └── health/
│       └── checks.ts            # Health check functions per service
├── app/
│   ├── api/
│   │   ├── health/route.ts      # GET /api/health -- service health JSON
│   │   ├── admin/
│   │   │   └── jobs/[[...path]]/route.ts  # Bull Board via Hono catch-all
│   │   ├── notifications/
│   │   │   └── route.ts         # GET missed notifications for catch-up
│   │   └── settings/
│   │       └── route.ts         # GET/PUT runtime settings
│   └── (dashboard)/
│       └── admin/
│           ├── jobs/page.tsx     # Bull Board embedded page
│           ├── system/page.tsx   # System health + log viewer
│           └── settings/page.tsx # Runtime settings management
├── components/
│   ├── notifications/
│   │   ├── notification-provider.tsx  # Socket.IO connection + event handling
│   │   ├── notification-bell.tsx      # Header bell icon with badge
│   │   └── notification-center.tsx    # Dropdown with last 50 notifications
│   └── socket-provider.tsx      # Socket.IO client context provider
scripts/
├── build-server.ts              # esbuild bundle for server.ts
└── build-worker.ts              # esbuild bundle for worker.ts
```

### Pattern 1: Custom Server with Standalone Output (esbuild bundling)
**What:** Bundle `server.ts` separately so it works alongside Next.js standalone output
**When to use:** Always -- this is the only way to have both custom server and standalone Docker images
**Example:**
```typescript
// scripts/build-server.ts
// Source: https://hmos.dev/en/nextjs-docker-standalone-and-custom-server
import { build } from "esbuild";

build({
  entryPoints: ["src/server.ts"],
  outfile: "dist-server/index.js",
  bundle: true,
  platform: "node",
  target: "node18",
  format: "esm",
  external: ["next", "sharp", "@prisma/client"],
  banner: {
    js: 'import { createRequire } from "module"; const require = createRequire(import.meta.url);',
  },
});
```

```typescript
// src/server.ts
// Source: https://socket.io/how-to/use-with-nextjs
import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { Redis } from "ioredis";
import { setupSocketAuth } from "@/lib/socket/auth";
import { setupRooms } from "@/lib/socket/rooms";
import { createLogger } from "@/lib/logger";

const logger = createLogger("server");
const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(handler);

  // Redis pub/sub for Socket.IO adapter
  const pubClient = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
  const subClient = pubClient.duplicate();

  const io = new Server(httpServer, {
    adapter: createAdapter(pubClient, subClient),
    cors: { origin: dev ? "*" : false },
  });

  // JWT auth middleware
  setupSocketAuth(io);
  // Room management
  setupRooms(io);

  httpServer.listen(port, () => {
    logger.info({ hostname, port }, "Server ready");
  });
});
```

### Pattern 2: Worker Process with Graceful Shutdown
**What:** Separate Node.js process running BullMQ workers with proper signal handling
**When to use:** Always -- worker must handle SIGTERM from Docker stop
**Example:**
```typescript
// src/worker.ts
// Source: https://docs.bullmq.io/guide/going-to-production
import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { Emitter } from "@socket.io/redis-emitter";
import { createLogger } from "@/lib/logger";

const logger = createLogger("worker");
const connection = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null, // Required for BullMQ workers
});

// Redis emitter for sending notifications to browsers
const emitterClient = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
const socketEmitter = new Emitter(emitterClient);

const workers: Worker[] = [];

// Register workers
const testWorker = new Worker(
  "test-queue",
  async (job) => {
    logger.info({ jobId: job.id, data: job.data }, "Processing job");
    // Process job...
    // Emit notification to user
    socketEmitter.to(`user:${job.data.userId}`).emit("notification", {
      type: "job:completed",
      message: "Vorgang abgeschlossen",
      jobId: job.id,
    });
    return { success: true };
  },
  {
    connection,
    concurrency: 5,
    removeOnComplete: { age: 86400 },  // 24h
    removeOnFail: { age: 604800 },     // 7 days
  }
);

testWorker.on("error", (err) => {
  logger.error({ err }, "Worker error");
});

workers.push(testWorker);

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info({ signal }, "Received shutdown signal, closing workers...");
  await Promise.all(workers.map((w) => w.close()));
  logger.info("All workers closed, exiting");
  process.exit(0);
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception");
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error({ reason, promise }, "Unhandled rejection");
});

logger.info("Worker started");
```

### Pattern 3: Redis Emitter for Cross-Process Notifications
**What:** Worker process emits Socket.IO events to browsers without holding a Socket.IO server
**When to use:** Whenever the worker needs to notify a connected user (job completed, failed, progress)
**Example:**
```typescript
// src/lib/socket/emitter.ts
// Source: https://github.com/socketio/socket.io-redis-emitter
import { Emitter } from "@socket.io/redis-emitter";
import { Redis } from "ioredis";

let emitter: Emitter | null = null;

export function getSocketEmitter(): Emitter {
  if (!emitter) {
    const client = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    emitter = new Emitter(client);
  }
  return emitter;
}

// Usage in any worker processor:
// const io = getSocketEmitter();
// io.to(`user:${userId}`).emit("notification", { ... });
// io.to(`akte:${akteId}`).emit("document:updated", { ... });
// io.to(`role:ADMIN`).emit("system:alert", { ... });
```

### Pattern 4: Bull Board via Hono in Next.js App Router
**What:** Embed Bull Board dashboard using Hono adapter inside a Next.js catch-all API route
**When to use:** Admin job monitoring page (/admin/jobs)
**Example:**
```typescript
// src/app/api/admin/jobs/[[...path]]/route.ts
// Source: https://hono.dev/docs/getting-started/nextjs + @bull-board/hono
import { Hono } from "hono";
import { handle } from "hono/vercel";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { HonoAdapter } from "@bull-board/hono";
import { testQueue } from "@/lib/queue/queues";

const serverAdapter = new HonoAdapter("/api/admin/jobs");

createBullBoard({
  queues: [new BullMQAdapter(testQueue)],
  serverAdapter,
});

const app = serverAdapter.registerPlugin();

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
```

### Pattern 5: Socket.IO JWT Authentication Middleware
**What:** Validate NextAuth JWT tokens in Socket.IO handshake
**When to use:** Every Socket.IO connection attempt
**Example:**
```typescript
// src/lib/socket/auth.ts
import type { Server } from "socket.io";
import jwt from "jsonwebtoken";

export function setupSocketAuth(io: Server) {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error("Authentifizierung erforderlich"));
    }
    try {
      const secret = process.env.NEXTAUTH_SECRET!;
      const decoded = jwt.verify(token, secret) as {
        sub: string;
        role: string;
        kanzleiId: string | null;
      };
      socket.data.userId = decoded.sub;
      socket.data.role = decoded.role;
      socket.data.kanzleiId = decoded.kanzleiId;
      next();
    } catch {
      next(new Error("Ungültiges Token"));
    }
  });
}
```

### Pattern 6: Runtime Settings via Redis Pub/Sub
**What:** Admin changes settings in DB, publishes to Redis channel; worker subscribes and updates in-memory config
**When to use:** Any runtime-configurable setting (log level, concurrency, retry limits)
**Example:**
```typescript
// src/lib/settings/service.ts
import { prisma } from "@/lib/db";
import { Redis } from "ioredis";

const SETTINGS_CHANNEL = "settings:changed";

export async function updateSetting(key: string, value: string) {
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
  const pub = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
  await pub.publish(SETTINGS_CHANNEL, JSON.stringify({ key, value }));
  await pub.quit();
}

// In worker.ts:
const sub = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
sub.subscribe(SETTINGS_CHANNEL);
sub.on("message", (channel, message) => {
  const { key, value } = JSON.parse(message);
  // Update in-memory config
});
```

### Anti-Patterns to Avoid
- **Running BullMQ inside Next.js API routes:** API routes are short-lived; workers need persistent connections. Always use a separate worker process.
- **Using Next.js standalone server.js as custom server:** The generated `server.js` from standalone build is minimal and cannot be extended. Bundle your own server separately.
- **Sharing ioredis connections between Queue and Worker without `maxRetriesPerRequest: null`:** Workers REQUIRE `maxRetriesPerRequest: null`; Queues should use the default (20) for fail-fast behavior.
- **Using ioredis `keyPrefix` option:** Incompatible with BullMQ which has its own prefix mechanism.
- **Polling for notifications:** Use Socket.IO push with Redis adapter instead of client-side polling.
- **Storing sensitive data in job payloads:** Keep PII out of job data; reference by ID instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Job queue with retries | Custom Redis-based queue | BullMQ | Dead letter queues, backoff strategies, stalled job recovery, priority queues -- dozens of edge cases |
| WebSocket rooms/auth | Raw `ws` with manual room tracking | Socket.IO + Redis adapter | Reconnection, room management, namespace isolation, adapter pattern for multi-process |
| Cross-process WebSocket emit | Custom Redis pub/sub message format | @socket.io/redis-emitter | Type-safe room targeting, namespace support, binary data support |
| Job dashboard UI | Custom React dashboard | Bull Board | Auto-updating UI, job inspection, retry/remove actions, log viewing |
| Structured logging | console.log with JSON.stringify | Pino | Child loggers, serializers, transport pipeline, redaction, performance |
| Log file rotation | Custom file writer with date checks | pino-roll | Size/time rotation, symlinks, retention policies, async I/O |

**Key insight:** Infrastructure plumbing has countless edge cases (connection recovery, process signals, concurrent access, file locking). Each library listed above represents years of production battle-testing. Hand-rolling any of these will consume implementation time on edge cases rather than business logic.

## Common Pitfalls

### Pitfall 1: Next.js Standalone vs Custom Server Conflict
**What goes wrong:** Setting `output: "standalone"` in next.config.mjs generates a minimal `server.js` that ignores any custom server file. The app starts without Socket.IO.
**Why it happens:** Standalone mode traces only imported modules from Next.js pages/routes, not external server files.
**How to avoid:** Bundle `server.ts` separately with esbuild. The bundled file imports `next` as external and creates its own HTTP server. In Docker, copy the standalone output AND the bundled server, then `CMD ["node", "dist-server/index.js"]`.
**Warning signs:** Socket.IO connections fail in production but work in dev; the standalone `server.js` file doesn't contain any Socket.IO code.

### Pitfall 2: BullMQ maxRetriesPerRequest Misconfiguration
**What goes wrong:** Worker crashes or stops processing jobs after Redis reconnection.
**Why it happens:** By default, ioredis retries failed commands 20 times then throws. BullMQ workers need unlimited retries to survive Redis blips.
**How to avoid:** Always set `maxRetriesPerRequest: null` for Worker connections. Use default (or lower) for Queue connections in API routes for fail-fast behavior.
**Warning signs:** Workers stop picking up jobs after Redis restart; "MaxRetriesPerRequestError" in logs.

### Pitfall 3: Redis maxmemory-policy Eviction
**What goes wrong:** BullMQ loses job data, queues become corrupted.
**Why it happens:** Redis default `maxmemory-policy` is `noeviction` (safe), but some cloud providers set `volatile-lru` or `allkeys-lru` which will evict BullMQ keys.
**How to avoid:** Explicitly set `maxmemory-policy: noeviction` in Redis configuration. Use `redis.conf` or Docker environment variable.
**Warning signs:** Jobs disappear from queues; "Missing lock" errors; inconsistent queue state.

### Pitfall 4: Socket.IO Authentication Token Expiry
**What goes wrong:** Long-running WebSocket connections continue after user session expires.
**Why it happens:** JWT is only verified at handshake time; subsequent messages skip auth.
**How to avoid:** Implement periodic token refresh or re-authentication on the socket. On token expiry, disconnect the socket server-side. Client reconnects and re-authenticates.
**Warning signs:** Users see notifications for other users' data after logout/login.

### Pitfall 5: Worker Not Completing Jobs on Docker Stop
**What goes wrong:** Docker sends SIGTERM, process exits immediately, jobs become stalled.
**Why it happens:** Node.js default behavior on SIGTERM is to exit. Without explicit signal handling, `worker.close()` is never called.
**How to avoid:** Register SIGINT/SIGTERM handlers that call `await worker.close()`. Docker Compose `stop_grace_period: 30s` gives time for in-flight jobs to finish.
**Warning signs:** Many stalled jobs after deployments; jobs processed twice.

### Pitfall 6: Bull Board Express Dependency in Next.js App Router
**What goes wrong:** Importing `@bull-board/express` pulls in Express as a dependency, adding bloat and potential conflicts with Next.js.
**Why it happens:** Bull Board has no native Next.js adapter. The Express adapter is the most documented approach.
**How to avoid:** Use `@bull-board/hono` adapter with Hono's Next.js integration (`hono/vercel` handle). Hono is 14KB vs Express's ~550KB and integrates cleanly with Next.js App Router catch-all routes.
**Warning signs:** Large bundle size increase; Express middleware conflicts.

### Pitfall 7: Lost Notifications During Disconnect
**What goes wrong:** User misses notifications that arrived while their browser tab was closed or during a network interruption.
**Why it happens:** Socket.IO is fire-and-forget; disconnected clients don't receive buffered messages.
**How to avoid:** Persist notifications to database. On reconnect, client sends last-seen timestamp and fetches missed notifications via REST API. Only then subscribe to live events.
**Warning signs:** Users complain about missing notifications; "Ich habe die Benachrichtigung nie erhalten."

## Code Examples

Verified patterns from official sources:

### Redis Connection Factory
```typescript
// src/lib/redis.ts
import { Redis } from "ioredis";
import { createLogger } from "@/lib/logger";

const logger = createLogger("redis");

export function createRedisConnection(options?: {
  maxRetriesPerRequest?: number | null;
}): Redis {
  const url = process.env.REDIS_URL || "redis://redis:6379";
  const connection = new Redis(url, {
    maxRetriesPerRequest: options?.maxRetriesPerRequest ?? 20,
    retryStrategy: (times: number) => {
      return Math.max(Math.min(Math.exp(times), 20000), 1000);
    },
  });

  connection.on("error", (err) => {
    logger.error({ err }, "Redis connection error");
  });

  connection.on("connect", () => {
    logger.info("Redis connected");
  });

  return connection;
}
```

### Queue Definition with Typed Jobs
```typescript
// src/lib/queue/queues.ts
import { Queue } from "bullmq";
import { createRedisConnection } from "@/lib/redis";

// Connection for Queues (fail-fast, default retries)
const queueConnection = createRedisConnection();

export const testQueue = new Queue("test", {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "custom",
    },
    removeOnComplete: { age: 86400 },     // 24h
    removeOnFail: { age: 604800 },        // 7 days
  },
});

// Custom backoff: 10s, 60s, 5min
// Source: BullMQ docs on custom backoff
export function calculateBackoff(attemptsMade: number): number {
  const delays = [10000, 60000, 300000]; // 10s, 60s, 5min
  return delays[attemptsMade - 1] || delays[delays.length - 1];
}
```

### Pino Logger with Context
```typescript
// src/lib/logger.ts
// Source: https://github.com/pinojs/pino
import pino from "pino";

const level = process.env.LOG_LEVEL || "info";
const isDev = process.env.NODE_ENV !== "production";

const transport = isDev
  ? { target: "pino-pretty", options: { colorize: true } }
  : {
      targets: [
        { target: "pino/file", options: { destination: 1 } }, // stdout
        {
          target: "pino-roll",
          options: {
            file: process.env.LOG_FILE_PATH || "/var/log/ai-lawyer/app",
            frequency: "daily",
            size: "10m",
            mkdir: true,
            extension: ".log",
          },
        },
      ],
    };

export const rootLogger = pino({
  level,
  transport,
  base: { service: "ai-lawyer" },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function createLogger(module: string) {
  return rootLogger.child({ module });
}

// Usage with context:
// const log = createLogger("worker");
// log.info({ jobId: "123", userId: "abc", akteId: "xyz" }, "Job completed");
```

### Notification Persistence Model (Prisma)
```prisma
// Addition to prisma/schema.prisma
model Notification {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  type        String   // e.g. "job:completed", "job:failed", "document:created"
  title       String
  message     String
  data        Json?    // Arbitrary payload (link target, jobId, akteId, etc.)
  read        Boolean  @default(false)
  dismissed   Boolean  @default(false)
  soundType   String?  // Optional sound identifier
  createdAt   DateTime @default(now())

  @@index([userId, read])
  @@index([userId, createdAt])
  @@map("notifications")
}

model SystemSetting {
  id        String   @id @default(cuid())
  key       String   @unique
  value     String   @db.Text
  type      String   @default("string") // string, number, boolean, json
  category  String   @default("general")
  label     String?  // German display label
  updatedAt DateTime @updatedAt
  createdAt DateTime @default(now())

  @@index([category])
  @@map("system_settings")
}
```

### Socket.IO Client Provider (React)
```typescript
// src/components/socket-provider.tsx
"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";
import { useSession } from "next-auth/react";

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
});

export function SocketProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!session?.user) return;

    const s = io({
      auth: { token: /* session JWT token */ },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    s.on("connect", () => setIsConnected(true));
    s.on("disconnect", () => setIsConnected(false));

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [session]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
```

### Docker Compose Redis + Worker Addition
```yaml
# Addition to docker-compose.yml
services:
  redis:
    image: redis:7-alpine
    container_name: ailawyer-redis
    restart: unless-stopped
    command: >
      redis-server
      --appendonly yes
      --maxmemory-policy noeviction
      --save 60 1000
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  worker:
    build: .
    container_name: ailawyer-worker
    restart: unless-stopped
    command: ["node", "dist-worker/index.js"]
    stop_grace_period: 30s
    environment:
      NODE_ENV: production
      REDIS_URL: redis://redis:6379
      DATABASE_URL: postgresql://ailawyer:ailawyer@db:5432/ailawyer?schema=public
      LOG_LEVEL: info
      LOG_FILE_PATH: /var/log/ai-lawyer/worker
    depends_on:
      redis:
        condition: service_healthy
      db:
        condition: service_healthy
    volumes:
      - worker_logs:/var/log/ai-lawyer

volumes:
  redisdata:
  worker_logs:
```

### Dockerfile Modifications
```dockerfile
# Add to build stage:
# Bundle server and worker
RUN npx esbuild src/server.ts --bundle --platform=node --target=node18 \
    --format=esm --outfile=dist-server/index.js \
    --external:next --external:sharp --external:@prisma/client
RUN npx esbuild src/worker.ts --bundle --platform=node --target=node18 \
    --format=esm --outfile=dist-worker/index.js \
    --external:@prisma/client

# Add to runner stage:
COPY --from=builder /app/dist-server ./dist-server
COPY --from=builder /app/dist-worker ./dist-worker

# Change entrypoint to custom server instead of next's server.js
CMD ["node", "dist-server/index.js"]
```

### Health Check Endpoint
```typescript
// src/app/api/health/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Redis } from "ioredis";

export async function GET() {
  const checks: Record<string, { status: string; latency?: number }> = {};

  // PostgreSQL
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.postgres = { status: "healthy", latency: Date.now() - dbStart };
  } catch {
    checks.postgres = { status: "unhealthy" };
  }

  // Redis
  const redisStart = Date.now();
  try {
    const redis = new Redis(process.env.REDIS_URL || "redis://redis:6379", {
      connectTimeout: 3000,
      maxRetriesPerRequest: 1,
    });
    await redis.ping();
    await redis.quit();
    checks.redis = { status: "healthy", latency: Date.now() - redisStart };
  } catch {
    checks.redis = { status: "unhealthy" };
  }

  // Aggregate
  const allHealthy = Object.values(checks).every((c) => c.status === "healthy");

  return NextResponse.json(
    { status: allHealthy ? "healthy" : "degraded", services: checks },
    { status: allHealthy ? 200 : 503 }
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Bull (v3/v4) | BullMQ (v5) | 2022+ | BullMQ is the official successor; uses Redis Streams (not pub/sub) for events; QueueScheduler removed in v2+ |
| socket.io-redis | @socket.io/redis-adapter | Socket.IO v4 (2021) | New scoped package; supports Redis 7 sharded pub/sub |
| socket.io-emitter | @socket.io/redis-emitter | Socket.IO v4 (2021) | New scoped package; requires you to provide Redis client |
| QueueScheduler class | Built-in to Worker | BullMQ v2 (2022) | No need to run a separate QueueScheduler; stalled job checks built into Worker |
| Winston for structured logging | Pino | 2020+ trend | 5x performance improvement; JSON-first design; better for containerized/structured logging |
| Express custom server | esbuild-bundled server.ts | 2023+ | Works with standalone output; smaller Docker images; no Express dependency needed |

**Deprecated/outdated:**
- **Bull (not BullMQ):** Legacy; no new features. Use BullMQ.
- **QueueScheduler:** Removed in BullMQ v2. Functionality merged into Worker.
- **socket.io-redis (old package):** Replaced by `@socket.io/redis-adapter`.
- **socket.io-emitter (old package):** Replaced by `@socket.io/redis-emitter`.

## Open Questions

1. **NextAuth JWT token extraction for Socket.IO**
   - What we know: NextAuth v5 uses JWT strategy; tokens are stored in HTTP-only cookies. Socket.IO handshake sends cookies.
   - What's unclear: The exact method to extract and verify the NextAuth JWT from the Socket.IO handshake cookie vs. passing a separate token from the client. NextAuth v5 beta API may differ.
   - Recommendation: During implementation, test both approaches: (a) reading the `next-auth.session-token` cookie from handshake headers, and (b) having the client fetch and send a JWT explicitly. Approach (a) is cleaner but depends on cookie accessibility. Approach (b) is more reliable.

2. **Bull Board Hono adapter maturity**
   - What we know: `@bull-board/hono` exists as an official adapter. Hono integrates with Next.js via `hono/vercel`.
   - What's unclear: Whether the Hono adapter handles all Bull Board features (auto-refresh, WebSocket for live updates, static asset serving). Limited community examples.
   - Recommendation: Try `@bull-board/hono` first. If it fails, fall back to running Bull Board as a simple iframe or standalone page served from the custom server.ts (Express-free, using `@bull-board/h3` or raw API).

3. **esbuild path alias resolution**
   - What we know: The project uses `@/*` path alias (tsconfig.json paths). esbuild does not resolve TypeScript path aliases by default.
   - What's unclear: Whether `esbuild-plugin-alias` or `tsconfig-paths` plugin is needed, or if re-exporting from a barrel file avoids the issue.
   - Recommendation: Use `esbuild-plugin-tsc` or `esbuild-plugin-alias` to resolve `@/*` paths during bundling. Test early in implementation.

## Sources

### Primary (HIGH confidence)
- [BullMQ Official Docs - Connections](https://docs.bullmq.io/guide/connections) - ioredis configuration, connection reuse
- [BullMQ Official Docs - Going to Production](https://docs.bullmq.io/guide/going-to-production) - Graceful shutdown, Redis config, signal handling
- [BullMQ Official Docs - Graceful Shutdown](https://docs.bullmq.io/guide/workers/graceful-shutdown) - Worker.close() behavior
- [BullMQ Official Docs - Events](https://docs.bullmq.io/guide/events) - QueueEvents, Redis Streams, event trimming
- [Socket.IO - How to use with Next.js](https://socket.io/how-to/use-with-nextjs) - Custom server pattern, client setup
- [Socket.IO - Redis Adapter](https://socket.io/docs/v4/redis-adapter/) - Adapter setup, sharded pub/sub, ioredis config
- [Socket.IO Redis Emitter GitHub](https://github.com/socketio/socket.io-redis-emitter) - Emitter API, room targeting, typed events
- [Bull Board GitHub](https://github.com/felixmosh/bull-board) - Available adapters, setup examples, configuration
- [Hono - Next.js Getting Started](https://hono.dev/docs/getting-started/nextjs) - Catch-all route pattern, handle() adapter

### Secondary (MEDIUM confidence)
- [hmos.dev - Next.js with Docker, Standalone, and Custom Server](https://hmos.dev/en/nextjs-docker-standalone-and-custom-server) - esbuild bundling solution for standalone + custom server
- [sdust.dev - Standalone Next.js with Custom Server](https://sdust.dev/posts/2024-11-10_nextjs-custom-server) - tsup/@vercel/nft alternative approach
- [Next.js Discussion #34599](https://github.com/vercel/next.js/discussions/34599) - Community workarounds for standalone + custom server
- [Pino GitHub](https://github.com/pinojs/pino) - Logger features, transport system
- [pino-roll GitHub](https://github.com/mcollina/pino-roll) - File rotation transport

### Tertiary (LOW confidence)
- [Bull Board Issue #882](https://github.com/felixmosh/bull-board/issues/882) - Next.js support status (no native adapter confirmed)
- Bull Board Hono adapter - Limited community examples; adapter exists but maturity unclear

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries are well-documented, widely adopted, and version-pinned. BullMQ, Socket.IO, ioredis, and Pino are industry standards.
- Architecture: HIGH - The custom server + standalone + esbuild pattern is documented in multiple production references. Socket.IO + Redis adapter is the official multi-process solution.
- Pitfalls: HIGH - All pitfalls sourced from official documentation warnings and known issues. The standalone/custom server conflict is the most critical and is well-documented.

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (stable ecosystem, 30-day validity)
