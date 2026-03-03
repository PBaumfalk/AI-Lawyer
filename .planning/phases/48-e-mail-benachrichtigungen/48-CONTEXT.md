# Phase 48: E-Mail-Benachrichtigungen - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Mandanten werden per E-Mail ueber relevante Ereignisse informiert: neue Nachricht vom Anwalt, neues freigegebenes Dokument, Sachstand-Update. E-Mails enthalten Deep-Link zum Portal und Kanzlei-Absender.

</domain>

<decisions>
## Implementation Decisions

### Trigger events
- MSG-04: New message from Anwalt in PORTAL channel → email to Mandant
- MSG-05: Document set to mandantSichtbar=true → email to Mandant
- MSG-06: AktenActivity with mandantSichtbar=true created → email to Mandant (excluding document events to avoid double-notification)

### Email content
- Deep-link to the relevant portal page (e.g., /portal/akten/{id}/nachrichten, /portal/akten/{id}/dokumente)
- Kanzlei-Absender (from SMTP_FROM or Kanzlei settings)
- Kanzlei name in email header/footer for branding
- Brief summary of the event (no sensitive case details in email body — just "Sie haben eine neue Nachricht" etc.)

### Claude's Discretion
- HTML email template vs plain text (trade-off: branding vs simplicity/deliverability)
- BullMQ job queue vs synchronous send (BullMQ preferred for resilience)
- Notification batching/throttling (e.g., max 1 email per 15 min per Mandant?)
- Whether to add an unsubscribe mechanism in v0.5 (DSGVO: einwilligungEmail on Kontakt already exists)
- Email subject line patterns (e.g., "[Kanzlei Baumfalk] Neue Nachricht zu Ihrem Verfahren")

</decisions>

<specifics>
## Specific Ideas

- Email should NOT contain case details or document names — just a prompt to log into the portal
- DSGVO: Kontakt.einwilligungEmail should be checked before sending portal emails
- Deep-links should work even if Mandant session expired (redirect to login, then to target page)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/email/send.ts`: sendEmail({to, subject, text, html}) — simple SMTP wrapper, silent fail if not configured
- `isEmailConfigured()`: Graceful degradation check
- BullMQ: Existing worker infrastructure for async job processing (email-send queue pattern from Frist reminders)
- Kontakt.einwilligungEmail: Boolean DSGVO gate for email consent

### Established Patterns
- Frist reminder emails: BullMQ cron → email send — similar pattern for portal notifications
- Non-blocking: Email failures should never block the triggering action (message send, document share)
- Audit: logAuditEvent() for email events

### Integration Points
- Message creation hook: After sendMessage() in PORTAL channel → trigger email job
- Document freigabe hook: After mandantSichtbar toggle → trigger email job
- AktenActivity creation: After creating mandantSichtbar=true activity → trigger email job
- BullMQ: New queue or extend existing notification queue

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 48-e-mail-benachrichtigungen*
*Context gathered: 2026-03-03*
