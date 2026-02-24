# Phase 3: Email Client - Research

**Researched:** 2026-02-24
**Domain:** IMAP/SMTP email integration with real-time sync, three-pane UI, Veraktung workflow
**Confidence:** MEDIUM-HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
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
- Sanitized HTML rendering with XSS protection (sanitize-html)
- Attachment strip below email header: horizontal strip with file icons/thumbnails, name + size, click to download, PDF/image preview on hover
- Action bar at top of detail pane: Antworten, Allen antworten, Weiterleiten, Verakten, Ticket erstellen, Archivieren, Spam, Loeschen
- Reply/forward opens inline in detail pane (compose area below original email)
- Veraktungs-Empfehlung: when replying/forwarding an unveraktete email, show yellow banner
- Bulk actions via checkboxes per row: Verakten, Als gelesen markieren, Loeschen (with shift+click range select)
- Gmail-style keyboard shortcuts: J/K navigate, R reply, A reply all, F forward, V verakten, E archive
- Soft delete with undo: 5s "Rueckgaengig" toast, then moves to IMAP Trash
- Archive action: moves email to IMAP Archive folder
- Mark as Spam: moves email to IMAP Junk folder
- Toast notification with sender/subject on new email, auto-dismiss after 5s, click to jump to email
- Admin-only mailbox management
- Authentication: both password-based AND OAuth2 (Microsoft 365, Google) supported
- IMAP and SMTP configured separately
- Provider auto-discovery profiles: M365, Gmail, IONOS, Strato etc. pre-fill server/port/encryption
- Connection test button with live feedback
- Configurable initial sync: admin chooses per mailbox "Nur neue", "Letzte X Tage", or "Alles" (default: 30 Tage)
- Standard IMAP folders auto-detected and mapped; IMAP folder structure mirrored 1:1
- Full folder management: users can create, rename, delete IMAP folders via app
- All user deletions admin-recoverable via soft-delete with configurable retention period
- Connection error handling: auto-retry with backoff, after 3 failures -> admin notification
- Active/inactive toggle per mailbox
- Dedicated "E-Mail" tab in Einstellungen (admin-only)
- Sync dashboard per mailbox: status, last sync, stored email count, last 5 errors
- Admin defines ONE kanzlei-wide HTML signature template using TipTap rich-text editor
- Template uses placeholders: {{name}}, {{titel}}, {{mobil}}, {{durchwahl}} etc.
- Users edit ONLY their personal field values in profile
- Full local mirroring: all emails stored in PostgreSQL (header, body, metadata)
- Email attachments stored in MinIO
- Bidirectional sync: deletions/moves on IMAP server reflected in app and vice versa
- IMAP IDLE for real-time push of new emails
- Attachment limit: 25MB per attachment
- IMAP/SMTP passwords encrypted with AES-256 using configurable encryption key (env var)
- Kanzlei mailbox supports per-email Verantwortlicher assignment
- Auto-suggest based on sender email (known Mandant/Gegenseite) + Aktenzeichen in subject
- Slide-over panel from right for Veraktung
- Multi-Akte support: one email can be assigned to multiple case files
- Bulk veraktung: select multiple emails -> single Akte assignment
- Per-attachment selection in slide-over: checkboxes per attachment
- DMS folder selection: dropdown shows Akte folder structure
- Veraktung is reversible
- Veraktungs-log: stored for audit, visible to Admin only
- After veraktung: email moved to "Importierte Emails" IMAP folder
- Replies to veraktete emails: auto-suggest same Akte
- Outgoing emails with Akte link: automatically veraktet
- Akte E-Mail Tab: filtered inbox-style list of all veraktete emails for this Akte
- Ticket from Email: Quick-action button "Ticket erstellen" with pre-fill
- Floating compose popup (like Gmail): minimizable, multiple drafts as minimized tabs
- TipTap rich-text editor with toolbar
- Compose header fields: Von (dropdown), An, CC, BCC, Akte (optional typeahead), Betreff
- Reply/forward: opens inline in detail pane
- Auto-complete recipients from sent/received + Mandanten/Kontakte
- Attachments: file upload (drag & drop) + "Aus Akte" DMS file picker
- Auto-save drafts every 30 seconds to IMAP Drafts folder
- 10-second send delay with undo toast, then BullMQ/SMTP send
- Scheduled sending: "Spaeter senden" with time picker; BullMQ delayed job
- Read receipt: optional checkbox "Lesebestaetigung anfordern"
- Priority flag: dropdown (Normal/Hoch/Niedrig), sets X-Priority header
- Validation: no-subject warning, empty-An warning
- Reply-All safety: warning when 5+ recipients
- LanguageTool self-hosted (Docker): integrated spell/grammar/style checking for German
- Send failure: in-app notification with error details, email marked "Fehlgeschlagen" in Drafts
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

### Deferred Ideas (OUT OF SCOPE)
- Telefonnotiz & Notiz-Buttons in der Akte -- Vermerk-System. Eigene Phase.
- Automatische E-Mail-Regeln -- Rule Engine. Eigene Phase.
- E-Mail-Textbausteine -- Vorgefertigte Antwort-Vorlagen. Eigene Phase.
- CalDAV/CardDAV-Sync -- Kalender/Kontakt-Synchronisation. Eigene Phase.
- Real-time & Notifications Details -- preferences, sound alerts. Spaetere Version.
- E-Mail sidebar navigation. Spaetere Version.
- Security & data protection -- HTML sanitization levels, external image blocking, phishing warnings. Spaetere Version.
- Mobile / responsive behavior -- Three-pane responsive adaptation. Spaetere Version.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REQ-EM-001 | IMAP-Sync mit Real-Time (IMAP IDLE) fuer eingehende E-Mails | ImapFlow IDLE + `exists` event + worker reconnection pattern; mailparser for MIME parsing; BullMQ for sync jobs |
| REQ-EM-002 | Shared Kanzlei-Postfach + per-User Mailboxen | New Prisma models (EmailKonto, EmailFolder, etc.); one ImapFlow connection per active mailbox in worker; OAuth2 via accessToken auth |
| REQ-EM-003 | Inbox-Seite (Liste, Pagination, Filter: veraktet/unveraktet, Akte, Verantwortlicher) | Three-pane layout via react-resizable-panels (shadcn Resizable); @tanstack/react-virtual for virtualized list; Prisma cursor-based pagination with compound indexes |
| REQ-EM-004 | E-Mail-Detailansicht (Header, Body, Anhaenge) | sanitize-html for server-side HTML sanitization; DOMPurify for client-side rendering safety; MinIO presigned URLs for attachment download |
| REQ-EM-005 | E-Mail verakten (Akte zuordnen, Anhaenge ins DMS) | Veraktung slide-over panel; auto-suggest via sender-email-to-Kontakt lookup + Aktenzeichen regex in subject; attachment copy from email MinIO path to DMS path |
| REQ-EM-006 | Compose-View (An, CC, BCC, Betreff, Rich-Text, Akte-Verknuepfung, Dateianhang aus DMS) | TipTap editor with extensions; floating compose popup; BullMQ send queue; nodemailer v7 SMTP transport per-mailbox; draft auto-save to IMAP Drafts |
| REQ-EM-007 | Ticket aus E-Mail erstellen (Prefill Titel/Beschreibung) | Existing Ticket model + API; pre-fill from email fields; link EmailMessage.ticketId |
| REQ-EM-008 | Akte: Tab "E-Mails" (veraktete Mails der Akte) | Filtered query on EmailMessage.akteId; reuse email list component; existing Akte detail page tab pattern |
</phase_requirements>

