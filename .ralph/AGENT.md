# @AGENT.md – Build & Run Instructions

## Voraussetzungen

- Node.js 20+
- Docker & Docker Compose
- Git

## Setup

```bash
# Dependencies installieren
npm install

# Docker-Services starten (DB, MinIO, Meilisearch)
docker compose up -d

# Prisma-Schema synchronisieren
npx prisma migrate dev

# Seed-Daten laden (Admin-User, Beispielakte)
npx prisma db seed

# Dev-Server starten
npm run dev