---
phase: 03-email-client
verified: 2026-02-24T15:30:00Z
status: passed
score: 18/18 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Navigate to /email and confirm three-pane layout renders with draggable resize handles"
    expected: "Folder tree (left), email list (center), email detail (right) visible and resizable"
    why_human: "Layout rendering and resize handle drag behavior cannot be verified by grep"
  - test: "Press J and K with focus outside input fields while on /email"
    expected: "Email selection moves to next/previous email in list"
    why_human: "Keyboard event behavior requires runtime DOM interaction"
  - test: "Click Verakten on any email, verify slide-over opens with auto-suggested Akten"
    expected: "VeraktungPanel opens from the right, showing confidence-ranked Akte suggestions and attachment checkboxes"
    why_human: "Sheet component open/close state and populated suggestions require runtime verification"
  - test: "Click Senden in compose popup, verify 10-second undo toast appears and can be cancelled"
    expected: "Sonner toast shows countdown, clicking Rueckgaengig cancels the BullMQ job and sets status to ENTWURF"
    why_human: "Toast UI with live countdown and BullMQ cancel require runtime and queue inspection"
  - test: "Navigate to /einstellungen/email as ADMIN and test a connection"
    expected: "Step-by-step IMAP/SMTP feedback shows each phase (connect, auth, list folders, SMTP verify)"
    why_human: "Live connection test step UI requires a real mail server and browser interaction"
  - test: "Navigate to an Akte detail page, click the E-Mails tab"
    expected: "AkteEmailTab renders chronological list of all veraktete emails for that case"
    why_human: "Tab rendering and filtered email list display require runtime and real data"
---

# Phase 3: Email Client Verification Report

**Phase Goal:** Law firm staff can receive, read, compose, and send emails directly within the application, with real-time notifications for incoming mail, and can assign any email to a case file (Veraktung) with one click -- the primary daily workflow entry point.
**Verified:** 2026-02-24T15:30:00Z
**Status:** PASSED
**Re-verification:** No -- initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | New Prisma models (EmailKonto, EmailOrdner, EmailNachricht, EmailAnhang, EmailVeraktung, EmailKontoZuweisung) exist in schema | VERIFIED | `grep "model Email" prisma/schema.prisma` returns all 6 at lines 1036, 1076, 1089, 1110, 1175, 1190 |
| 2 | IMAP connection manager connects to configured mailboxes and enters IDLE mode in the worker process | VERIFIED | `connection-manager.ts` (409 lines) has `startImapConnection()` with ImapFlow IDLE via `on("exists")` at line 94; worker.ts calls `startImapConnections()` at line 294 |
| 3 | Initial email sync downloads existing emails from IMAP server into local database | VERIFIED | `sync.ts` `syncMailbox()` calls `prisma.emailNachricht.create()` at line 139; `initialSync()` exported and called from `connection-manager.ts` at line 177 |
| 4 | IMAP IDLE detects new emails and triggers incremental sync | VERIFIED | `connection-manager.ts` line 94: `client.on("exists", ...)` calls `syncMailbox()` with `since` filter at line 111 |
| 5 | Reconnection with exponential backoff recovers from dropped IMAP connections | VERIFIED | `connection-manager.ts` line 147: `client.on("close", ...)` calls `scheduleReconnect()`; failCount tracking at lines 87, 200, 229; base=5s, max=300s constants at lines 26-27 |
| 6 | Email API routes return emails with pagination, filtering, and detail view | VERIFIED | `emails/route.ts`: cursor-based pagination at lines 29-30, 120-125; filters for kontoId/ordnerId/gelesen/veraktet/akteId at lines 21-64; access control via EmailKontoZuweisung at lines 37-41 |
| 7 | Mailbox configuration CRUD allows admins to add/edit/delete email accounts | VERIFIED | `email-konten/route.ts`: ADMIN check at line 83; POST creates with `encryptCredential()` at line 105; `email-konten/[id]/route.ts` handles GET/PATCH/DELETE |
| 8 | SMTP send queue accepts outgoing emails with 10-second undo delay | VERIFIED | `email-send/route.ts`: `delay = 10_000` at line 75; `emailSendQueue.add()` at line 117; cancel via `email-send/cancel/route.ts` |
| 9 | Email credentials are encrypted at rest with AES-256-GCM | VERIFIED | `crypto.ts` (81 lines): `encryptCredential()` / `decryptCredential()` using AES-256-GCM with scryptSync key derivation |
| 10 | User sees three-pane layout (folder tree, email list, email detail) all resizable | VERIFIED | `inbox-layout.tsx` (147 lines): `<FolderTree>` at line 82, `<EmailList>` at line 97, `<EmailDetail>` at line 120; react-resizable-panels v4 Group/Panel/Separator |
| 11 | Email list virtualizes rows with infinite scroll and filter bar | VERIFIED | `email-list.tsx` (322 lines): `useVirtualizer` at line 4+135; `fetch("/api/emails?...")` at line 85; `email-filters.tsx` renders above list |
| 12 | Email detail renders sanitized HTML body safely with XSS protection | VERIFIED | `email-html-body.tsx` (74 lines): DOMPurify import at line 4, `DOMPurify.sanitize()` at line 21, `dangerouslySetInnerHTML` at line 70 |
| 13 | Reply/forward opens inline below original email body (not in compose popup) | VERIFIED | `email-detail.tsx` line 548: `<EmailInlineReply>` conditionally rendered; `email-inline-reply.tsx` (448 lines) confirmed |
| 14 | Compose popup sends new emails via BullMQ queue with 10-second undo | VERIFIED | `compose-popup.tsx` (682 lines): `fetch("/api/email-send", ...)` at line 203; undo via `fetch("/api/email-send/cancel", ...)` at line 314 |
| 15 | User can assign email to case (Veraktung) via slide-over panel with auto-suggest | VERIFIED | `veraktung-panel.tsx` (651 lines): fetches suggestions at line 136; POSTs to `/api/emails/${emailId}/veraktung` at line 267; confidence color coding at lines 61-70; one-click quick veraktung at line 315 |
| 16 | Veraktung is reversible and copies attachments to DMS | VERIFIED | `veraktung.ts`: `hebeVeraktungAuf()` at line 268 sets aufgehoben=true and manages veraktet flag; `verakteEmail()` calls `uploadFile()` to copy attachments to DMS at line 232 |
| 17 | Akte detail page has E-Mails tab showing all veraktete emails | VERIFIED | `akte-email-tab.tsx` (232 lines): fetches `GET /api/emails?akteId=${akteId}&veraktet=true` at line 51; `akte-detail-tabs.tsx` imports and renders `AkteEmailTab` at lines 34+337 |
| 18 | Ticket can be created from email with pre-filled data | VERIFIED | `emails/[id]/ticket/route.ts`: POST at line 11 pre-fills from email fields, creates Ticket, logs audit at line 96; `ticket-from-email-dialog.tsx` created |

