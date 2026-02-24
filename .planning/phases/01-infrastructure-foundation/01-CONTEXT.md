# Phase 1: Infrastructure Foundation - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

All background job processing infrastructure is operational: Redis coordinates job queues and real-time pub/sub, the BullMQ worker process handles long-running tasks, and Socket.IO enables real-time browser notifications. Includes admin monitoring, health checks, notification system, and settings infrastructure. All running within a single Docker Compose deployment.

</domain>

<decisions>
## Implementation Decisions

### Admin Job Monitoring
- Dedicated /admin/jobs page (not dashboard widget)
- Use Bull Board (@bull-board/api with Next.js adapter) for full job explorer
- Shows all job states: pending, active, completed, failed with payload inspection, logs, timing
- ADMIN role only — no other roles have access
- Auto-discovers all BullMQ queues

### Real-time Notifications
- Toast popups in bottom-right corner, auto-dismiss after 5 seconds, clickable to navigate
- Optional sound per event type, configurable in user settings (default: off)
- Browser push notifications (Notification API) with permission prompt on first login — for when tab is backgrounded
- Bell icon in header with unread count badge
- Notification center dropdown: last 50 notifications, click to navigate, mark as read/dismiss

### Failed Job Behavior
- Both ADMIN and affected user are notified on final failure
- User sees friendly German message + retry button: "PDF-Verarbeitung fehlgeschlagen. Erneut versuchen?"
- No technical error details shown to non-admin users
- Admin sees full error in Bull Board + notification center
- 3 automatic retries with exponential backoff: 10s, 60s, 5min
- After 3 retries → job marked as failed, notifications sent
- Retention: failed jobs kept 7 days then auto-cleaned; completed jobs cleaned after 24h

### Deployment Topology
- Separate Docker containers for app and worker (same image, different entrypoint: `next start` vs `node worker.js`)
- Docker Compose with `restart: unless-stopped` on all containers — fire & forget
- Redis 7 with AOF persistence (jobs survive server reboot)
- Full /api/health endpoint returning JSON with status of every service (app, worker, Redis, PostgreSQL, MinIO, Meilisearch, OnlyOffice)
- Docker Compose health checks use /api/health
- Separate /admin/system page showing service health indicators + system status

### Logging & Observability
- Structured JSON logs (timestamp, level, message, context fields: userId, akteId, jobId)
- File-based logging to /var/log/ai-lawyer/ (or configurable path)
- Log rotation needed (logrotate or similar)
- Default log level: INFO, switchable to DEBUG via LOG_LEVEL env var
- /admin/system page includes basic log viewer: last 200 lines, filterable by level (INFO/WARN/ERROR) and source (app/worker), auto-refresh toggle

### Socket.IO Room Strategy
- Per-user rooms: `user:{id}` — auto-joined on connect (personal notifications: email sync, AI drafts)
- Per-Akte rooms: `akte:{id}` — joined when viewing an Akte (case-related: new document, status change)
- Per-role rooms: `role:{ROLE}` — auto-joined on connect (broadcasts: system alerts, role-specific announcements)
- JWT authentication in Socket.IO handshake middleware (validates NextAuth session token)
- Unauthenticated connections rejected
- Auto-reconnect (Socket.IO built-in) + catch-up: client fetches missed notifications from server since disconnect timestamp

### Configuration Management
- Infrastructure settings (Redis URL, ports, database URL) in .env file only — requires restart
- Runtime settings (log level, worker concurrency, retry limits, notification defaults) configurable in /admin/settings — no restart needed
- Build /admin/settings page in Phase 1 as foundation for all future settings
- Runtime setting changes propagated immediately via Redis pub/sub — worker picks up within seconds
- Comprehensive .env.example with all env vars documented (description, default, required/optional)
- SystemSetting Prisma model for DB-backed runtime settings

### Claude's Discretion
- Exact toast component library/implementation (sonner, react-hot-toast, or custom)
- Bull Board styling/theming to fit within app layout
- Log rotation configuration details
- Notification center component design (shadcn/ui based)
- Exact Socket.IO namespace structure
- Worker concurrency defaults per queue type

</decisions>

<specifics>
## Specific Ideas

- "Fire & Forget" deployment philosophy — `docker compose up -d` and everything just works
- Admin pages (/admin/jobs, /admin/system, /admin/settings) should be consistent in layout and navigation
- German UI for all user-facing messages ("PDF-Verarbeitung fehlgeschlagen", not "PDF processing failed")
- Notification catch-up on reconnect is important — no lost notifications in a law firm context

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-infrastructure-foundation*
*Context gathered: 2026-02-24*
