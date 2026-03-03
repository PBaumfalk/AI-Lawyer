# Phase 44: Portal-Authentifizierung - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Mandanten koennen sicher zum Portal eingeladen werden (Anwalt generiert Link), sich anmelden (Email+Passwort), eingeloggt bleiben (JWT), automatisch ausgeloggt werden (Inaktivitaet), und ihr Passwort zuruecksetzen. Jeder Beteiligter mit Rolle MANDANT kann separat eingeladen werden.

</domain>

<decisions>
## Implementation Decisions

### Invite flow
- Anwalt generates invite link from Akte-Detailseite for a specific Beteiligter with rolle=MANDANT
- Invite link sent via email (using existing sendEmail() from src/lib/email/send.ts)
- Mandant clicks link, sets password, account becomes active
- Auto-access: Once Kontakt has portal User, they see ALL Akten where Beteiligter(rolle=MANDANT) — no per-Akte invite

### Auth mechanism
- Reuse NextAuth JWT + Credentials pattern (existing in src/lib/auth.ts)
- MANDANT role added to UserRole in Phase 43
- Portal login page at /portal/login — separate from /login

### Session handling
- JWT session persists across browser refresh (same as internal app)
- Auto-logout after configurable inactivity period

### Password reset
- "Passwort vergessen" link on /portal/login
- Email with reset token, Mandant sets new password

### Claude's Discretion
- Invite token mechanism (signed JWT vs random DB token)
- Inactivity timeout duration (15min, 30min, 1h)
- Password complexity requirements
- Invite link expiration period
- Where exactly in Akte-Detail the invite button appears (Beteiligte section, detail panel, etc.)

</decisions>

<specifics>
## Specific Ideas

- Invite email should include Kanzlei name and case reference (Aktenzeichen) for context
- Login page should show Kanzlei branding (logo + name) consistent with portal layout

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/auth.ts`: Credentials provider with bcrypt, JWT callbacks — extend or add second provider
- `src/lib/email/send.ts`: `sendEmail()` with SMTP_* env vars, silent fail if not configured
- `src/lib/auth.ts`: `logAuditEvent("LOGIN_FEHLGESCHLAGEN")` pattern — reuse for portal audit
- Beteiligter model: rolle=MANDANT already in enum, @@unique([akteId, kontaktId, rolle]) constraint

### Established Patterns
- Password hashing: bcrypt with automatic salt (same as existing User creation)
- JWT stamping: `jwt` callback adds role + kanzleiId to token — extend with portal-specific claims
- Email: `isEmailConfigured()` check before sending — graceful degradation

### Integration Points
- Akte-Detail UI: Add invite button in Beteiligte section for Mandant-role participants
- `src/lib/auth.ts`: Extend authorize() to handle MANDANT logins (route to /portal/dashboard)
- Portal login page: /portal/login with Credentials form

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 44-portal-authentifizierung*
*Context gathered: 2026-03-03*