**Score:** 18/18 truths verified

---

## Required Artifacts

| Artifact | Min Lines | Actual Lines | Status | Details |
|----------|-----------|--------------|--------|---------|
| `prisma/schema.prisma` | n/a | 1200+ | VERIFIED | All 6 models: EmailKonto (1036), EmailKontoZuweisung (1076), EmailOrdner (1089), EmailNachricht (1110), EmailAnhang (1175), EmailVeraktung (1190) |
| `src/lib/email/crypto.ts` | n/a | 81 | VERIFIED | Exports `encryptCredential`, `decryptCredential` with AES-256-GCM |
| `src/lib/email/imap/connection-manager.ts` | n/a | 409 | VERIFIED | Exports `startImapConnection`, `stopImapConnection`, `stopAllConnections`, `startImapConnections` |
| `src/lib/email/imap/sync.ts` | n/a | 351 | VERIFIED | Exports `syncMailbox`, `syncNewMessages` (stub - see notes), `initialSync` |
| `src/app/api/emails/route.ts` | n/a | 150+ | VERIFIED | GET with cursor pagination, filters, access control |
| `src/app/api/email-konten/route.ts` | n/a | 120+ | VERIFIED | GET/POST with ADMIN enforcement, credential encryption |
| `src/components/email/inbox-layout.tsx` | 40 | 147 | VERIFIED | Three-pane resizable layout renders FolderTree, EmailList, EmailDetail |
| `src/components/email/folder-tree.tsx` | 60 | 335 | VERIFIED | Socket.IO `email:folder-update` listener at line 151-156; unread count badges |
| `src/components/email/email-list.tsx` | 80 | 322 | VERIFIED | useVirtualizer, infinite scroll, checkbox bulk actions |
| `src/components/email/email-detail.tsx` | 100 | 612 | VERIFIED | Fetches full email, auto-mark-read, EmailInlineReply, attachment strip, Veraktung info |
| `src/components/email/email-html-body.tsx` | 20 | 74 | VERIFIED | DOMPurify sanitization with dangerouslySetInnerHTML |
| `src/components/email/email-inline-reply.tsx` | 80 | 448 | VERIFIED | Inline reply/forward with pre-filled recipients, editor, quoted text |
| `src/components/email/compose-popup.tsx` | 100 | 682 | VERIFIED | Floating popup, TipTap editor, recipient auto-complete, send with undo |
| `src/components/email/compose-editor.tsx` | 60 | 106 | VERIFIED | TipTap with StarterKit, Link, Image, Table, Color, TextStyle |
| `src/components/email/mailbox-config/mailbox-form.tsx` | 100 | 488 | VERIFIED | Add/edit mailbox with Zod validation, POSTs to `/api/email-konten` |
| `src/components/email/mailbox-config/signature-editor.tsx` | 60 | 251 | VERIFIED | TipTap HTML signature editor with placeholder chips |
| `src/lib/email/signature.ts` | n/a | 71 | VERIFIED | Exports `renderSignature`, `getSignatureForUser`; reads `signaturVorlage` from EmailKonto at line 45 |
| `src/components/email/veraktung-panel.tsx` | 120 | 651 | VERIFIED | Suggestions, Akte search, attachment checkboxes, DMS folder, notes, one-click quick veraktung |
| `src/lib/email/veraktung.ts` | n/a | 326 | VERIFIED | Exports `suggestAktenForEmail`, `verakteEmail`, `hebeVeraktungAuf` |
| `src/app/api/emails/[id]/veraktung/route.ts` | n/a | 200+ | VERIFIED | Exports GET, POST, DELETE with audit logging |
| `src/app/api/emails/[id]/ticket/route.ts` | n/a | 110+ | VERIFIED | Exports POST; creates Ticket with pre-filled data; audit logging |
| `src/components/email/akte-email-tab.tsx` | 40 | 232 | VERIFIED | Fetches `/api/emails?akteId=...&veraktet=true`; Veraktung aufheben per row |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/worker.ts` | `src/lib/email/imap/connection-manager.ts` | `startImapConnections()` called at worker startup | WIRED | Line 9: import; line 294: `await startImapConnections()` |
| `src/lib/email/imap/connection-manager.ts` | `src/lib/email/imap/sync.ts` | IDLE exists event triggers `syncMailbox()` | WIRED | Line 111: `syncMailbox(client, konto.id, data.path, since)` -- uses `syncMailbox` not `syncNewMessages` (see notes) |
| `src/lib/email/imap/sync.ts` | `prisma.emailNachricht.create` | Parsed emails stored in database | WIRED | Line 139: `prisma.emailNachricht.create({...})` |
| `src/app/api/email-send/route.ts` | `src/lib/queue/queues.ts` | BullMQ `emailSendQueue.add()` with delay | WIRED | Line 117: `emailSendQueue.add(...)` with `delay = 10_000` |
| `src/lib/email/imap/connection-manager.ts` | Socket.IO | `email:folder-update` event emitted to mailbox room | WIRED | Line 128: `getSocketEmitter().to(...).emit("email:folder-update", {...})` |
| `src/components/email/folder-tree.tsx` | Socket.IO | Listens for `email:folder-update` to update unread counts | WIRED | Lines 151-156: socket listener for `email:folder-update` |
| `src/components/email/inbox-layout.tsx` | `src/components/email/folder-tree.tsx` | Left panel renders FolderTree | WIRED | Line 82: `<FolderTree ...>` |
| `src/components/email/inbox-layout.tsx` | `src/components/email/email-list.tsx` | Center panel renders EmailList | WIRED | Line 97: `<EmailList ...>` |
| `src/components/email/inbox-layout.tsx` | `src/components/email/email-detail.tsx` | Right panel renders EmailDetail | WIRED | Line 120: `<EmailDetail ...>` |
| `src/components/email/email-list.tsx` | `/api/emails` | Fetches email list from API | WIRED | Line 85: `fetch("/api/emails?${params}")` |
| `src/components/email/email-detail.tsx` | `/api/emails/[id]` | Fetches full email detail | WIRED | Line 105: `fetch("/api/emails/${emailId}")` |
| `src/components/email/email-detail.tsx` | `src/components/email/email-inline-reply.tsx` | Reply/forward expands inline compose | WIRED | Line 548: `<EmailInlineReply ...>` |
| `src/components/email/compose-popup.tsx` | `/api/email-send` | POST to queue outgoing email | WIRED | Line 203: `fetch("/api/email-send", {...})` |
| `src/components/email/compose-popup.tsx` | `src/components/email/compose-editor.tsx` | Embeds TipTap editor for body | WIRED | Line 556: `<ComposeEditor ...>` |
| `src/components/email/mailbox-config/mailbox-form.tsx` | `/api/email-konten` | POST/PATCH to create or update mailbox | WIRED | Lines 64, 129-130: `fetch("/api/email-konten/...")` |
| `src/lib/email/signature.ts` | `prisma.emailKonto` | Load signature template via `signaturVorlage` | WIRED | Line 45: `select: { signaturVorlage: true }` |
| `src/components/email/veraktung-panel.tsx` | `src/lib/email/veraktung.ts` | `suggestAktenForEmail()` for auto-suggestions | WIRED | Line 136: fetches `/api/emails/${emailIds[0]}/veraktung?suggest=true` (server-side call) |
| `src/components/email/veraktung-panel.tsx` | `/api/emails/[id]/veraktung` | POST to create Veraktung | WIRED | Line 267: `fetch("/api/emails/${emailId}/veraktung", ...)` |
| `src/lib/email/veraktung.ts` | `src/lib/storage.ts` | `uploadFile()` to transfer attachments to DMS | WIRED | Line 7: import; line 232: `await uploadFile(dmsKey, buffer, ...)` |
| `src/components/email/akte-email-tab.tsx` | `/api/emails` | GET with akteId filter | WIRED | Line 51: `fetch("/api/emails?akteId=${akteId}&veraktet=true&limit=50")` |
| `src/components/akten/akte-detail-tabs.tsx` | `src/components/email/akte-email-tab.tsx` | Akte E-Mail tab uses AkteEmailTab | WIRED | Line 34: import; line 337: `<AkteEmailTab akteId={akte.id} />` |
| `src/components/email/inbox-layout.tsx` | `src/components/email/veraktung-panel.tsx` | Verakten button opens panel | WIRED | Lines 12-13: imports; lines 130-138: `<VeraktungPanel ...>` |

---

## Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| REQ-EM-001 | 03-01 | IMAP-Sync mit Real-Time (IMAP IDLE) fur eingehende E-Mails | SATISFIED | `connection-manager.ts` maintains ImapFlow per mailbox with `on("exists")` IDLE handler; worker runs `startImapConnections()` |
| REQ-EM-002 | 03-01, 03-03 | Shared Kanzlei-Postfach + per-User Mailboxen | SATISFIED | `EmailKonto.istKanzlei` field; `EmailKontoZuweisung` join table for per-user assignment; admin settings page for configuration |
| REQ-EM-003 | 03-02 | Inbox-Seite (Liste, Pagination, Filter: veraktet/unveraktet, Akte, Verantwortlicher) | SATISFIED | `/email` page with three-pane layout; `email-filters.tsx` with status/veraktet/akte/verantwortlicher filters; cursor-based pagination |
| REQ-EM-004 | 03-02 | E-Mail-Detailansicht (Header, Body, Anhange) | SATISFIED | `email-detail.tsx` renders header, DOMPurify-sanitized HTML body, attachment strip with presigned URLs |
| REQ-EM-005 | 03-04 | E-Mail verakten (Akte zuordnen, Anhange ins DMS) | SATISFIED | `veraktung-panel.tsx` with auto-suggest (thread/contact/Aktenzeichen); `verakteEmail()` copies attachments to DMS; one-click for high-confidence |
| REQ-EM-006 | 03-03 | Compose-View (An, CC, BCC, Betreff, Rich-Text, Akte-Verknupfung, Dateianhang aus DMS) | SATISFIED | `compose-popup.tsx` with TipTap editor, ComposeRecipients, ComposeAttachments (drag-drop + Aus Akte), Akte typeahead |
| REQ-EM-007 | 03-04 | Ticket aus E-Mail erstellen (Prefill Titel/Beschreibung) | SATISFIED | `ticket-from-email-dialog.tsx` + `/api/emails/[id]/ticket` POST pre-fills title/description/akteId from email data |
| REQ-EM-008 | 03-04 | Akte: Tab "E-Mails" (veraktete Mails der Akte) | SATISFIED | `akte-email-tab.tsx` renders chronological list at `/akten/[id]/emails`; integrated into `akte-detail-tabs.tsx` |

**All 8 REQ-EM requirements are SATISFIED. No orphaned requirements.**

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/email/imap/sync.ts` | 276 | `syncNewMessages()` returns stub result `{ newMessages: 0, ...}` with comment "placeholder; the actual call happens in connection-manager" | INFO | No functional impact -- `connection-manager.ts` correctly calls `syncMailbox()` directly on the IDLE event, bypassing this function. The exported `syncNewMessages` is dead code that is never imported or called. |

