# Phase 49: Portal Route Guard Fix + Sidebar Navigation - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Oeffentliche Portal-Seiten (Login, Aktivierung, Passwort-Reset) aus dem guarded (portal) Layout extrahieren, damit unauthentifizierte Nutzer darauf zugreifen koennen. Sidebar-Links zu nicht existierenden Seiten reparieren. Neue Profil-Seite erstellen.

</domain>

<decisions>
## Implementation Decisions

### Sidebar navigation
- Remove "Dokumente" link entirely — documents are accessed through Akte detail page, no aggregate view needed
- Keep "Nachrichten" link — /portal/nachrichten aggregate page already exists
- Final sidebar items: Meine Akten, Nachrichten, Profil (3 items)
- No unread/new-document badge indicators — email notifications are sufficient for MVP

### Profil page (/portal/profil)
- Password change form that requires current password for security
- Read-only contact info display: Name, Email, Telefon, Adresse (from linked Kontakt record)
- No Akten list on Profil page (already covered by "Meine Akten" in sidebar)
- No editable fields for contact info — Kanzlei maintains data authority over Kontakt records

### Claude's Discretion
- Route group restructuring approach (separate (portal-public) group vs conditional layout vs route-level checks)
- Redirect behavior for authenticated MANDANT on public pages (login → dashboard)
- Error handling for expired/invalid activation tokens
- Profil page layout and styling details
- Password validation requirements (min length, complexity)

</decisions>

<specifics>
## Specific Ideas

- Profil page should feel consistent with other portal pages — Glass UI, same card patterns
- Contact info section should clearly indicate "read-only" nature (no edit buttons, muted text or info note)
- Password change should provide clear success/error feedback

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app/(portal)/layout.tsx`: Current guarded layout with auth check (line 19) — needs restructuring
- `src/components/portal/portal-sidebar.tsx`: Sidebar with navItems array (line 21-26) — remove Dokumente entry
- `src/middleware.ts`: Already bypasses portal public pages in matcher (line 6)
- `src/lib/auth.ts`: bcrypt password hashing and JWT callbacks — reuse for password change API
- Glass UI tokens: glass-card, glass-panel, glass-input classes available for Profil page

### Established Patterns
- Route groups: `(dashboard)` for internal, `(portal)` for Mandant — add `(portal-public)` or restructure
- Portal API routes: `/api/portal/*` pattern with MANDANT role checks
- Server components: Portal pages use direct Prisma queries (no redundant API fetch from server)
- Kontakt model linked via User.kontaktId FK (decided in Phase 43)

### Integration Points
- `src/app/(portal)/layout.tsx`: Auth guard needs to NOT wrap public pages
- `src/components/portal/portal-sidebar.tsx`: Remove Dokumente nav item
- New page: `src/app/(portal)/profil/page.tsx` with password change + contact display
- New API: `/api/portal/password-change` with current password verification

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 49-portal-route-guard-fix*
*Context gathered: 2026-03-03*
