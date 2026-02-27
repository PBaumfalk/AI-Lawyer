---
status: awaiting_human_verify
trigger: "Combined: DOCX preview stuck, OnlyOffice slow, Socket.IO failing, 404 on bearbeiten page, React hydration errors, preload warnings"
created: 2026-02-27T12:00:00Z
updated: 2026-02-27T21:00:00Z
---

## Current Focus

hypothesis: CONFIRMED -- Four distinct root causes identified and fixed
test: n/a (all fixes applied)
expecting: n/a
next_action: Await human verification

## Symptoms

expected:
1. DOCX files should show a PDF preview on the document detail page (converted via Stirling-PDF in background)
2. OnlyOffice editor should load quickly when clicking "In OnlyOffice bearbeiten"
3. Socket.IO WebSocket should connect without errors

actual:
1. Preview area shows "Vorschau wird generiert..." with document icon forever -- never resolves to PDF preview
2. OnlyOffice editor shows "Editor wird geladen..." spinner for a very long time (but eventually loads)
3. Socket.IO WebSocket fails repeatedly: "WebSocket is closed before the connection is established"
4. OnlyOffice's own WebSocket also fails: ws://192.168.178.38:8080/... failed
5. 404 error on "bearbeiten" page resource
6. "[SocketProvider] Connection error: timeout" repeated

errors:
- WebSocket connection to 'ws://192.168.178.38:3000/socket.io/...' failed
- WebSocket connection to 'ws://192.168.178.38:8080/...' failed
- 404 on /dokumente/[id]/bearbeiten
- [SocketProvider] Connection error: timeout

reproduction: Upload DOCX, open detail page, click "In OnlyOffice bearbeiten"
started: Ongoing -- multiple issues with different origins

## Eliminated

- hypothesis: Frontend polling fix missing from codebase
  evidence: Lines 178-191 of document-detail.tsx contain the useEffect polling every 3s when needsPreviewPoll is true. The fix from previous session IS deployed.
  timestamp: 2026-02-27T14:01:00Z

- hypothesis: Preview queue not registered in worker
  evidence: worker.ts lines 309-341 register a previewWorker for "document-preview" queue with concurrency 2
  timestamp: 2026-02-27T14:01:00Z

- hypothesis: Preview not enqueued on upload
  evidence: Upload route (api/akten/[id]/dokumente/route.ts) lines 188-199 enqueue to previewQueue for non-PDF files inside the needsOcr block
  timestamp: 2026-02-27T14:01:00Z

- hypothesis: Backend preview pipeline broken
  evidence: Complete chain verified: upload enqueues to previewQueue -> worker picks up "document-preview" -> processPreviewJob calls Stirling-PDF convertToPdf -> stores PDF in MinIO -> updates previewPfad in DB. Pipeline is correct.
  timestamp: 2026-02-27T14:01:00Z

## Evidence

- timestamp: 2026-02-27T12:05:00Z
  checked: document-detail.tsx (original investigation)
  found: Preview polling and button fix already deployed from previous session
  implication: Frontend correctly polls for preview. Issue is elsewhere.

- timestamp: 2026-02-27T14:02:00Z
  checked: File system -- src/app/(dashboard)/dokumente/ and src/app/dokumente/
  found: NO bearbeiten page exists. Only src/app/(dashboard)/dokumente/page.tsx (list page). The link in document-detail.tsx goes to /dokumente/${dokument.id}/bearbeiten but no page route handles this path. Two OnlyOffice editor components exist (editor/ and dokumente/) but neither is wrapped in a page.
  implication: ROOT CAUSE #1 of 404 error.

- timestamp: 2026-02-27T14:03:00Z
  checked: package.json scripts + src/server.ts
  found: `npm run dev` runs `next dev --turbo` which does NOT use the custom server.ts. The custom server.ts sets up Socket.IO via setupSocketIO(httpServer). No `dev:server` script exists.
  implication: ROOT CAUSE #2 -- Socket.IO WebSocket errors on port 3000 are expected in dev mode because Socket.IO server is never started.

- timestamp: 2026-02-27T14:04:00Z
  checked: src/lib/socket/auth.ts
  found: Auth middleware uses `jwt.verify(token, secret)` from jsonwebtoken package. But NextAuth v5 (beta.30) uses JWE-encrypted tokens (A256CBC-HS512), NOT plain JWTs. jwt.verify() will always fail on NextAuth v5 tokens.
  implication: ROOT CAUSE #3 -- Even with custom server running, Socket.IO auth rejects ALL connections because it can't decode encrypted tokens.

- timestamp: 2026-02-27T14:05:00Z
  checked: Docker containers, process list
  found: No Docker containers running, no Node.js processes for AI-Lawyer. The worker and Stirling-PDF are not running.
  implication: Preview jobs enqueued to BullMQ are never processed because the worker container isn't running. Preview stays "generating" forever.

