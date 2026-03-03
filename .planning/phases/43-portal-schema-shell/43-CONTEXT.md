# Phase 43: Portal Schema + Shell - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Die technische Grundlage fuer das Mandantenportal: Prisma-Modelle fuer Mandant-Auth, /portal/* Route Group mit eigenem Glass Layout, und Middleware-Schutz. Kein Auth-Flow, nur Schema + Shell.

</domain>

<decisions>
## Implementation Decisions

### Data model
- Extend existing User model with MANDANT added to UserRole enum (no separate MandantUser model)
- Auto-access pattern: Once a Kontakt has a portal User, they automatically see ALL Akten where they are Beteiligter(rolle=MANDANT). No per-Akte invite needed.
- Add mandantSichtbar Boolean on AktenActivity (default per type, see Phase 45 context)

### Portal layout
- Slim sidebar navigation (sections: Meine Akten, Nachrichten, Dokumente, Profil)
- Same Glass look as internal app (mesh gradient background, glass-card/glass-panel tokens)
- Kanzlei name + logo from Briefkopf settings displayed in sidebar/header
- Portal layout is visually SEPARATE from internal dashboard (own sidebar, own header, no internal nav links)

### Middleware
- Add /portal/login to the NextAuth middleware bypass list
- Portal layout-level role check: only MANDANT role can access /portal/* (except /portal/login)
- Unauthenticated requests to /portal/* redirect to /portal/login (not /login)

### Claude's Discretion
- Kontakt.portalUserId FK vs User.kontaktId FK — pick based on Prisma schema conventions
- Invite token storage approach (fields on User vs separate InviteToken model)
- Dark mode toggle vs light-only for portal
- Specific sidebar items and layout proportions

</decisions>

<specifics>
## Specific Ideas

- Portal should feel premium and consistent with the internal Glass UI — same oklch tokens, same blur tiers
- Kanzlei branding (logo from Briefkopf) gives a white-label professional feel
- Portal has NO access to: Command Palette, Helena, Tickets, Kalender, Finanzen, Admin, beA — only Mandant-relevant features

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/auth.ts`: NextAuth Credentials provider with JWT strategy, `aktiv` gate, audit logging — add second Credentials provider for MANDANT or extend existing
- `src/app/globals.css`: All glass-* CSS classes (glass-card, glass-panel, glass-sidebar, glass-input) — reuse directly
- `src/app/(dashboard)/layout.tsx`: Reference for portal layout structure (SessionProvider > content shell)
- `prisma/schema.prisma`: User model (line ~393), UserRole enum (line ~14), Beteiligter model (line ~864), BeteiligterRolle.MANDANT already exists

### Established Patterns
- Route groups: `app/(dashboard)/` pattern for auth-guarded area — replicate as `app/(portal)/`
- Glass UI: oklch tokens, 4 blur tiers, mesh gradient body, `export const dynamic = "force-dynamic"`
- Middleware: `src/middleware.ts` — NextAuth `auth` export as middleware with matcher exclusion list

### Integration Points
- `src/middleware.ts`: Add /portal/login to bypass matcher
- `prisma/schema.prisma`: Add MANDANT to UserRole enum, add portal fields
- `src/lib/auth.ts`: Add MANDANT-aware authorize() or second Credentials provider

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 43-portal-schema-shell*
*Context gathered: 2026-03-03*
