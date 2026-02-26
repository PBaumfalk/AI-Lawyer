# Technology Stack

**Analysis Date:** 2025-02-24

## Languages

**Primary:**
- TypeScript 5.7.2 - All application code, type-safe development
- JavaScript - Configuration files, build scripts

**Secondary:**
- SQL - PostgreSQL queries via Prisma ORM
- Shell - Docker entrypoint scripts (`docker-entrypoint.sh`)

## Runtime

**Environment:**
- Node.js 18-alpine - Production runtime in Docker
- Node.js 18+ - Development

**Package Manager:**
- npm - Dependency management
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- Next.js 14.2.21 - Full-stack React framework with App Router
- React 18.3.1 - UI library
- TypeScript 5.7.2 - Type safety

**UI & Styling:**
- Tailwind CSS 3.4.17 - Utility-first CSS framework
- shadcn/ui - Component library (Radix UI + Tailwind)
- Radix UI components:
  - `@radix-ui/react-avatar` 1.1.2
  - `@radix-ui/react-dialog` 1.1.4
  - `@radix-ui/react-dropdown-menu` 2.1.4
  - `@radix-ui/react-scroll-area` 1.2.2
  - `@radix-ui/react-separator` 1.1.1
  - `@radix-ui/react-slot` 1.1.1
  - `@radix-ui/react-tooltip` 1.1.6
- lucide-react 0.468.0 - Icon library
- sonner 1.7.1 - Toast notifications
- cmdk 1.0.4 - Command palette/search

**Authentication:**
- next-auth 5.0.0-beta.25 - Session management and authentication
- @auth/prisma-adapter 2.7.4 - NextAuth + Prisma integration
- bcryptjs 2.4.3 - Password hashing

**Forms & Validation:**
- react-hook-form 7.54.1 - Form state management
- @hookform/resolvers 3.9.1 - Validation schema integration
- zod 3.23.8 - Schema validation library

**Document Editing:**
- @onlyoffice/document-editor-react 2.1.1 - Browser-based office document editor
- docxtemplater 3.68.2 - DOCX template processing
- pizzip 3.2.0 - ZIP file handling (dependency for docxtemplater)

**Date/Time:**
- date-fns 4.1.0 - Date utility functions
- date-fns-tz 3.2.0 - Timezone support

**Utilities:**
- clsx 2.1.1 - Conditional className merging
- tailwind-merge 2.6.0 - Tailwind CSS conflict resolution
- jsonwebtoken 9.0.3 - JWT signing/verification for ONLYOFFICE

**Testing (Dev):**
- (None configured yet - Framework ready for Vitest/Playwright)

**Build/Dev Tools (Dev):**
- eslint 8.57.1 - Code linting
- eslint-config-next 14.2.21 - Next.js ESLint rules
- autoprefixer 10.4.20 - PostCSS vendor prefixes
- postcss 8.4.49 - CSS transformations
- tsx 4.19.2 - TypeScript execution for scripts
- prisma 5.22.0 - ORM CLI and code generation

## Key Dependencies

**Critical:**
- @prisma/client 5.22.0 - Type-safe database client, manages all data access
- next-auth 5.0.0-beta.25 - Role-based access control (ADMIN, ANWALT, SACHBEARBEITER, SEKRETARIAT, PRAKTIKANT)
- meilisearch 0.55.0 - Full-text search across documents
- @onlyoffice/document-editor-react 2.1.1 - Browser-based WYSIWYG document editing

**Storage & Integration:**
- @aws-sdk/client-s3 3.995.0 - S3-compatible object storage (MinIO)
- @aws-sdk/s3-request-presigner 3.995.0 - Pre-signed URL generation for downloads
- @auth/prisma-adapter 2.7.4 - Session persistence via Prisma

**Crypto & Auth:**
- bcryptjs 2.4.3 - Secure password hashing
- jsonwebtoken 9.0.3 - JWT creation for ONLYOFFICE integration

**AI/LLM (Prepared):**
- No npm packages for LLM at present. Integration planned via:
  - Ollama API (REST calls, no SDK)
  - OpenAI/Anthropic (environment-configured, direct fetch calls)
  - LangChain.js/Vercel AI SDK (not yet added to dependencies)

## Configuration

**Environment:**
- Configured via `.env` file (not committed)
- `.env.example` provides required variables template
- Docker Compose overrides via environment sections

**Build:**
- `next.config.mjs` - Next.js configuration with:
  - Standalone output mode for efficient Docker builds
  - Security headers (X-Frame-Options: SAMEORIGIN)
  - CORS headers for ONLYOFFICE API endpoints
- `tsconfig.json` - TypeScript compiler options with path alias `@/*` → `./src/*`
- `.prettierrc` - Code formatting (if present, not found in repo root)

## Platform Requirements

**Development:**
- Node.js 18+
- PostgreSQL 16+ (for local dev)
- MinIO or S3-compatible storage
- Meilisearch instance
- ONLYOFFICE Document Server (Docker recommended)
- Optional: Ollama for local LLM

**Production:**
- Docker + Docker Compose
- PostgreSQL 16 with pgvector extension
- MinIO (or AWS S3)
- Meilisearch
- ONLYOFFICE Document Server
- Networking: Internal container communication via service names
- Deployment target: Self-hosted on-premise (Docker Compose)

## Docker Build

**Multi-stage Dockerfile:**
1. **deps stage**: Installs npm dependencies
2. **builder stage**: Compiles Next.js to standalone output, generates Prisma client
3. **runner stage**: Minimal production image with:
   - Non-root user (nodejs:1001)
   - Prisma schema + seeding support
   - Node 18-alpine base
   - Custom entrypoint (`docker-entrypoint.sh`) for:
     - Database readiness check
     - Schema synchronization (`prisma db push`)
     - Database seeding
     - Server startup

**Docker Compose Stack:**
- `app` (Next.js) - Port 3000
- `db` (PostgreSQL 16 with pgvector) - Port 5432
- `minio` (S3 storage) - Ports 9000/9001
- `meilisearch` - Port 7700
- `onlyoffice` - Port 8080
- Persistent volumes for data: `pgdata`, `miniodata`, `meilidata`, `onlyoffice_data`, `onlyoffice_log`
- Health checks on all services

---

*Stack analysis: 2025-02-24*
