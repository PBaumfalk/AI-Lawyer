# Phase 7: Rollen/Sicherheit + Compliance + Observability - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Enforce fine-grained RBAC across all existing features (Akten, Dokumente, Finanzen, beA, KI), provide full audit trail visibility for administrators, implement DSGVO compliance (anonymization workflow, Auskunftsrecht export), and make the system observable with health checks and structured logging. This phase applies security and compliance rules to all features built in Phases 1-6 — no new user-facing features are added.

</domain>

<decisions>
## Implementation Decisions

### Access Denial & Visibility
- 404 Not Found on unauthorized Akte access (hide existence entirely)
- Lists/search only show authorized Akten (no lock icons, no visibility of restricted items)
- Rollenbasierte Sidebar: navigation items hidden for roles without access (PRAKTIKANT sees no Einstellungen, no Admin)
- Finanzdaten visible for all roles with Akte access (no separate finance RBAC)

### Dezernate/Gruppen Structure
- Dezernat as real DB entity in Prisma (not tag-based): Name, Mitglieder (Users), zugewiesene Akten
- Admin manages Dezernate in Einstellungen
- Akte access: personal assignment OR Dezernat membership OR explicit Admin-Override

### Admin Override
- Explicit "Zugriff uebernehmen" button (not automatic visibility)
- Admin-Override logged in Audit-Trail with timestamp and reason
- Override grants temporary access to specific Akte

### Role Permissions (Fixed Matrix — No Feature Flags)
- **ADMIN**: Full access to everything, explicit override for restricted Akten
- **ANWALT**: Full access to assigned Akten + Dezernate, beA send + eEB, KI features
- **SACHBEARBEITER**: Full access to assigned Akten + Dezernate, beA read-only, KI features
- **SEKRETARIAT**: Like SACHBEARBEITER but NO Freigeben, NO Loeschen (documents, Akten)
- **PRAKTIKANT**: Read-only + create Entwuerfe on assigned Akten (via direct assignment or Dezernat), NO KI features, NO beA
- beA: SACHBEARBEITER+ can read, only ANWALT can send/eEB

### PRAKTIKANT Assignment
- Both paths: direct Beteiligte assignment to Akte OR Dezernat membership
- Dezernat gives read access to all Akten in that Dezernat

### Enforcement Architecture
- Middleware for authentication check + role extraction
- requireRole() / requireAkteAccess() helper functions in API routes for granular checks
- Permission changes take effect immediately (live, not after re-login)

### Admin Permission Tooling
- Rollen-Matrix table in Einstellungen: rows = roles, columns = actions (read-only display)
- Per-User permission overview: shows all accessible Akten with access source (direkt, Dezernat, Admin-Override)

### Audit-Trail Presentation
- System-wide: Timeline/Activity Stream format (not table) — "Max Mustermann hat Akte 123/2026 geoeffnet" with avatars and grouping
- All events logged including read access (Akte geoeffnet, Dokument angesehen) — comprehensive tracking
- Per-Akte: dedicated 'Historie' tab on Akte detail page
- Vorher/Nachher Diff for changed fields ("Status: OFFEN -> ARCHIVIERT")
- 10 Jahre Aufbewahrung (BRAO/GoBD), archiving of older entries
- Export: CSV + PDF for Behoerdenanfragen and internal audits
- Security section: highlighted failed logins, brute-force detection, unusual access patterns (red markers)
- Admin Dashboard widget: last 5-10 activities with link to full Audit-Trail

### DSGVO Compliance
- NEVER delete data — anonymization only (personenbezogene Daten replaced with "Geloeschter Mandant" etc.)
- 10-year retention period (Aufbewahrungspflicht) before anonymization can be requested
- Auskunftsrecht: PDF export per person — all stored data (Kontaktdaten, Akten, Dokumente, E-Mails, Kalender, Buchungen)
- No Einwilligungsmanagement needed for v1 (processing based on Mandatsvertrag, Art. 6 Abs. 1 lit. b DSGVO)
- No Verarbeitungsverzeichnis in the software (maintained externally)

### Observability
- Extend existing Admin System Health page (from Phase 1) with all Docker services: App, Worker, Redis, PostgreSQL, MinIO, Meilisearch, Ollama, OnlyOffice, Stirling-PDF — Statusampel per service
- Public /api/health endpoint (unauthenticated): basic status (ok/degraded/down); detailed info only with admin auth
- Structured logging: JSON Lines on stdout — standard for Docker, parsable with jq/Loki
- E-Mail alert to admins on service failure (using existing email system, with cooldown to prevent spam)

### Claude's Discretion
- Exact Dezernat UI design in Einstellungen
- Audit-Trail pagination/infinite-scroll strategy for large datasets
- JSON Lines logger implementation (Pino vs custom)
- Anonymization field-by-field strategy (which fields get anonymized, which kept)
- Security event detection thresholds (how many failed logins = suspicious)
- Health check polling interval
- Dashboard widget design

</decisions>

<specifics>
## Specific Ideas

- "Ich habe eine zehnjaehrige Aufbewahrungspflicht. Das Loeschrecht kann erst danach geltend gemacht werden. Wir loeschen NIE sondern anonymisieren."
- Rollen-Matrix as read-only reference table — permissions are code-defined, not configurable per admin
- Admin-Override must be explicit and audited, never silent/automatic
- Timeline/Activity Stream feel for audit (like GitHub activity feed), not a dry log table

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-rollen-sicherheit-compliance-observability*
*Context gathered: 2026-02-25*