## Summary

Phase 3 is the largest single-phase feature in the project: a full email client integrated into a law firm case management system. The core challenge is combining a real-time IMAP sync engine (running in the worker process) with a three-pane inbox UI and a Veraktung (case-assignment) workflow that is the primary daily entry point for law firm staff.

The technical architecture splits into three layers: (1) a **worker-side IMAP engine** using ImapFlow for IMAP IDLE connections and mailparser for MIME parsing, with BullMQ for send jobs and sync orchestration; (2) **API routes** for email CRUD, mailbox configuration, Veraktung, and compose/send; and (3) a **React UI** using react-resizable-panels for the three-pane layout, @tanstack/react-virtual for virtualized email lists, TipTap for rich-text compose, and Socket.IO for real-time notifications.

The existing codebase already has: a BullMQ worker process (`src/worker.ts`), Socket.IO infrastructure with Redis adapter/emitter, a notification service, an S3/MinIO storage layer, and placeholder email pages with basic list/detail/compose views. The Prisma schema has a basic `EmailMessage` model that will need significant expansion (new models for email accounts, folders, attachments, threads, Veraktung log).

**Primary recommendation:** Use ImapFlow (one connection per active mailbox) in the worker process with a manager pattern that handles IDLE, reconnection, and initial sync. Use mailparser for parsing raw MIME messages. Use sanitize-html server-side and DOMPurify client-side for HTML email rendering. Use TipTap for the compose editor. Use react-resizable-panels (shadcn Resizable wrapper) for the three-pane layout and @tanstack/react-virtual for virtualized scrolling.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| imapflow | ^1.0.171 | IMAP client with IDLE, CONDSTORE, streaming | Modern async/await API, built by EmailEngine author, production-tested, supports OAuth2 |
| mailparser | ^3.9.3 | Parse MIME emails into structured objects | From nodemailer ecosystem, handles attachments/encoding/charsets, streaming-capable |
| nodemailer | ^7.0.13 | SMTP email sending | Already installed; kept at v7 per project decision (next-auth peer dep compatibility) |
| sanitize-html | ^2.15.0 | Server-side HTML sanitization for email bodies | Configurable allowlists, handles email HTML quirks, prevents stored XSS |
| dompurify | ^3.2.6 | Client-side HTML sanitization before dangerouslySetInnerHTML | DOM-based, fast, security-audited by cure53, industry standard for React |
| @tiptap/react | ^2.11.5 | Rich-text editor for email compose | Headless, ProseMirror-based, modular extensions, used in email UIs |
| @tiptap/starter-kit | ^2.11.5 | Bundle of common TipTap extensions | Paragraphs, headings, bold, italic, lists, code, history |
| @tiptap/pm | ^2.11.5 | ProseMirror peer dependency for TipTap | Required by @tiptap/react |
| @tanstack/react-virtual | ^3.13.18 | Virtualized list rendering for email inbox | Headless, 60fps, 10-15kb, used with shadcn |
| react-resizable-panels | ^2.1.7 | Resizable three-pane layout | Powers shadcn/ui Resizable component, accessibility built-in, layout persistence |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tiptap/extension-link | ^2.11.5 | Hyperlink support in TipTap | Email compose: clickable links |
| @tiptap/extension-image | ^2.11.5 | Image embedding in TipTap | Screenshot paste, inline images |
| @tiptap/extension-table | ^2.11.5 | Table support in TipTap | Email tables |
| @tiptap/extension-placeholder | ^2.11.5 | Placeholder text in TipTap | "Ihre Nachricht..." |
| @tiptap/extension-color | ^2.11.5 | Text color in TipTap | Font color selection |
| @tiptap/extension-text-style | ^2.11.5 | Text styling base for color | Required by color extension |
| isomorphic-dompurify | ^2.22.0 | SSR-safe DOMPurify wrapper | If sanitizing in both server/client contexts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| imapflow | node-imap | node-imap is unmaintained since 2019; imapflow is actively developed and has modern async/await API |
| sanitize-html | DOMPurify-only (server + client) | sanitize-html is lighter for server-side (no jsdom), DOMPurify is better for client; use both |
| @tanstack/react-virtual | react-window / react-virtuoso | react-virtual is headless (matches shadcn philosophy), smaller bundle, framework-agnostic |
| react-resizable-panels | allotment, re-resizable | react-resizable-panels is what shadcn/ui Resizable is built on; native integration |
| TipTap | Slate.js, Lexical | TipTap is specified in CONTEXT.md; ProseMirror maturity for rich-text email |

