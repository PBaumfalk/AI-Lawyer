# Stack

## Overview
- **Product**: AI-first Kanzleisoftware (self-hosted, browser-based)
- **Monorepo**: Single Next.js app + custom server + worker
- **Primary language**: TypeScript

## Runtime & Frameworks
- **Frontend**: Next.js 14 (App Router), React 18, TailwindCSS, Radix UI, shadcn/ui
- **Backend**: Next.js API routes + custom Node server (Socket.IO)
- **Workers**: BullMQ worker (tsx build → dist-worker)
- **Auth**: NextAuth.js v5 + Prisma adapter

## Data & Search
- **DB**: PostgreSQL 16
- **ORM**: Prisma (pgvector extensions enabled)
- **Vector store**: pgvector (embeddings in Postgres)
- **Search**: Meilisearch

## Document & File Handling
- **Object storage**: MinIO (S3-compatible)
- **Office editing**: OnlyOffice Document Server
- **PDF/OCR**: Stirling-PDF (Tesseract), pdf-lib, pdf-parse
- **Templates**: Docxtemplater, PizZip

## AI / LLM
- **SDK**: Vercel AI SDK v4
- **Providers**: OpenAI, Anthropic, Ollama
- **RAG**: LangChain text splitters + pgvector embeddings

## Messaging & Realtime
- **Realtime**: Socket.IO
- **Queues**: BullMQ + Redis 7
- **Redis**: BullMQ, Socket.IO adapter/emitter

## Email
- **IMAP**: ImapFlow
- **SMTP**: Nodemailer
- **Parsing**: Mailparser

## Infra / Deployment
- **Docker Compose**: app, worker, postgres+pgvector, redis, minio, meilisearch, onlyoffice, stirling-pdf, ollama (+ optional languagetool)
- **Logs**: Pino (+ pino-roll)
- **Testing**: Vitest
