# Codebase Structure

**Analysis Date:** 2026-03-06

## Top-Level Layout

```
AI-Lawyer/
├── src/
│   ├── app/                 # Next.js App Router (pages + API handlers)
│   ├── components/          # Feature UI + shadcn/ui primitives
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Domain services + integrations
│   ├── workers/             # Worker-only processors (non-queue)
│   ├── middleware.ts        # Next.js middleware
│   ├── server.ts            # Custom Next.js server + Socket.IO
│   └── worker.ts            # BullMQ worker entry
├── prisma/                  # Prisma schema + seed
├── public/                  # Static assets
├── scripts/                 # Build scripts (server/worker)
├── tests/                   # Vitest tests
├── docker-compose*.yml       # Multi-service stack
└── Dockerfile
```

---

## App Router (`src/app/`)

**Route Groups**
- `(auth)/login` – staff login
- `(dashboard)/...` – main staff UI (akten, dokumente, email, kalender, finanzen, helena, admin, etc.)
- `(portal)/portal/...` – authenticated mandant portal
- `(portal-public)/portal/...` – public portal onboarding/reset

**API Routes** (`src/app/api/**/route.ts`)
- Resource groups: `akten`, `dokumente`, `email`, `kalender`, `finanzen`, `helena`, `gamification`, `portal`, `admin`, `notifications`, `search`, `settings`, etc.

---

## Components (`src/components/`)

Feature-scoped UI, with shared primitives in `ui/`:
- `akten/`, `dokumente/`, `email/`, `kalender/`, `finanzen/`, `fristen/`
- `helena/` (AI chat + drafts)
- `portal/` (mandant UI)
- `messaging/`, `notifications/`, `search/`
- `layout/` (sidebar, header), `providers/` (session, theme, socket)

---

## Domain Services (`src/lib/`)

Key domains and infrastructure:
- **Auth/RBAC:** `auth.ts`, `auth.config.ts`, `rbac.ts`
- **DB/Infra:** `db.ts`, `redis.ts`, `storage.ts`, `meilisearch.ts`, `logger.ts`
- **AI:** `ai/`, `helena/` (agent, tools, pipelines)
- **Queues:** `queue/` (queue instances + processors)
- **Email:** `email/` (IMAP/SMTP + parsing)
- **Documents:** `ocr/`, `muster/`, `vorlagen.ts`, `onlyoffice.ts`
- **Cases/Contacts:** `kontakte/`, `falldaten/`, `aktenzeichen.ts`
- **Finance:** `finance/`, `sepa`, `e-invoice`
- **Portal:** `portal/`, `portal-access.ts`, `portal-session.ts`
- **Other:** `bea/`, `fristen/`, `gamification/`, `dsgvo/`, `notifications/`, `socket/`, `scanner/`, `urteile/`, `gesetze/`

---

## Worker (`src/worker.ts` + `src/workers/`)

- `src/worker.ts` registers BullMQ queue consumers and cron-style jobs
- `src/lib/queue/processors/` contains most processors (OCR, embedding, Helena, email, etc.)
- `src/workers/processors/` hosts special processors (e.g., frist reminder, scanner)

---

## Prisma (`prisma/`)

- `schema.prisma` – models, relations, enums
- `seed.ts` – seed data for dev/test