**Installation:**
```bash
npm install imapflow mailparser sanitize-html dompurify react-resizable-panels @tanstack/react-virtual @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-image @tiptap/extension-table @tiptap/extension-placeholder @tiptap/extension-color @tiptap/extension-text-style
npm install -D @types/sanitize-html @types/dompurify @types/mailparser
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── email/
│   │   ├── send.ts                   # Existing SMTP send helper (to be expanded)
│   │   ├── imap/
│   │   │   ├── connection-manager.ts  # Manages ImapFlow connections per mailbox
│   │   │   ├── sync.ts               # Initial sync + incremental sync logic
│   │   │   ├── idle-handler.ts        # IDLE monitoring + event processing
│   │   │   ├── folder-sync.ts         # IMAP folder list/create/rename/delete
│   │   │   └── parser.ts             # mailparser wrapper: raw MIME -> structured EmailMessage
│   │   ├── smtp/
│   │   │   ├── transport-factory.ts   # Create nodemailer transporter per EmailKonto
│   │   │   └── send-processor.ts      # BullMQ job processor: dequeue + send + update status
│   │   ├── crypto.ts                  # AES-256-GCM encrypt/decrypt for IMAP/SMTP passwords
│   │   ├── sanitize.ts               # sanitize-html config for email HTML bodies
│   │   ├── threading.ts              # Thread detection: In-Reply-To / References / subject
│   │   ├── veraktung.ts              # Auto-suggest logic + attachment copy to DMS
│   │   ├── signature.ts              # Template rendering: replace {{placeholders}} with user data
│   │   └── types.ts                  # Shared types for email domain
│   ├── queue/
│   │   ├── queues.ts                  # Add: emailSendQueue, emailSyncQueue
│   │   └── processors/
│   │       ├── email-send.processor.ts
│   │       └── email-sync.processor.ts
│   └── socket/
│       └── rooms.ts                   # Add: mailbox:{kontoId} room for folder/count updates
├── workers/
│   └── processors/
│       └── imap-manager.ts            # Long-running IMAP connection manager (called from worker.ts)
├── app/
│   ├── (dashboard)/
│   │   ├── email/
│   │   │   ├── page.tsx              # Three-pane inbox (REPLACE existing)
│   │   │   ├── layout.tsx            # Email-specific layout (no outer padding, full height)
│   │   │   └── compose/page.tsx       # Keep as fallback full-page compose
│   │   ├── akten/[id]/
│   │   │   └── (existing tabs + new email tab)
│   │   └── einstellungen/
│   │       └── (add E-Mail tab)
│   └── api/
│       ├── emails/                    # CRUD, veraktung, mark-read, bulk-actions
│       ├── email-konten/              # Mailbox configuration CRUD
│       ├── email-folders/             # Folder management
│       └── email-send/                # Queue send job
└── components/
    └── email/
        ├── inbox-layout.tsx           # Three-pane shell (PanelGroup)
        ├── folder-tree.tsx            # Mailbox/folder navigation
        ├── email-list.tsx             # Virtualized email list
        ├── email-list-row.tsx         # Single email row
        ├── email-detail.tsx           # Detail pane
        ├── email-html-body.tsx        # Sanitized HTML rendering
        ├── attachment-strip.tsx       # Attachment display with download
        ├── compose-popup.tsx          # Floating compose window
        ├── compose-editor.tsx         # TipTap editor wrapper
        ├── veraktung-panel.tsx        # Slide-over veraktung panel
        ├── email-actions-bar.tsx      # Action buttons for detail pane
        ├── email-filters.tsx          # Filter bar component
        └── mailbox-config/
            ├── mailbox-form.tsx       # Add/edit mailbox form
            ├── connection-test.tsx    # Live connection test UI
            ├── provider-profiles.tsx  # Auto-discovery profiles
            ├── signature-editor.tsx   # TipTap-based HTML signature template editor
            └── sync-dashboard.tsx     # Mailbox status/errors dashboard
```

### Pattern 1: IMAP Connection Manager (Worker Process)
**What:** A long-running manager that maintains one ImapFlow connection per active mailbox, handles IDLE for the INBOX folder, reconnects on close, and dispatches events via Socket.IO emitter.
**When to use:** All IMAP operations in the worker process.
**Example:**
```typescript
// Source: ImapFlow docs (imapflow.com/docs/api/imapflow-client/) + GitHub issues
import { ImapFlow } from "imapflow";
import { getSocketEmitter } from "@/lib/socket/emitter";
import { createLogger } from "@/lib/logger";

const log = createLogger("imap:manager");

interface ManagedConnection {
  kontoId: string;
  client: ImapFlow;
  reconnectTimer: NodeJS.Timeout | null;
  failCount: number;
}

const connections = new Map<string, ManagedConnection>();
const MAX_RECONNECT_DELAY = 300_000; // 5 minutes
const BASE_RECONNECT_DELAY = 5_000; // 5 seconds

export async function startImapConnection(konto: {
  id: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  user: string;
  password?: string;
  accessToken?: string;
}) {
  // CRITICAL: Always create a NEW ImapFlow instance (never reuse)
  const client = new ImapFlow({
    host: konto.imapHost,
    port: konto.imapPort,
    secure: konto.imapSecure,
    auth: konto.accessToken
      ? { user: konto.user, accessToken: konto.accessToken }
      : { user: konto.user, pass: konto.password! },
    logger: false, // Use our own logger
    maxIdleTime: 300_000, // 5 min, then re-IDLE
  });

  const managed: ManagedConnection = {
    kontoId: konto.id,
    client,
    reconnectTimer: null,
    failCount: 0,
  };

  // Handle new messages via IDLE
  client.on("exists", (data) => {
    // data.count = new total, data.prevCount = previous total
    log.info({ kontoId: konto.id, count: data.count }, "New message(s) detected");
    // Trigger incremental sync job
    // Emit real-time notification
  });

  // Handle connection close -> reconnect
  client.on("close", () => {
    log.warn({ kontoId: konto.id }, "IMAP connection closed");
    scheduleReconnect(managed, konto);
  });

  client.on("error", (err) => {
    log.error({ kontoId: konto.id, err: err.message }, "IMAP error");
  });

  try {
    await client.connect();
    managed.failCount = 0;
    await client.mailboxOpen("INBOX");
    // ImapFlow auto-starts IDLE when mailbox is open (unless disableAutoIdle)
    connections.set(konto.id, managed);
    log.info({ kontoId: konto.id }, "IMAP connected and IDLE started");
  } catch (err) {
    log.error({ kontoId: konto.id, err }, "IMAP connection failed");
    scheduleReconnect(managed, konto);
  }
}

function scheduleReconnect(managed: ManagedConnection, konto: any) {
  managed.failCount++;
  const delay = Math.min(
    BASE_RECONNECT_DELAY * Math.pow(2, managed.failCount - 1),
    MAX_RECONNECT_DELAY
  );
  log.info({ kontoId: konto.id, delay, failCount: managed.failCount }, "Scheduling reconnect");

  if (managed.failCount >= 3) {
    // Notify admin after 3 consecutive failures
    notifyAdminConnectionError(konto.id, managed.failCount);
  }

  managed.reconnectTimer = setTimeout(() => {
    startImapConnection(konto); // Creates fresh ImapFlow instance
  }, delay);
}
```

