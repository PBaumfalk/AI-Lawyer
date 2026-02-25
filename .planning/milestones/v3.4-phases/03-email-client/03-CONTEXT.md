# Phase 3: Email Client - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Full email integration for a law firm: IMAP IDLE real-time sync, three-pane Inbox UI with conversation threading, email composing/sending via SMTP with BullMQ queue, Veraktung (assigning emails to case files with attachment transfer), and Ticket creation from emails. Shared Kanzlei mailbox + per-user mailboxes.

</domain>

<decisions>
## Implementation Decisions

### Inbox Layout
- Three-pane layout: folder tree (left), email list (center), detail pane (right)
- All three panes resizable via draggable dividers, positions saved per user
- Conversation threading: emails grouped by In-Reply-To/subject
- Email row shows: sender, subject, date/time, preview snippet (~80 chars), Veraktung badge (Aktenzeichen + light background tint), attachment paperclip icon
- Filter bar above email list: dropdowns for Status (Alle/Veraktet/Unveraktet), Akte, Verantwortlicher + toggle "Nur ungelesene"
- Search bar in list header for full-text email search within selected mailbox/folder
- Multiple sort options: date, sender, subject, Akte (dropdown in list header)
- Infinite scroll with virtualized list rendering
- Folder tree grouped by mailbox (each mailbox collapsible with IMAP folders: Inbox, Sent, Drafts, Trash, Junk, Archive, custom)
- Unread counts per folder in tree

### Email Detail
- Sanitized HTML rendering with XSS protection (sanitize-html)
- Attachment strip below email header: horizontal strip with file icons/thumbnails, name + size, click to download, PDF/image preview on hover
- Action bar at top of detail pane: Antworten, Allen antworten, Weiterleiten, Verakten, Ticket erstellen, Archivieren, Spam, Loeschen
- Reply/forward opens inline in detail pane (compose area below original email)
- Veraktungs-Empfehlung: when replying/forwarding an unveraktete email, show yellow banner "Diese E-Mail ist nicht veraktet — Jetzt verakten?" with quick-action button

### Email Actions
- Bulk actions via checkboxes per row: Verakten, Als gelesen markieren, Loeschen (with shift+click range select)
- Gmail-style keyboard shortcuts: J/K navigate, R reply, A reply all, F forward, V verakten, E archive (shown in Cmd+K palette)
- Soft delete with undo: email disappears, 5s "Rueckgaengig" toast, then moves to IMAP Trash
- Archive action: moves email to IMAP Archive folder (separate from delete)
- Mark as Spam: moves email to IMAP Junk folder
- Empty inbox state: if no mailbox configured → prompt to set up; if configured but empty → "Keine neuen E-Mails" with last sync time

### Real-time Notifications
- Toast notification with sender/subject on new email, auto-dismiss after 5s, click to jump to email
- Folder unread counts update in real-time via Socket.IO

