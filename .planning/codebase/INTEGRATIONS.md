# Integrations

## Core Infrastructure
- **PostgreSQL 16** (primary DB) with **pgvector** extension for embeddings
- **Redis 7** (BullMQ queues, Socket.IO adapter)
- **MinIO** (S3-compatible object storage for documents, templates, previews)
- **Meilisearch** (full-text search & indexing)

## Document Editing & Processing
- **OnlyOffice Document Server** (browser-based DOCX/XLSX/PPTX editing + conversion)
- **Stirling-PDF** (OCR + conversion; Tesseract de/eng)

## AI / LLM Providers
- **Ollama** (local LLM inference)
- **OpenAI** (via Vercel AI SDK)
- **Anthropic** (via Vercel AI SDK)

## Email & Messaging
- **IMAP** (ImapFlow) for mailbox sync
- **SMTP** (Nodemailer) for outbound mail
- **Mailparser** for MIME parsing
- **Socket.IO** realtime channels (internes Messaging/Portal)

## Legal/Domain Specific
- **beA** (besonderes elektronisches Anwaltspostfach): message sync/send, eEB handling, auto-assign
- **e-invoice**: XRechnung (via @e-invoice-eu/core)
- **SEPA**: SEPA export (via sepa lib)

## Optional / Dev
- **LanguageTool** (optional docker profile: text checking)
- **Bull Board** (BullMQ UI via @bull-board/hono)
- **AWS S3 SDK** (presigned URLs / S3-compatible APIs)