**Severity assessment:** The `syncNewMessages` stub is INFO-level only. The actual incremental sync works correctly because `connection-manager.ts` calls `syncMailbox()` with the live ImapFlow client and a `since` date filter when the IDLE `exists` event fires (line 111). The exported `syncNewMessages` function cannot do the real work anyway, as it lacks access to the ImapFlow client -- the design correctly centralizes this in the connection manager. The stub could mislead future developers but does not block any functionality.

---

## Human Verification Required

### 1. Three-Pane Layout Rendering

**Test:** Navigate to /email in the browser
**Expected:** Folder tree (left pane ~20%), email list (center ~35%), email detail (right ~45%) are visible; drag the resize handle between panes to verify they resize
**Why human:** React component rendering and drag behavior cannot be verified statically

### 2. Gmail-Style Keyboard Shortcuts

**Test:** On /email with an email selected, press J (next) and K (previous), R (reply), V (verakten), E (archive)
**Expected:** J/K move selection between emails, R opens inline reply, V opens Veraktung slide-over, E archives the email
**Why human:** Keyboard event dispatch and DOM query behavior require runtime

### 3. Real-Time Unread Count via Socket.IO

**Test:** With an active IMAP connection configured, send an email to the configured mailbox while /email is open
**Expected:** Folder tree unread count badge increments in real time without page refresh
**Why human:** Requires live IMAP server + Socket.IO active connection