### Mailbox Configuration
- Admin-only mailbox management (only ADMIN role can add/edit/delete mailboxes)
- Authentication: both password-based AND OAuth2 (Microsoft 365, Google) supported
- IMAP and SMTP configured separately (separate server/port/credentials sections)
- Provider auto-discovery profiles: M365, Gmail, IONOS, Strato etc. pre-fill server/port/encryption; "Manuell" for custom
- Connection test button with live feedback: "Verbinde... Authentifiziere... Erfolgreich" or error message
- User assignment: via user profile (admin assigns mailboxes in user's profile settings)
- Configurable initial sync: admin chooses per mailbox "Nur neue", "Letzte X Tage", or "Alles" (default: 30 Tage)
- Standard IMAP folders auto-detected and mapped (Inbox, Sent, Drafts, Trash, Junk, Archive + custom folders appear in tree)
- IMAP folder structure mirrored 1:1 from server
- Full folder management: users can create, rename, delete IMAP folders via app
- All user deletions (emails, folders) are admin-recoverable via soft-delete with configurable retention period (admin sets: 30/60/90/unbegrenzt)
- Connection error handling: auto-retry with backoff, after 3 failures → admin notification via in-app notification
- Active/inactive toggle per mailbox (deactivate stops sync, hides from tree, data retained)
- Dedicated "E-Mail" tab in Einstellungen (admin-only): mailbox list, signature template, sync dashboard
- Sync dashboard per mailbox: status (Verbunden/Fehler/Getrennt), last sync, stored email count, last 5 errors
- User profile shows assigned mailboxes (read-only) + signature fields + last sync time

### Signature System
- Admin defines ONE kanzlei-wide HTML signature template using simple TipTap rich-text editor
- Template uses placeholders: {{name}}, {{titel}}, {{mobil}}, {{durchwahl}} etc.
- Users edit ONLY their personal field values in their profile (Name, Titel, Mobil, Durchwahl) — NOT the template itself
- Every outgoing email gets the sending user's personalized signature, regardless of which mailbox (including Kanzlei mailbox)

### Email Storage & Sync
- Full local mirroring: all emails stored in PostgreSQL (header, body, metadata) for fast retrieval
- Email attachments stored in MinIO (S3, consistent with DMS)
- Bidirectional sync: deletions/moves on IMAP server reflected in app and vice versa
- IMAP IDLE for real-time push of new emails
- Attachment limit: 25MB per attachment, no mailbox storage limit
- SMTP sending only through app (external client sends appear in Sent via IMAP sync but without app metadata)

### Credential Security
- IMAP/SMTP passwords encrypted with AES-256 using configurable encryption key (env var) in database

### Verantwortlicher (Email Assignment)
- Kanzlei mailbox supports per-email Verantwortlicher assignment
- Quick-action in email row: avatar/icon click → user dropdown for fast assignment
- Filterable in filter bar

### Veraktung (Case Assignment)
- Auto-suggest based on sender email (known Mandant/Gegenseite) + Aktenzeichen in subject — top 3 suggestions
- Slide-over panel from right: suggested Akten, search field, per-attachment checkbox selection, DMS folder dropdown, optional note field, confirm button
- Multi-Akte support: one email can be assigned to multiple case files
- Bulk veraktung: select multiple emails → single Akte assignment (all attachments included)
- Per-attachment selection in slide-over: checkboxes per attachment with file size, default all checked
- DMS folder selection: dropdown shows Akte folder structure (per Ordner-Schema), default "Korrespondenz"
- Optional note field: free text for context (e.g. "Vergleichsvorschlag eingegangen"), shown in Akte E-Mail tab
- One-click quick veraktung: in email row, hover shows suggested Akte → one-click confirms if high confidence; otherwise opens slide-over
- Veraktung is reversible: "Veraktung aufheben" button in email detail or Akte E-Mail tab (DMS attachment copies remain)
- All users with mailbox access can verakten (no extra role requirement)
- Veraktungs-log: stored for audit, visible to Admin only
- After veraktung: email moved to "Importierte Emails" IMAP folder (configurable name in admin settings, auto-created on first use)
- Veraktete emails visible in BOTH "Importierte Emails" folder AND Akte E-Mail tab
- Replies to veraktete emails: auto-suggest same Akte as top suggestion (not auto-assign, user confirms)
- Outgoing emails with Akte link: automatically veraktet to that Akte

### Akte E-Mail Tab (REQ-EM-008)
- Filtered inbox-style list of all veraktete emails for this Akte (chronological, same row format as inbox)
- Click opens email detail

### Ticket from Email (REQ-EM-007)
- Quick-action button "Ticket erstellen" in action bar
- Opens Ticket form with pre-fill: Titel=Betreff, Beschreibung=E-Mail-Auszug, Akte=veraktete Akte (if assigned), Absender as Kontakt
- User can edit all fields before saving

### Compose & Send
- Floating popup (like Gmail): opens as floating window in corner, keeps inbox visible
- Minimize/maximize support: minimized shows only Betreff bar at bottom, maximize goes fullscreen; multiple drafts as minimized tabs
- TipTap rich-text editor with toolbar: Bold, Italic, Links, Listen, Tabellen, Hyperlinks, Farbe, Bilder/Screenshots (paste from clipboard)
- Compose header fields: Von (dropdown: all user's mailboxes), An, CC, BCC, Akte (optional typeahead), Betreff
- Reply/forward: opens inline in detail pane (not popup); original email quoted with '>' block
- Forward: original attachments pre-selected, individually deselectable via checkboxes
- Absender dropdown: all user's mailboxes, default last-used or Kanzlei mailbox
- Auto-complete recipients from: previous sent/received email addresses + Mandanten/Kontakte from Akten
- Attachments: two methods — 1) File upload (drag & drop + button), 2) "Aus Akte" DMS file picker modal with folder browser and multi-select
- Auto-save drafts every 30 seconds to IMAP Drafts folder; draft counter in folder tree
- 10-second send delay with undo: toast "E-Mail wird in 10s gesendet — Rueckgaengig", then BullMQ/SMTP send
- Scheduled sending: "Spaeter senden" dropdown with time picker (morgen 08:00, naechster Montag 09:00, custom); BullMQ delayed job; scheduled emails appear in Drafts with time badge, fully editable until send time
- Read receipt: optional checkbox "Lesebestaetigung anfordern" (sets Disposition-Notification-To); incoming requests show toast asking user
- Priority flag: dropdown (Normal/Hoch/Niedrig), sets X-Priority header; incoming high-priority shown with red exclamation in list
- Validation: no-subject warning dialog with "Trotzdem senden?" option; same for empty An field
- Reply-All safety: warning dialog when 5+ recipients
- LanguageTool self-hosted (Docker): integrated spell/grammar/style checking for German
- Send failure: in-app notification to sender with error details, email marked as "Fehlgeschlagen" in Drafts for retry
- Send queue visible in Bull Board (admin)