### Pattern 2: AES-256-GCM Credential Encryption
**What:** Encrypt IMAP/SMTP passwords at rest using Node.js built-in crypto with AES-256-GCM.
**When to use:** Storing and retrieving email account credentials in the database.
**Example:**
```typescript
// Source: Node.js crypto docs (nodejs.org/api/crypto.html)
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_ENV = "EMAIL_ENCRYPTION_KEY"; // 32+ char string in .env

function getDerivedKey(): Buffer {
  const secret = process.env[KEY_ENV];
  if (!secret) throw new Error(`${KEY_ENV} environment variable is required`);
  // Derive a 32-byte key from the secret using scrypt
  return scryptSync(secret, "ai-lawyer-email-salt", 32);
}

export function encryptCredential(plaintext: string): string {
  const key = getDerivedKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Store as: iv:authTag:ciphertext (all hex-encoded)
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptCredential(stored: string): string {
  const key = getDerivedKey();
  const [ivHex, authTagHex, ciphertextHex] = stored.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}
```

### Pattern 3: Email Threading Algorithm
**What:** Group emails into conversation threads using IMAP headers.
**When to use:** Building the threaded inbox view.
**Example:**
```typescript
// Source: RFC 5256 (IMAP THREAD extension), JWZ threading algorithm (jwz.org/doc/threading.html)

// Priority: References > In-Reply-To > Subject normalization
export function findThreadId(email: {
  messageId: string | null;
  inReplyTo: string | null;
  references: string[];
  subject: string;
}): string | null {
  // 1. Check References header (most reliable, contains full chain)
  if (email.references.length > 0) {
    // First reference = root of thread
    return email.references[0];
  }

  // 2. Check In-Reply-To header
  if (email.inReplyTo) {
    return email.inReplyTo;
  }

  // 3. Fall back to normalized subject matching (least reliable)
  // Strip Re:, Fwd:, AW:, WG: prefixes for German email clients
  return null; // Subject matching done at query time
}

export function normalizeSubject(subject: string): string {
  return subject
    .replace(/^(Re|Fwd|AW|WG|Antwort|Weiterleitung)\s*:\s*/gi, "")
    .trim();
}
```

### Pattern 4: Sanitized HTML Email Rendering
**What:** Two-layer sanitization: server-side with sanitize-html (store clean HTML), client-side with DOMPurify (defense-in-depth before rendering).
**When to use:** Displaying email HTML bodies in the detail pane.
**Example:**
```typescript
// Server-side: sanitize before storing in DB
import sanitizeHtml from "sanitize-html";

export function sanitizeEmailHtml(rawHtml: string): string {
  return sanitizeHtml(rawHtml, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "img", "style", "span", "div", "table", "thead", "tbody",
      "tr", "th", "td", "center", "font", "hr",
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      "*": ["style", "class", "id", "dir", "align", "valign", "width", "height"],
      img: ["src", "alt", "width", "height", "style"],
      a: ["href", "name", "target", "rel"],
      font: ["color", "face", "size"],
      td: ["colspan", "rowspan", "width", "height", "style", "align", "valign"],
      th: ["colspan", "rowspan", "width", "height", "style", "align", "valign"],
    },
    // Block script, iframe, object, embed
    disallowedTagsMode: "discard",
    // Rewrite external image URLs (block tracking pixels)
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
    },
  });
}

// Client-side: DOMPurify before dangerouslySetInnerHTML
import DOMPurify from "dompurify";

export function EmailHtmlBody({ html }: { html: string }) {
  const clean = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["target"],
  });
  return (
    <div
      className="prose prose-sm dark:prose-invert max-w-none email-body"
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
```

### Pattern 5: BullMQ Send Queue with Delayed Jobs
**What:** Email sending goes through a BullMQ queue for the 10-second undo window and scheduled sending.
**When to use:** All outgoing emails (immediate, delayed, scheduled).
**Example:**
```typescript
// Queue definition
export const emailSendQueue = new Queue("email-send", {
  connection: getQueueConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "custom" },
    removeOnComplete: { age: 86_400 },
    removeOnFail: { age: 604_800 },
  },
});

// Add job with 10-second delay (undo window)
await emailSendQueue.add("send", {
  emailId: email.id,
  kontoId: senderKonto.id,
}, {
  delay: 10_000, // 10 seconds
  jobId: `send-${email.id}`, // For cancellation
});

// Cancel (undo) within 10 seconds
await emailSendQueue.remove(`send-${email.id}`);

// Scheduled sending
await emailSendQueue.add("send", {
  emailId: email.id,
  kontoId: senderKonto.id,
}, {
  delay: scheduledDate.getTime() - Date.now(),
  jobId: `send-${email.id}`,
});
```

### Anti-Patterns to Avoid
- **Running ImapFlow in API routes:** IMAP connections are long-lived; they MUST run in the worker process, not in serverless/edge API routes that may be killed after response
- **Reusing ImapFlow instances after close:** ImapFlow objects accumulate state and CANNOT be reconnected; always create a new instance
- **Running IMAP commands inside fetch loop:** ImapFlow fetch returns an async iterator that holds a mailbox lock; running other IMAP commands inside will deadlock
- **Storing unsanitized email HTML in DB:** Email HTML from the wild contains scripts, tracking pixels, external resources; always sanitize before storing
- **Polling instead of IDLE:** IDLE uses zero bandwidth when idle; polling wastes resources and adds latency
- **Single ImapFlow connection for multiple folders:** IMAP protocol only allows one selected mailbox per connection; monitoring multiple folders requires multiple connections or sequential re-selection (IDLE only works on the selected mailbox)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IMAP protocol client | Custom TCP/TLS socket handler | imapflow | RFC 3501/7162 is extremely complex (LITERAL+, IDLE, CONDSTORE, QRESYNC, UTF8) |
| MIME email parsing | Custom regex for headers/body/attachments | mailparser | MIME is deeply nested, multipart boundaries, charset encoding, quoted-printable, base64 |
| HTML sanitization | Regex-based tag stripping | sanitize-html + DOMPurify | Email HTML is notoriously malformed; regex cannot handle nested contexts safely |
| Rich-text email editor | contentEditable with custom commands | TipTap/ProseMirror | Cursor management, undo/redo, nested structures, paste handling are incredibly hard |
| Virtualized scrolling | Manual DOM recycling | @tanstack/react-virtual | Smooth scrolling at 60fps with variable heights requires precise measurement and layout |
| Resizable panels | Manual mouse event tracking with CSS resize | react-resizable-panels | Accessibility (keyboard resize), constraints, persistence, collapse behavior |
| Credential encryption | Custom XOR/Base64 encoding | Node.js crypto AES-256-GCM | Proper authenticated encryption with IV and auth tags; hand-rolled crypto is always broken |
| SMTP transport management | Raw socket SMTP | nodemailer | SMTP extensions (AUTH, STARTTLS, DKIM, 8BITMIME), connection pooling, error handling |
| Spell/grammar check | Custom dictionary lookup | LanguageTool (Docker) | German compound words, grammar rules, style suggestions; thousands of rules maintained by linguists |