### 4. Veraktung Slide-Over with Auto-Suggest

**Test:** Click "Verakten" on an email from a known Mandant email address or with an Aktenzeichen in the subject
**Expected:** VeraktungPanel opens, shows auto-suggested Akten with hoch/mittel/niedrig confidence badges and one-click verakten button for high-confidence match
**Why human:** Auto-suggest quality and Sheet component open state require runtime with real data

### 5. Compose Send with 10-Second Undo

**Test:** Open compose popup (floating bottom-right), fill in recipient/subject/body, click Senden
**Expected:** Sonner toast appears with "E-Mail wird in 10s gesendet -- Rueckgaengig" countdown; clicking Rueckgaengig cancels the job
**Why human:** Toast countdown animation and BullMQ job cancellation require runtime

### 6. Akte E-Mails Tab

**Test:** Navigate to an Akte with veraktete emails, click the E-Mails tab
**Expected:** Chronological list of emails assigned to the case, each row showing sender/subject/date/preview; Veraktung aufheben button visible per row
**Why human:** Tab navigation and populated email list require runtime with real data

---

## Notes on Key Discrepancies

### syncNewMessages Naming Discrepancy

The PLAN frontmatter key_link specifies: `"IDLE exists event triggers syncNewMessages()"`. In the actual implementation, `connection-manager.ts` calls `syncMailbox()` directly (line 111), not `syncNewMessages()`. The `syncNewMessages` export in `sync.ts` is a stub that returns zero results.

**Assessment:** This is NOT a gap. The behavior is functionally equivalent and architecturally correct: `syncMailbox()` performs the incremental sync with a `since` date filter, which is exactly what `syncNewMessages` was intended to do. The naming in the plan was aspirational; the implementation chose a more direct approach that avoids passing the client through the function signature.

### Veraktung Panel: suggestAktenForEmail Not Called Client-Side

The PLAN key_link specifies `veraktung-panel.tsx` calling `suggestAktenForEmail()` directly. In reality, the panel fetches suggestions via `GET /api/emails/${emailId}/veraktung?suggest=true`, which calls `suggestAktenForEmail()` server-side. This is the correct architectural pattern for a Next.js app (API route wraps the library function) and does not reduce functionality.

---

## Gaps Summary

No gaps were found. All 18 observable truths verified. All artifacts exist with substantive content above minimum line counts. All key links confirmed wired. All 8 REQ-EM requirements satisfied. The only anti-pattern (syncNewMessages stub) is INFO-level with no functional impact.

---

_Verified: 2026-02-24T15:30:00Z_
_Verifier: Claude (gsd-verifier)_