### Claude's Discretion
- Loading skeleton designs for inbox and detail pane
- Exact spacing, typography, and color choices (within existing design system)
- Error state handling for disconnected mailboxes in the UI
- TipTap toolbar exact layout and icon choices
- How to handle emails with no IMAP folder mapping
- Thread detection algorithm details (In-Reply-To vs References vs Subject matching)
- Exact auto-suggest confidence threshold for one-click veraktung
- Screenshot paste implementation details (base64 inline vs MinIO upload)

</decisions>

<specifics>
## Specific Ideas

- Veraktungs-Empfehlung beim Antworten/Weiterleiten: If an email is not veraktet and user clicks Reply/Forward, show a yellow banner recommending to verakten first — with quick-action button
- E-Mail-Loeschungen muessen fuer den Admin vollstaendig wiederherstellbar sein — kein endgueltiges Loeschen ohne Sicherheitsnetz
- Signatur-System: Admin bestimmt die Vorlage, Benutzer fuellen nur ihre Felder (Name, Titel, Mobil, Durchwahl). Egal welche Mailbox (auch Kanzlei-Mailbox), die individuelle Signatur wird angehangen
- Compose soll wie Gmail als schwebendes Fenster oeffnen, minimierbar mit mehreren Drafts als Tabs

</specifics>

<deferred>
## Deferred Ideas

- **Telefonnotiz & Notiz-Buttons in der Akte** — Vermerk-System fuer schnelle Notizen und Telefonvermerke. Eigene Phase.
- **Automatische E-Mail-Regeln** — Rule Engine fuer automatische Verantwortlichen-Zuweisung basierend auf Absender/Betreff. Eigene Phase.
- **E-Mail-Textbausteine** — Vorgefertigte Antwort-Vorlagen fuer haeufige Korrespondenz (Eingangsbestaetigung, Fristverlaengerung etc.). Eigene Phase.
- **CalDAV/CardDAV-Sync** — Kalender- und Kontakt-Synchronisation vom Mailserver. Eigene Phase.
- **Real-time & Notifications Details** — Notification preferences, sound alerts, notification center integration. Spaetere Version.
- **E-Mail sidebar navigation** — Sidebar integration details. Spaetere Version.
- **Security & data protection** — HTML sanitization levels, external image blocking, phishing warnings. Spaetere Version.
- **Mobile / responsive behavior** — Three-pane responsive adaptation, touch interactions. Spaetere Version.

</deferred>

---

*Phase: 03-email-client*
*Context gathered: 2026-02-24*