**Key insight:** Email is one of the most standardized yet implementation-complex domains in computing. Every aspect (IMAP protocol, MIME format, HTML rendering, SMTP delivery, threading) has decades of edge cases. Using battle-tested libraries for each layer is not optional -- it's survival.

## Common Pitfalls

### Pitfall 1: ImapFlow IDLE Stops Without Error
**What goes wrong:** TCP connection drops silently (NAT timeout, server restart, network blip). The `error` event does NOT fire -- only `close` fires. Application thinks it's still connected and stops receiving new email notifications.
**Why it happens:** TCP keepalive defaults are too long (2 hours). Many firewalls/NATs drop idle connections after 5-30 minutes. ImapFlow's IDLE command keeps the IMAP-level connection alive but not necessarily the TCP-level one.
**How to avoid:** Always listen to the `close` event (not `error`) for reconnection. Set `maxIdleTime: 300000` (5 min) to periodically restart IDLE. Implement exponential backoff reconnection with a fresh ImapFlow instance each time. Track connection health with a periodic heartbeat (NOOP command via `client.noop()`).
**Warning signs:** No new email notifications for extended periods. Worker log shows no IMAP activity. `exists` events stop firing.

### Pitfall 2: Deadlock in ImapFlow Fetch Loop
**What goes wrong:** Code runs another IMAP command (e.g., `messageFlagsAdd`) inside a `for await...of client.fetch()` loop. The connection locks up permanently.
**Why it happens:** ImapFlow uses mailbox locking internally. The fetch iterator holds a lock. Running another command that needs the same lock creates a deadlock.
**How to avoid:** Use `client.fetchAll()` which returns a complete array (releases the lock), then iterate over the array to process each message. Or collect UIDs from the fetch loop, then run flag/move operations after the loop completes.
**Warning signs:** Worker hangs indefinitely during sync operations.

### Pitfall 3: Email HTML Breaks Application Layout
**What goes wrong:** Email HTML contains absolute positioning, fixed widths (600px tables), inline styles that override application CSS, or scripts that escape the container.
**Why it happens:** Marketing emails use aggressive inline CSS designed for standalone rendering. Some emails contain full `<html><head><style>` documents.
**How to avoid:** Render email HTML in a sandboxed container with `overflow: hidden`, `max-width: 100%`, and CSS containment. Strip `<style>` tags with global selectors. Use `sanitize-html` to remove dangerous elements. Apply a CSS reset inside the email container. Consider using an iframe with `sandbox` attribute for maximum isolation (tradeoff: harder to style).
**Warning signs:** Email detail pane layout breaks when viewing certain emails.

### Pitfall 4: Bidirectional Sync Race Conditions
**What goes wrong:** User deletes an email in the app; meanwhile, a sync cycle fetches the same email from the server. The email reappears. Or: user moves an email to a folder; sync cycle moves it back.
**Why it happens:** IMAP sync and local operations happen concurrently without coordination.
**How to avoid:** Use UIDVALIDITY to detect mailbox resets. Track pending local operations (delete, move, flag changes) and skip conflicting sync operations. Use IMAP CONDSTORE/MODSEQ for efficient change detection. Implement a "local-pending" state for operations that haven't been confirmed by the server yet.
**Warning signs:** Deleted emails reappearing. Moved emails bouncing back. Flag changes reverting.