- timestamp: 2026-02-27T14:06:00Z
  checked: .env ONLYOFFICE_URL
  found: ONLYOFFICE_URL=http://localhost:8080 but user accesses app at 192.168.178.38:3000 (LAN IP). OnlyOffice config uses documentServerUrl from the API which is the ONLYOFFICE_URL env var. Browser gets http://localhost:8080 but is on a different machine.
  implication: OnlyOffice WebSocket errors on 8080 are due to LAN access with localhost config. For LAN access, ONLYOFFICE_URL should be http://192.168.178.38:8080.

- timestamp: 2026-02-27T14:07:00Z
  checked: Preview polling behavior
  found: Polling runs forever when previewPfad stays null (worker down / Stirling-PDF down). No timeout mechanism. User sees "Vorschau wird generiert..." indefinitely.
  implication: Need timeout + retry mechanism for better UX.

- timestamp: 2026-02-27T14:08:00Z
  checked: Preview API (GET /api/dokumente/[id]/preview)
  found: Only has GET endpoint. No way to manually re-trigger preview generation if the original job failed.
  implication: Need POST endpoint to re-enqueue preview jobs.

## Resolution

root_cause: Four distinct issues:
  1. MISSING PAGE (404): /dokumente/[id]/bearbeiten route does not exist. Links from document-detail.tsx get 404.
  2. SOCKET.IO DEV MODE: `npm run dev` uses `next dev --turbo` (no custom server). Socket.IO server never starts. No dev:server script.
  3. SOCKET.IO AUTH BUG: auth.ts uses plain jwt.verify() on NextAuth v5 encrypted JWE tokens, which always fails.
  4. PREVIEW UX: Polling runs forever when backend is down. No timeout, no manual re-trigger, no error state.
  (Note: OnlyOffice WebSocket errors on 8080 are a configuration issue when accessing via LAN IP -- ONLYOFFICE_URL needs to match the access URL)

fix: Five changes applied:
  1. Created src/app/(dashboard)/dokumente/[id]/bearbeiten/page.tsx -- wraps OnlyOfficeEditor component with auth, metadata, navigation bar
  2. Added "dev:server" script to package.json -- runs `tsx --watch src/server.ts` for dev with Socket.IO
  3. Rewrote src/lib/socket/auth.ts -- uses `decode` from `next-auth/jwt` instead of plain `jwt.verify()`, handles JWE encryption, supports all NextAuth v5 cookie names
  4. Enhanced document-detail.tsx preview UX -- 90s polling timeout, distinct "generating" vs "failed" UI states, "Erneut pruefen" retry button
  5. Added POST /api/dokumente/[id]/preview -- manually re-triggers preview job via BullMQ queue

verification:
  - TypeScript: zero errors (npx tsc --noEmit)
  - ESLint: only pre-existing warning (unused 'router' variable)
  - No new imports or dependencies required
  - All changes are additive / non-breaking

files_changed:
  - src/app/(dashboard)/dokumente/[id]/bearbeiten/page.tsx (NEW)
  - src/lib/socket/auth.ts (rewritten)
  - src/components/dokumente/document-detail.tsx (enhanced preview UX)
  - src/app/api/dokumente/[id]/preview/route.ts (added POST handler)
  - package.json (added dev:server script)

## Round 2 — React Hydration + Preload Warnings (2026-02-27)

### New Symptoms
- React hydration errors #418, #425, #423 in browser console
- "preloaded using link preload but not used within a few seconds" warnings for ALL OnlyOffice editor types (word, cell, slide, visio)
- Socket.IO 404 (expected in dev mode — probe catches it)

### Root Causes

5. HYDRATION MISMATCH: `<link>` elements rendered server-side inside client component tree (children of SessionProvider/SocketProvider/etc.) get hoisted to `<head>` by the browser during HTML parsing. React hydration finds them missing from body → errors #418/#425/#423.

6. PRELOAD WARNINGS: The hidden iframe loading `preload.html` uses `<link rel="preload">` for ALL editor types (document, spreadsheet, presentation, visio). These resources are never consumed within the iframe's page context → browser warns for every single resource.

### Fix

Replaced server-rendered `<link>` + `<iframe>` elements with a new `OnlyOfficePreloader` client component:
- Renders `null` (no SSR output → no hydration mismatches)
- Creates dns-prefetch + preconnect + prefetch links in `useEffect` (client-only)
- Uses `<link rel="prefetch">` for api.js only — "prefetch" = "cache for future navigation" → no warnings
- Versioned resources (9.x.x-hash/...) loaded by api.js on editor open are cached by browser with long TTL due to content-hashed URLs

files_changed_round2:
  - src/components/onlyoffice-preloader.tsx (NEW)
  - src/app/(dashboard)/layout.tsx (replaced iframe+links with OnlyOfficePreloader)