### Pitfall 5: OAuth2 Token Expiry During IDLE
**What goes wrong:** OAuth2 access tokens expire (typically after 1 hour). The IMAP connection established with the old token stays alive (IDLE doesn't re-authenticate), but when the connection drops and reconnects, the expired token fails.
**Why it happens:** IMAP authenticates once at connection time. Token expiry doesn't affect an established connection, but reconnection needs a fresh token.
**How to avoid:** Store the OAuth2 refresh token securely. Before each reconnection attempt, check token expiry and refresh if needed. Set a timer to proactively refresh tokens before expiry (e.g., 5 minutes before).
**Warning signs:** Reconnection failures after working for ~1 hour. Auth errors in worker logs.

### Pitfall 6: Large Attachment Memory Issues
**What goes wrong:** Syncing an email with a 25MB attachment loads the entire attachment into memory. With multiple concurrent syncs, memory usage spikes.
**Why it happens:** Using `fetchAll` or `fetchOne` with `source: true` loads the entire raw message including attachments into memory.
**How to avoid:** Use ImapFlow's `download()` method which returns a stream. Pipe the stream directly to MinIO using `s3Client.send(new PutObjectCommand({ Body: stream }))`. Never buffer entire attachments in memory. Process emails and attachments separately: fetch headers/body first, then download attachments one at a time.
**Warning signs:** Worker process OOM crashes during sync. Memory usage proportional to email attachment sizes.

### Pitfall 7: Nodemailer v7 vs v8 Compatibility
**What goes wrong:** Upgrading nodemailer to v8 breaks the existing send.ts module or introduces next-auth peer dependency conflicts.
**Why it happens:** The project explicitly locked nodemailer at v7 for next-auth compatibility (STATE.md decision: "nodemailer v7 (not v8) for next-auth peer dependency compatibility").
**How to avoid:** Keep nodemailer at v7.x. Do not upgrade to v8 in this phase. The send.ts module already uses v7 and works correctly.
**Warning signs:** Package resolution errors mentioning nodemailer peer dependencies.

## Code Examples

### Initial Email Sync (Fetch Existing Emails)
```typescript
// Source: ImapFlow docs (imapflow.com/docs/api/imapflow-client/)
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { prisma } from "@/lib/db";
import { uploadFile } from "@/lib/storage";

async function syncMailbox(client: ImapFlow, kontoId: string, folder: string, since?: Date) {
  const lock = await client.getMailboxLock(folder);
  try {
    // Build search criteria
    const searchCriteria: any = {};
    if (since) {
      searchCriteria.since = since;
    }

    // Fetch all messages (returns array, no deadlock risk)
    const messages = await client.fetchAll(
      since ? await client.search(searchCriteria) : "1:*",
      {
        uid: true,
        envelope: true,        // From, To, Subject, Date, Message-ID, In-Reply-To, References
        flags: true,           // \Seen, \Flagged, etc.
        bodyStructure: true,   // MIME structure (for attachment detection)
        internalDate: true,    // Server-side date
        size: true,
      }
    );

    for (const msg of messages) {
      // Skip if already synced (check by UID + UIDVALIDITY)
      const exists = await prisma.emailNachricht.findFirst({
        where: {
          emailKontoId: kontoId,
          imapUid: msg.uid,
          imapFolder: folder,
        },
      });
      if (exists) continue;

      // Download full message source for parsing
      const { content } = await client.download(msg.uid.toString(), undefined, { uid: true });
      const parsed = await simpleParser(content);

      // Store email
      await prisma.emailNachricht.create({
        data: {
          emailKontoId: kontoId,
          imapUid: msg.uid,
          imapFolder: folder,
          messageId: parsed.messageId ?? null,
          inReplyTo: parsed.inReplyTo ?? null,
          references: parsed.references ?? [],
          betreff: parsed.subject ?? "(Kein Betreff)",
          absender: parsed.from?.text ?? "",
          absenderName: parsed.from?.value?.[0]?.name ?? null,
          empfaenger: parsed.to ? (Array.isArray(parsed.to) ? parsed.to.map(a => a.text) : [parsed.to.text]) : [],
          cc: parsed.cc ? (Array.isArray(parsed.cc) ? parsed.cc.map(a => a.text) : [parsed.cc.text]) : [],
          bcc: parsed.bcc ? (Array.isArray(parsed.bcc) ? parsed.bcc.map(a => a.text) : [parsed.bcc.text]) : [],
          inhalt: parsed.html ? sanitizeEmailHtml(parsed.html) : null,
          inhaltText: parsed.text ?? null,
          empfangenAm: parsed.date ?? new Date(),
          gelesen: msg.flags.has("\\Seen"),
          flagged: msg.flags.has("\\Flagged"),
          groesse: msg.size,
        },
      });

      // Store attachments in MinIO
      if (parsed.attachments?.length) {
        for (const att of parsed.attachments) {
          if (att.size > 25 * 1024 * 1024) continue; // Skip >25MB
          const key = `email/${kontoId}/${msg.uid}/${att.filename ?? "attachment"}`;
          await uploadFile(key, att.content, att.contentType, att.size);
          // Create EmailAnhang record linking to this email
        }
      }
    }
  } finally {
    lock.release();
  }
}
```

### Virtualized Email List with @tanstack/react-virtual
```typescript
// Source: tanstack.com/virtual/latest/docs/introduction
"use client";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";

export function VirtualEmailList({ emails }: { emails: EmailRow[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: emails.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72, // Estimated row height in px
    overscan: 10,
  });

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <EmailListRow email={emails[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Three-Pane Layout with react-resizable-panels
```typescript
// Source: github.com/bvaughn/react-resizable-panels + ui.shadcn.com/docs/components/radix/resizable
"use client";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

export function InboxLayout() {
  return (
    <PanelGroup
      direction="horizontal"
      autoSaveId="email-inbox-layout" // Persists sizes to localStorage
      className="h-full"
    >
      {/* Folder tree */}
      <Panel defaultSize={20} minSize={15} maxSize={30}>
        <FolderTree />
      </Panel>

      <PanelResizeHandle className="w-1 bg-border hover:bg-brand-500 transition-colors" />

      {/* Email list */}
      <Panel defaultSize={35} minSize={25}>
        <VirtualEmailList />
      </Panel>

      <PanelResizeHandle className="w-1 bg-border hover:bg-brand-500 transition-colors" />

      {/* Detail pane */}
      <Panel defaultSize={45} minSize={30}>
        <EmailDetail />
      </Panel>
    </PanelGroup>
  );
}
```

### TipTap Rich-Text Editor for Compose
```typescript
// Source: tiptap.dev/docs/editor/getting-started/install/react
"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Placeholder from "@tiptap/extension-placeholder";
import Color from "@tiptap/extension-color";
import TextStyle from "@tiptap/extension-text-style";

export function ComposeEditor({
  initialContent,
  onChange,
}: {
  initialContent?: string;
  onChange: (html: string) => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Image,
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Placeholder.configure({ placeholder: "Ihre Nachricht..." }),
      Color,
      TextStyle,
    ],
    content: initialContent ?? "",
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  return (
    <div className="border rounded-lg overflow-hidden">
      <ComposeToolbar editor={editor} />
      <EditorContent editor={editor} className="prose prose-sm dark:prose-invert max-w-none p-4 min-h-[200px]" />
    </div>
  );
}
```

## Prisma Schema Changes

The existing `EmailMessage` model is a basic placeholder. Phase 3 requires these new/expanded models:

```prisma
// New: Email account configuration
model EmailKonto {
  id            String   @id @default(cuid())
  name          String   // Display name, e.g. "Kanzlei Hauptpostfach"
  imapHost      String
  imapPort      Int      @default(993)
  imapSecure    Boolean  @default(true)
  smtpHost      String
  smtpPort      Int      @default(587)
  smtpSecure    Boolean  @default(false)
  emailAdresse  String   // The email address
  benutzername  String   // IMAP/SMTP login username
  passwortEnc   String?  // AES-256-GCM encrypted password
  authTyp       String   @default("password") // "password" | "oauth2_microsoft" | "oauth2_google"
  oauthTokens   Json?    // Encrypted { accessToken, refreshToken, expiresAt }
  istKanzlei    Boolean  @default(false) // Shared Kanzlei mailbox
  aktiv         Boolean  @default(true)
  initialSync   String   @default("30_TAGE") // "NUR_NEUE" | "30_TAGE" | "ALLES"
  importFolder  String   @default("Importierte Emails") // IMAP folder for veraktete emails
  letzterSync   DateTime?
  syncStatus    String   @default("GETRENNT") // "VERBUNDEN" | "FEHLER" | "GETRENNT"
  letzterFehler String?
  fehlerLog     Json?    // Last 5 errors: [{ timestamp, message }]
  softDeleteTage Int     @default(30) // Retention period for soft-deleted items
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  zuweisungen   EmailKontoZuweisung[]
  ordner        EmailOrdner[]
  nachrichten   EmailNachricht[]

  @@map("email_konten")
}

// New: User-to-mailbox assignment
model EmailKontoZuweisung {
  id          String     @id @default(cuid())
  kontoId     String
  konto       EmailKonto @relation(fields: [kontoId], references: [id], onDelete: Cascade)
  userId      String
  user        User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt   DateTime   @default(now())

  @@unique([kontoId, userId])
  @@map("email_konto_zuweisungen")
}

// New: Synced IMAP folders
model EmailOrdner {
  id            String     @id @default(cuid())
  kontoId       String
  konto         EmailKonto @relation(fields: [kontoId], references: [id], onDelete: Cascade)
  name          String     // Display name
  pfad          String     // IMAP path (e.g. "INBOX", "INBOX/Subfolder")
  spezialTyp    String?    // "INBOX" | "SENT" | "DRAFTS" | "TRASH" | "JUNK" | "ARCHIVE" | null
  ungeleseneAnzahl Int     @default(0)
  gesamtAnzahl    Int      @default(0)
  sortierung    Int        @default(0)
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt

  nachrichten   EmailNachricht[]

  @@unique([kontoId, pfad])
  @@index([kontoId])
  @@map("email_ordner")
}

// Expanded: Replace basic EmailMessage with full-featured model
model EmailNachricht {
  id              String         @id @default(cuid())
  // IMAP tracking
  emailKontoId    String
  emailKonto      EmailKonto     @relation(fields: [emailKontoId], references: [id], onDelete: Cascade)
  emailOrdnerId   String?
  emailOrdner     EmailOrdner?   @relation(fields: [emailOrdnerId], references: [id], onDelete: SetNull)
  imapUid         Int?           // IMAP UID within folder
  imapFolder      String?        // IMAP folder path at time of sync
  // Message identity
  messageId       String?        @unique // Message-ID header
  inReplyTo       String?        // In-Reply-To header
  references      String[]       // References header (array of Message-IDs)
  threadId        String?        // Computed thread root Message-ID
  // Content
  richtung        EmailRichtung  @default(EINGEHEND)
  betreff         String
  absender        String
  absenderName    String?
  empfaenger      String[]
  cc              String[]
  bcc             String[]
  inhalt          String?        @db.Text // Sanitized HTML body
  inhaltText      String?        @db.Text // Plain text body
  // Dates
  empfangenAm     DateTime?
  gesendetAm      DateTime?
  // Flags
  gelesen         Boolean        @default(false)
  flagged         Boolean        @default(false)
  prioritaet      String?        // "hoch" | "niedrig" | null (from X-Priority header)
  // Size
  groesse         Int?           // Total message size in bytes
  // Veraktung
  veraktet        Boolean        @default(false)
  verantwortlichId String?
  verantwortlich   User?         @relation("EmailVerantwortlicher", fields: [verantwortlichId], references: [id])
  // Soft delete
  geloescht       Boolean        @default(false)
  geloeschtAm     DateTime?
  // Send status (for outgoing)
  sendeStatus     String?        // "ENTWURF" | "GEPLANT" | "WIRD_GESENDET" | "GESENDET" | "FEHLGESCHLAGEN"
  geplanterVersand DateTime?     // Scheduled send time
  sendeFehler     String?        // Error message if send failed
  // Ticket link
  ticketId        String?
  ticket          Ticket?        @relation(fields: [ticketId], references: [id], onDelete: SetNull)
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  anhaenge        EmailAnhang[]
  veraktungen     EmailVeraktung[]

  @@index([emailKontoId, imapFolder, imapUid])
  @@index([emailOrdnerId])
  @@index([threadId])
  @@index([empfangenAm])
  @@index([gelesen])
  @@index([veraktet])
  @@index([verantwortlichId])
  @@index([geloescht])
  @@index([sendeStatus])
  @@map("email_nachrichten")
}

// New: Email attachments (stored in MinIO)
model EmailAnhang {
  id              String         @id @default(cuid())
  emailNachrichtId String
  emailNachricht  EmailNachricht @relation(fields: [emailNachrichtId], references: [id], onDelete: Cascade)
  dateiname       String
  mimeType        String
  groesse         Int            // bytes
  dateipfad       String         // MinIO storage key
  contentId       String?        // CID for inline images
  createdAt       DateTime       @default(now())

  @@index([emailNachrichtId])
  @@map("email_anhaenge")
}

// New: Veraktung log (audit trail)
model EmailVeraktung {
  id              String         @id @default(cuid())
  emailNachrichtId String
  emailNachricht  EmailNachricht @relation(fields: [emailNachrichtId], references: [id], onDelete: Cascade)
  akteId          String
  akte            Akte           @relation(fields: [akteId], references: [id])
  userId          String
  user            User           @relation(fields: [userId], references: [id])
  notiz           String?        // Optional context note
  anhaengeKopiert String[]       // IDs of EmailAnhang that were copied to DMS
  dmsOrdner       String?        // Target DMS folder name
  aufgehoben      Boolean        @default(false) // Reversible
  aufgehobenAm    DateTime?
  createdAt       DateTime       @default(now())

  @@index([emailNachrichtId])
  @@index([akteId])
  @@map("email_veraktungen")
}
```

**Note:** The existing `EmailMessage` model in the schema should be replaced or migrated to `EmailNachricht`. Relations from `Akte`, `Beteiligter`, and `Ticket` need updating accordingly.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| node-imap (mscdex) | imapflow (postalsys) | 2020+ | node-imap unmaintained since 2019; imapflow has modern async/await, TypeScript, IDLE, OAuth2 |
| Polling IMAP server | IMAP IDLE (RFC 2177) | Standard since 2003 | Real-time delivery within seconds vs polling delay; zero bandwidth when idle |
| sanitize-html only | sanitize-html (server) + DOMPurify (client) | 2023+ pattern | Defense-in-depth; server strips dangerous HTML, client provides final DOM-level safety |
| Custom WYSIWYG (contentEditable) | TipTap/ProseMirror | 2020+ | Robust schema-based editing with modular extensions; replaces brittle execCommand |
| react-window | @tanstack/react-virtual | 2022+ | Headless, framework-agnostic, smaller bundle, maintained by TanStack |
| Password auth only | OAuth2 (XOAUTH2) for M365/Gmail | 2022 (Gmail), 2024 (Microsoft) | Microsoft deprecated basic auth for IMAP; OAuth2 mandatory for M365 |

**Deprecated/outdated:**
- **node-imap**: Last commit 2019, no TypeScript, callback-based, no IDLE support out of the box
- **Imap (mail-listener2)**: Wrapper around node-imap, also abandoned
- **nodemailer v6**: Older, v7 is current stable (v8 just released but has breaking changes)
- **Microsoft Basic Auth for IMAP**: Deprecated as of October 2022; must use OAuth2 for Office 365

## Open Questions

1. **LanguageTool Docker Integration Scope**
   - What we know: LanguageTool runs as a Docker sidecar with REST API on port 8010; supports German with n-grams
   - What's unclear: Should it be added to docker-compose.yml in this phase, or is it sufficient to prepare the integration with a configurable URL? The LanguageTool Docker image is ~1.5GB+ with German language data.
   - Recommendation: Add LanguageTool to docker-compose.yml as an optional service (profiles: ["full"]) and implement the TipTap integration. The REST API is simple (`POST /v2/check` with `text` and `language=de-DE`). If the container isn't running, spell-check is simply disabled.

2. **OAuth2 Token Management Complexity**
   - What we know: ImapFlow supports `auth.accessToken` for XOAUTH2. Microsoft requires Azure AD app registration with `https://outlook.office365.com/.default` scope. Google requires OAuth consent screen + `https://mail.google.com/` scope.
   - What's unclear: Full OAuth2 flow implementation (redirect URI, consent, token storage, refresh) is complex. Is password auth sufficient for MVP?
   - Recommendation: Implement password auth first as the core path. Add OAuth2 as a follow-up within this phase if time permits. The `authTyp` field in the schema supports both. For password-only MVP, the user enters IMAP/SMTP credentials directly.

3. **Bidirectional Sync vs One-Way Import**
   - What we know: CONTEXT.md says "Bidirectional sync: deletions/moves on IMAP server reflected in app and vice versa." But REQUIREMENTS.md (Out of Scope) says "Bidirektionaler IMAP-Sync -- One-Way-Import korrekt; Flags zurueck = fragil."
   - What's unclear: These contradict. Requirements says out of scope, but user decisions in CONTEXT.md explicitly include it.
   - Recommendation: Implement bi-directional sync for the primary operations (delete, move, mark read/unread, flag). The CONTEXT.md decisions (from user discussion) take precedence over general requirements notes. Use IMAP commands (`messageMove`, `messageFlagsAdd`, `messageDelete`) to push local changes to the server.

4. **Existing EmailMessage Model Migration**
   - What we know: The current schema has a basic `EmailMessage` model with simple fields. Phase 3 needs a much richer model.
   - What's unclear: Whether to evolve the existing model or create a new model and migrate.
   - Recommendation: Create new models (`EmailNachricht`, `EmailKonto`, etc.) rather than modifying `EmailMessage`. The existing model has relationships from `Akte` and `Ticket` that need to be re-pointed. Use a Prisma migration to handle the transition. The existing email pages/components are placeholders that will be replaced entirely.

## Sources

### Primary (HIGH confidence)
- [ImapFlow API Documentation](https://imapflow.com/docs/api/imapflow-client/) - Full API reference, constructor options, methods, events
- [ImapFlow GitHub](https://github.com/postalsys/imapflow) - Source code, issues, reconnection patterns
- [ImapFlow GitHub Issue #14](https://github.com/postalsys/imapflow/issues/14) - IDLE stops listening, close event handling
- [ImapFlow GitHub Issue #63](https://github.com/postalsys/imapflow/issues/63) - Reconnection: must create new instance, cannot reuse
- [Node.js Crypto Docs](https://nodejs.org/api/crypto.html) - AES-256-GCM encryption pattern
- [Nodemailer SMTP Transport](https://nodemailer.com/smtp) - SMTP configuration
- [TipTap React Installation](https://tiptap.dev/docs/editor/getting-started/install/react) - Editor setup
- [TanStack Virtual Docs](https://tanstack.com/virtual/latest/docs/introduction) - Virtualizer API
- [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels) - Panel layout API
- [shadcn/ui Resizable](https://ui.shadcn.com/docs/components/radix/resizable) - shadcn wrapper for react-resizable-panels
- [RFC 5256](https://www.rfc-editor.org/rfc/rfc5256.html) - IMAP SORT and THREAD extensions
- [JWZ Threading Algorithm](https://www.jwz.org/doc/threading.html) - Email threading reference algorithm

### Secondary (MEDIUM confidence)
- [sanitize-html npm](https://www.npmjs.com/package/sanitize-html) - Configuration options, allowed tags/attributes
- [DOMPurify GitHub](https://github.com/cure53/DOMPurify) - DOM sanitization, React usage patterns
- [mailparser npm](https://www.npmjs.com/package/mailparser) - MIME parsing API, simpleParser
- [LanguageTool API Docs](https://languagetool.org/http-api/) - REST API for spell/grammar checking
- [LanguageTool Docker](https://hub.docker.com/r/erikvl87/languagetool/) - Docker image setup
- [Microsoft IMAP OAuth2](https://learn.microsoft.com/en-us/exchange/client-developer/legacy-protocols/how-to-authenticate-an-imap-pop-smtp-application-by-using-oauth) - Office 365 XOAUTH2 setup

### Tertiary (LOW confidence)
- LanguageTool n-gram data and exact Docker image size for German -- need to verify with actual Docker pull
- Exact TipTap extension versions -- used ^2.11.5 based on npm listing, should verify compatibility
- OAuth2 flow complexity for Google/Microsoft -- research showed the protocol but not end-to-end Next.js integration patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - ImapFlow, nodemailer, mailparser, TipTap, sanitize-html are well-documented, actively maintained, and verified via official docs
- Architecture: MEDIUM-HIGH - Worker IMAP pattern is based on ImapFlow maintainer guidance and GitHub issue resolution; Prisma schema design follows existing project patterns
- Pitfalls: HIGH - IDLE/reconnection issues are well-documented in ImapFlow issues; HTML sanitization patterns are standard; memory concerns are known Node.js patterns
- UI patterns: MEDIUM - react-resizable-panels and @tanstack/react-virtual are standard but the specific three-pane email layout combination needs implementation validation

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (30 days -- stable domain, libraries are mature)
