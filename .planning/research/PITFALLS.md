# Pitfalls Research

**Domain:** AI-First Kanzleisoftware (German Legal Practice Management)
**Researched:** 2026-02-24
**Confidence:** HIGH (domain-specific legal requirements verified, technical pitfalls corroborated across multiple sources)

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, compliance violations, or major architectural issues.

### Pitfall 1: IMAP IDLE in Next.js Serverless Architecture

**What goes wrong:**
IMAP IDLE requires persistent, long-lived TCP connections. Next.js API routes and Server Actions execute in a request-response cycle and then terminate. Implementing IMAP IDLE inside Next.js route handlers causes connections to drop after every request, leading to lost real-time email notifications, zombie connections that exhaust IMAP connection limits, and eventual sync failures. ISPs drop idle TCP connections after 5 minutes of inactivity, and providers like Yahoo limit concurrent IMAP connections to 5 per IP.

**Why it happens:**
Developers treat the email sync process like a regular API call. They open an IMAP connection in a route handler, fetch emails, then try to maintain IDLE -- but the serverless function terminates. Even with self-hosted Next.js (custom server), the IMAP IDLE loop does not belong inside the HTTP request lifecycle.

**How to avoid:**
Run a **separate long-running Node.js worker process** outside Next.js for IMAP IDLE. Use BullMQ or a simple event loop with ImapFlow in a dedicated process managed by Docker Compose as its own service. The worker writes new emails to PostgreSQL; Next.js reads from the database. Communicate real-time updates via Server-Sent Events or WebSocket from a separate endpoint that polls the DB or listens to PostgreSQL NOTIFY.

**Warning signs:**
- Emails only appear after page refresh
- IMAP "too many connections" errors in logs
- E-Mail sync stops working after a few hours without anyone noticing
- Connection timeout errors every 5-30 minutes

**Phase to address:**
Email Client phase. Decide the worker architecture BEFORE writing any IMAP code. The Docker Compose service definition for the IMAP worker must be part of the first task.

---

### Pitfall 2: Fristenberechnung Edge Cases (BGB Sections 187-193)

**What goes wrong:**
Incorrect deadline calculations lead to missed court deadlines (Fristversaeumnis), which can cause automatic loss of cases, malpractice liability, and bar disciplinary proceedings. Specific edge cases that trip up implementations:

1. **Month-end overflow:** Adding 1 month to January 31 must yield February 28 (or 29 in leap years), not March 2/3. Section 188 Abs. 2 BGB: if the reference day does not exist in the final month, the deadline ends on the last day of that month.
2. **Section 193 BGB weekend/holiday extension:** Deadlines ending on Saturday, Sunday, or a Feiertag (public holiday) extend to the **next business day** -- but only for deadlines involving "Abgabe einer Willenserklaerung" or "Bewirkung einer Leistung" (submission of declarations or performance of services). Pure computation deadlines (like Verjaehrung) do NOT extend.
3. **Bundesland-specific holidays:** Fronleichnam is a holiday in NRW but not in Berlin. Reformationstag is a holiday in some states but not NRW. Using the wrong holiday calendar for the relevant court/authority causes wrong deadline calculation.
4. **Event-triggered vs. date-triggered start:** Section 187 Abs. 1 (event-triggered: day of event NOT counted) vs. Section 187 Abs. 2 (date-triggered: start of the day IS the beginning) produce different results.
5. **Leap year bugs:** February 29 handling in date arithmetic is a classic source of off-by-one errors.

**Why it happens:**
Developers use naive date arithmetic (`date.setMonth(date.getMonth() + 1)`) which overflows incorrectly. They treat all deadlines the same regarding weekend extension. They hardcode a single holiday list instead of making it Bundesland-aware.

**How to avoid:**
- Build a dedicated `FristenRechner` module with exhaustive unit tests covering every edge case listed above. This is one of the few areas where the "max 20% test effort" rule should be relaxed -- test coverage here should approach 100%.
- Use a table-driven approach: each Bundesland has a holiday configuration, and the relevant Bundesland is determined by the court/authority location or a user-configurable default (NRW for Kanzlei Baumfalk).
- Implement the Vorfrist (pre-deadline) calculation as a configurable offset (e.g., 7 days before, 3 days before, 1 day before) that also respects business days.
- Never use JavaScript's native Date arithmetic for month/year addition -- use date-fns or Temporal API with explicit edge case handling.

**Warning signs:**
- No unit tests for month-end, year-end, leap year, and holiday scenarios
- A single holiday list without Bundesland selection
- Using `new Date()` arithmetic without library support
- Frist and Vorfrist always falling on the same weekday pattern (suggests no weekend adjustment)

**Phase to address:**
Deadline Calculation phase. This must be built and tested BEFORE integrating with the AI automatic deadline recognition feature. The FristenRechner must be a pure function library, not entangled with UI or database code.

---

### Pitfall 3: RVG Calculation Complexity and Version Drift

**What goes wrong:**
The RVG (Rechtsanwaltsverguetungsgesetz) has been amended multiple times (2021 KostRAeG, June 2025 KostBRAeG with 6% linear increase). Implementing RVG calculations incorrectly leads to under-billing or over-billing clients, rejected Kostenerstattung applications, and auditor findings. Common mistakes:
1. **Hardcoded fee tables** that are not versioned -- when the law changes, all calculations break silently.
2. **Anrechnung rules** (VV Vorbemerkung 3 Abs. 4): the Geschaeftsgebuehr (business fee, VV 2300) must be credited against the Verfahrensgebuehr (procedural fee, VV 3100) at 50-75%. Getting this wrong over- or under-charges the client.
3. **Streitwert brackets** are not linear -- they step up at specific thresholds (500, 1000, 1500, 2000 ... up to 500,000 EUR and beyond) with different calculation rules above 500,000 EUR.
4. **Multiple mandates / Gebuehrenerhoeung:** When representing multiple clients (Section 7 RVG), fees increase by 0.3 per additional client for Verfahrensgebuehr -- but with a cap.
5. **Auslagenpauschale (VV 7002):** 20% of fees, capped at 20 EUR. Trivial to compute but frequently forgotten.

**Why it happens:**
The RVG is genuinely complex legal regulation that requires legal domain expertise to implement correctly. Developers without legal background miss edge cases. Fee tables get hardcoded without versioning.

**How to avoid:**
- Store fee tables as **versioned data** (JSON or DB rows) with effective date ranges. When KostBRAeG 2025 takes effect on June 1, 2025, a new table version is loaded. Old invoices keep the old table.
- Implement Anrechnung as a configurable rule engine, not hardcoded if-else chains.
- Validate output against the DAV Prozesskostenrechner (https://anwaltsblatt.anwaltverein.de/de/apps/prozesskostenrechner) for test cases across the Streitwert range.
- Treat RVG calculation as a pure function library with extensive unit tests (second area where >20% test effort is justified).

**Warning signs:**
- Fee table hardcoded in source code rather than data
- No effective-date concept for fee schedule versions
- Anrechnung logic missing entirely
- No comparison tests against established RVG calculators

**Phase to address:**
Financial Module phase. Build and test the RVG calculator as an isolated module BEFORE building the invoice UI. Invoice PDF rendering depends on correct calculation output.

---

### Pitfall 4: OnlyOffice WOPI Lock Management and Data Loss

**What goes wrong:**
OnlyOffice's WOPI implementation has specific behaviors that cause silent data loss if not handled correctly:
1. **Lock expiration after 30 minutes:** If the editing session lasts longer than 30 minutes and the host does not handle RefreshLock, the file is unlocked and another user can overwrite it. OnlyOffice periodically sends RefreshLock, but if the host fails to process it (e.g., returns wrong status code), the lock expires silently.
2. **Missing PutFile callbacks:** In some scenarios, the user clicks save but the WOPI POST from OnlyOffice to the host does not fire (documented GitHub issue #1884). If the host does not implement forced periodic saves via CoAuthoring configuration, user changes are lost when the browser tab closes.
3. **Access token expiration:** Tokens must have a TTL of at least 10 hours for collaborative editing. If tokens expire too quickly, the editor becomes read-only mid-session without clear user feedback.
4. **IP allow-listing:** WOPI requests from OnlyOffice Docker container must be allowed. If the allow list is wrong, all save operations silently fail.

**Why it happens:**
WOPI is a complex protocol originally designed by Microsoft. OnlyOffice's implementation has idiosyncrasies documented only in GitHub issues, not official docs. Developers test with short editing sessions and miss the lock timeout issue.

**How to avoid:**
- Implement ALL WOPI endpoints (CheckFileInfo, GetFile, PutFile, Lock, RefreshLock, Unlock, UnlockAndRelock) even if some seem optional -- they are not optional for production stability.
- Configure `CoAuthoring.commandService.token.inbox.expires` to at least 36000 (10 hours).
- Implement a health-check that verifies the WOPI callback URL is reachable from the OnlyOffice container.
- Add an application-side auto-save that triggers PutFile at regular intervals as a safety net.
- Test editing sessions lasting >1 hour with multiple concurrent users before declaring WOPI "done."

**Warning signs:**
- WOPI works for new/short sessions but fails for long editing sessions
- Documents revert to old versions after closing browser
- "File is locked" errors appearing unexpectedly
- OnlyOffice container logs showing 409 Conflict on PutFile

**Phase to address:**
OnlyOffice WOPI Rebuild phase. This must be a dedicated phase with thorough testing, not bolted onto document upload. The existing basis (documented as having problems in PROJECT.md) needs a clean WOPI implementation from scratch.

---

### Pitfall 5: Fremdgeld Accounting Violations (BRAO Section 43a Abs. 7)

**What goes wrong:**
Attorneys in Germany have strict professional obligations regarding Fremdgeld (third-party funds). Violations lead to bar disciplinary proceedings, personal liability, and in severe cases criminal prosecution. Software mistakes:
1. **No separation of Fremdgeld and Honorar:** The Aktenkonto model stores both with `buchungstyp: FREMDGELD | EINNAHME | AUSGABE | AUSLAGE` but does not enforce that Fremdgeld balances are tracked separately and forwarded within one week.
2. **Amounts over 15,000 EUR on collective account:** Funds exceeding this threshold require an individual Anderkonto (escrow account) per Section 4 BORA. Software that does not flag this creates compliance risk.
3. **Missing forwarding deadline tracking:** Fremdgeld must be forwarded "unverzueglich" (without culpable delay, practically 3-7 days). Without automatic tracking and alerts, funds sit in the Aktenkonto and the attorney violates BRAO.
4. **Saldo display mixing Fremdgeld and own funds:** If the UI shows a combined balance without clearly separating Fremdgeld from office funds, the attorney loses overview of their obligations.

**Why it happens:**
Developers treat Fremdgeld as just another booking type without understanding the legal obligation to keep it separate. The current `BuchungsTyp` enum has the correct types but the application layer does not enforce the forwarding rules.

**How to avoid:**
- Display Fremdgeld balance **separately** on every Aktenkonto view, clearly labeled.
- Implement a Fremdgeld alert system: any Fremdgeld booking older than 5 business days without a corresponding outgoing transfer triggers an alert on the dashboard and a notification to the responsible attorney.
- Add a threshold check for the 15,000 EUR individual Anderkonto requirement.
- Make Fremdgeld booking reversal require ADMIN or ANWALT approval (not SACHBEARBEITER or SEKRETARIAT).

**Warning signs:**
- Aktenkonto showing a single combined "Saldo" without Fremdgeld breakdown
- No alerts or dashboards for pending Fremdgeld forwarding
- Booking correction possible by any role without approval workflow

**Phase to address:**
Financial Module phase. Must be addressed when building the Aktenkonto UI, not deferred to "compliance hardening" later.

---

### Pitfall 6: RAG Pipeline Producing Legally Dangerous Hallucinations

**What goes wrong:**
The AI (OpenClaw) uses RAG to answer questions about case documents. If the chunking strategy splits legal arguments mid-paragraph, the retrieval returns truncated context, and the LLM generates a confidently wrong answer. In legal work, this is dangerous: a hallucinated deadline, a fabricated statute reference, or a misquoted court decision can lead to malpractice.

Specific failure modes:
1. **Chunking splits legal clauses:** A liability clause spanning 650 tokens gets split at token 512, producing two meaningless fragments. The embedding of each fragment does not capture the full legal meaning.
2. **German compound words defeat embeddings:** German legal language uses extremely long compound words (Eigenbedarfskuendigungsvoraussetzungen) and domain-specific terms that general-purpose embedding models (trained primarily on English) represent poorly.
3. **Cross-document reasoning fails silently:** "What is the opposing party's position?" requires synthesizing across multiple documents. RAG retrieving top-k chunks from different documents often misses the coherent narrative.
4. **Embedding model version mismatch:** Changing the embedding model (e.g., upgrading from `text-embedding-ada-002` to `text-embedding-3-small`) without re-embedding all existing vectors produces nonsensical similarity scores because vector spaces are incompatible.

**Why it happens:**
RAG demos work well on clean English text. German legal documents have long paragraphs, nested references (Section X in conjunction with Section Y), and domain-specific vocabulary. The default "512-token fixed-size chunks with 10% overlap" strategy from tutorials does not work well for this domain.

**How to avoid:**
- Use **layout-aware/semantic chunking**: parse DOCX/PDF structure and split at paragraph or section boundaries, not at fixed token counts. A chunk should represent a complete legal thought.
- Use a **German-capable embedding model**: `multilingual-e5-large` or `deutsche-telecom/gbert-large` rather than OpenAI's English-optimized models. If using Ollama locally, choose a multilingual model.
- Store **embedding model version** with every vector in pgvector. When upgrading the model, mark old embeddings for re-processing.
- Implement a **confidence threshold**: if retrieval similarity scores are below a threshold, the AI should say "I could not find reliable information" rather than hallucinate.
- Always show **source citations** (document name, page/section) with every AI response so attorneys can verify.

**Warning signs:**
- AI answers that cite non-existent paragraphs or court decisions
- Retrieval returning irrelevant chunks (test with known questions)
- Embedding quality not tested with German legal vocabulary
- No "I don't know" responses (model always produces an answer)

**Phase to address:**
AI/RAG phase. Chunking strategy and embedding model choice must be validated with real German legal documents BEFORE building the chat UI. Start with a small test corpus of actual Kanzlei documents.

---

### Pitfall 7: E-Rechnung Format Validation Chaos (XRechnung + ZUGFeRD)

**What goes wrong:**
Since January 1, 2025, B2B e-invoicing is mandatory in Germany. Invoices sent to courts require XRechnung format; invoices to companies often need ZUGFeRD (PDF/A-3 with embedded CII XML). Implementation failures:
1. **ZUGFeRD hybrid format inconsistency:** The PDF visual representation and the embedded XML can contain different amounts/data. Automated systems process the XML; humans read the PDF. If they diverge, the recipient's accounting system books a different amount than what the invoice visually shows.
2. **XRechnung syntax confusion:** XRechnung supports both UBL (Universal Business Language) and CII (Cross Industry Invoice) syntaxes. Most German authorities expect CII, but some systems only accept UBL. Sending the wrong syntax causes silent rejection.
3. **Mandatory field validation:** Missing Leitweg-ID (routing ID for public sector), wrong Umsatzsteuer-ID format, or incorrect BT-reference numbers cause invoice rejection days after sending.
4. **PDF/A-3 conformance:** ZUGFeRD requires PDF/A-3, not regular PDF. Most PDF generators produce standard PDF which looks identical but fails machine validation.

**Why it happens:**
The German e-invoicing landscape has two competing standards with overlapping scopes. Most developers implement one and discover they need the other. Validation is complex and not well-documented in English resources.

**How to avoid:**
- Use an established library for XML generation (e.g., `mustang` for ZUGFeRD/Factur-X in Java, or build on the XRechnung Schematron validation rules published by KoSIT).
- Validate EVERY generated invoice against the official XRechnung Validator (https://erechnungsvalidator.service-bw.de/) and ZUGFeRD validator before declaring the implementation complete.
- Store the validation result with each invoice.
- For PDF/A-3 generation, use a library that explicitly targets this format (not a general PDF library with an "archive" flag).

**Warning signs:**
- E-Rechnung feature "works" but was never tested against an official validator
- ZUGFeRD PDFs that cannot be parsed by DATEV or Lexware on the recipient side
- XRechnung submissions rejected by government portals without clear error messages

**Phase to address:**
Financial Module phase, specifically the invoicing sub-phase. E-Rechnung should NOT be deferred to "later" -- it is legally mandatory and must be part of the first invoice implementation.

---

### Pitfall 8: Client Portal Authentication Isolation Failure

**What goes wrong:**
The Mandantenportal requires a completely separate authentication system (invitation link + password) from the internal Kanzlei auth (NextAuth.js v5 with RBAC). If these systems share session cookies, JWT secrets, or database tables without proper isolation, a portal user could escalate privileges to access internal case data, or internal cookies could leak to the portal subdomain.

Specific risks:
1. **Shared JWT secret:** If the portal and internal app use the same JWT signing key and the token payload does not enforce audience separation, a portal token could be accepted by internal API routes.
2. **Cookie domain scope:** If the internal app runs on `app.kanzlei.de` and the portal on `portal.kanzlei.de`, a cookie set on `.kanzlei.de` (parent domain) is sent to both, potentially leaking internal sessions to the portal.
3. **Missing Akte-scoped access control:** A portal user should only see documents explicitly shared for their Akte. If the API checks `user.id` but not `akte.portalFreigabe`, the user can enumerate other Akten by ID.

**Why it happens:**
Developers reuse the existing auth infrastructure for speed. They add a "MANDANT" role to the UserRole enum and add the portal user to the same users table. This creates a single-point-of-failure for access control.

**How to avoid:**
- Use a **separate database table** for portal users (`PortalUser`) not connected to the internal `User` model.
- Issue portal JWTs with a different signing key and a distinct `aud` (audience) claim. Validate the audience on every API route.
- Set cookies with explicit `domain` scoping (never parent domain).
- Implement **share-based access**: documents must be explicitly added to a `PortalFreigabe` table before they appear in the portal. No implicit access based on Akte association.
- Every portal API route must check both authentication AND Akte-level authorization. Use middleware that rejects any request without a valid portal-specific token.

**Warning signs:**
- Portal users stored in the same `users` table as internal staff
- Single JWT secret for both internal and portal authentication
- Portal showing documents that were not explicitly shared
- No separate middleware stack for portal routes

**Phase to address:**
Client Portal phase. Must define the authentication architecture in the FIRST task of the portal phase, before building any UI. Retrofitting auth isolation after building the portal is extremely costly.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Storing email HTML body directly in PostgreSQL TEXT column | Simple, no separate storage | Database bloat (emails with inline images can be 5-10 MB each), slow queries on email listing | Never for production -- store bodies in MinIO, keep only metadata + plain text excerpt in DB |
| Using JSON column for Rechnung.positionen instead of a relation | Fast to implement, flexible | Cannot query individual line items, no referential integrity, harder RVG Anrechnung logic | Only for MVP if invoice querying is not needed |
| Embedding all documents synchronously on upload | Simple pipeline | Blocks upload UI for large documents, single failure stops the upload, no retry mechanism | Never -- always use async queue |
| Single Prisma schema for both internal and portal models | One migration, one client | Portal user compromise exposes internal schema, harder access control auditing | Never for security-sensitive portal |
| Polling IMAP instead of IDLE | Simpler implementation | Higher server load, delayed email delivery (polling interval), more IMAP connections consumed | Acceptable as Phase 1 of email, replaced by IDLE worker in Phase 2 |
| Hardcoding NRW holidays | Covers the primary use case | Cannot serve clients in other Bundeslaender, wrong deadlines for courts in other states | Only if Kanzlei exclusively works with NRW courts (currently true, may change) |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| OnlyOffice Docker | Using `localhost` URLs in WOPI discovery from inside Docker network | Use Docker service names (e.g., `http://onlyoffice:80`) for server-to-server; use the external-facing URL (e.g., `https://office.kanzlei.de`) for browser-to-OnlyOffice. Implement `rewriteOnlyOfficeUrl()` for URL translation (already documented in MEMORY.md). |
| Stirling-PDF OCR | Running OCR synchronously in request handler -- times out after 60 seconds, but OCR continues in background, producing ghost results | Use an async job queue. Submit OCR job, return immediately, poll for result. Stirling-PDF's own UI has this 60-second timeout bug (GitHub issue #5130). |
| Meilisearch indexing | Indexing documents with full-text content in a single field | Use structured documents with separate fields (title, body, tags, akteId) and configure searchable/filterable attributes separately. Otherwise, Akte filtering becomes full-text matching instead of faceted filtering. |
| DATEV CSV Export | Opening the exported CSV in Excel to verify -- Excel destroys the format (converts dates to serial numbers, removes leading zeros) | Validate with a hex editor or programmatic parser. DATEV format requires specific header rows, semicolon delimiters, and UTF-8 encoding. Field length limits: Buchungstext max 60 chars, Belegnummer max 36 chars. Forbidden characters include umlauts in specific fields. |
| CalDAV Sync | Implementing bidirectional sync without loop prevention | Track change origin with metadata (custom X-properties in iCal events). Implement version numbers. Use ETags for conflict detection. Start with one-way sync (export only) before attempting bidirectional. |
| SEPA XML Generation | Generating pain.001/pain.008 without schema validation | ALWAYS validate against the official XSD schema before writing the file. Common errors: wrong IBAN format, amounts with more than 2 decimal places, due dates on non-TARGET days, missing BIC for international transfers. UTF-8 encoding mandatory. |
| beA API | Attempting to build a direct OSCI/EGVP integration | Use the beA.expert API or BRAK's KSW-Toolkit as an intermediary. Direct OSCI protocol implementation requires certification and is not feasible for a single-Kanzlei project. The API handles encryption, session management, and protocol compliance. |
| Ollama / Local LLM | Assuming Ollama is always available and fast | Ollama can be slow on CPU (minutes per response for 7B models), OOM on GPU, or simply down. Always implement timeouts, fallback to cloud providers (OpenAI/Anthropic), and queue-based processing. Never call Ollama synchronously in a user-facing request. |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading all emails for an Akte in a single query | Inbox page takes >5 seconds to load | Cursor-based pagination on `empfangenAm`, lazy-load email bodies | >500 emails per Akte |
| pgvector cosine similarity scan without index | Vector search takes >1 second | Create HNSW index (`CREATE INDEX ON embeddings USING hnsw (embedding vector_cosine_ops)`) early. IVFFlat requires periodic rebuild. | >10,000 vectors |
| Storing all document versions in MinIO without cleanup | MinIO storage grows unboundedly | Implement version retention policy (keep last N versions + all explicitly pinned). Compress old versions. | >5,000 documents across all Akten |
| IMAP full sync on every worker restart | Worker startup takes 10+ minutes, overloads IMAP server | Store sync state (UIDVALIDITY, last synced UID) in DB. Only fetch new messages on restart. Full sync only on explicit user request or first setup. | >10,000 emails in mailbox |
| Meilisearch indexing every field of every document | Index becomes slow, consumes excessive RAM | Only index searchable fields. Use Meilisearch's distinct attribute for deduplication. Set `maxTotalHits` appropriately. | >50,000 indexed documents |
| WebSocket connections without heartbeat/cleanup | Memory leak from abandoned connections | Implement heartbeat (30-second ping), close connections without pong response, use connection pool with max size | >50 concurrent users |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| AI responses containing data from Akte A shown to user with access only to Akte B | Cross-case data leakage violating Mandatsgeheimnis (attorney-client privilege) | RAG retrieval MUST filter by Akte ID before similarity search. The pgvector query must include `WHERE akte_id = $1` in addition to vector similarity. Never rely on post-retrieval filtering. |
| Storing IMAP passwords in plaintext in the database | Credential theft exposes all email accounts | Encrypt IMAP credentials at rest using a server-side encryption key (not the database encryption). Use a KMS or at minimum an environment variable key. |
| Portal document links using predictable IDs (CUID) | Enumeration attack: portal user guesses other document IDs and downloads them | Use time-limited signed URLs for document downloads (MinIO presigned URLs with 15-minute TTL). Never expose MinIO paths directly. |
| beA session keys stored in browser localStorage | XSS attack could steal beA session and send messages as the attorney | beA session keys must only exist server-side. The browser sends requests to the Next.js backend, which holds the beA session. |
| AI-generated documents auto-saved without status ENTWURF | AI content could accidentally be sent as if attorney-approved | Enforce the document status workflow: all AI-generated documents MUST start as ENTWURF with `erstelltDurch: 'ai'`. The FREIGEGEBEN transition requires explicit human action and `freigegebenDurchId` set. (Existing schema supports this -- enforce it in business logic.) |
| OnlyOffice WOPI token in URL query parameter | Token logged in web server access logs, visible in browser history | Use short-lived tokens (1 hour). Ensure access logs are scrubbed or tokens are not logged. Consider POST-based token delivery where WOPI spec allows. |

## UX Pitfalls

Common user experience mistakes in legal practice management software.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing AI confidence as a percentage (e.g., "92% confident") | Attorneys mistakenly trust high percentages as legal certainty | Show source documents and relevant passages instead. Use qualitative labels: "Basiert auf 3 Dokumenten der Akte" rather than "92% confident." |
| E-Mail verakten (case-filing) requires too many clicks | Staff stops filing emails, case records become incomplete | One-click filing: auto-suggest Akte based on email sender (match against Beteiligte), show suggestion as a toast/banner on the email. Single click to confirm. |
| Calendar deadline view mixed with appointments | Critical Fristen get lost among routine Termine | Dedicated "Fristenkalender" view separate from general calendar. Use the existing `KalenderTyp` enum to filter. Color-code: Fristen in red/amber, Termine in blue, Wiedervorlagen in gray. |
| Document search returning results from all Akten without context | Attorney sees a document title without knowing which case it belongs to | Always show Aktenzeichen + Kurzrubrum alongside every document in search results. Group results by Akte. |
| Mandantenportal showing legal jargon | Clients confused by terms like "Freigegeben", "Zugestellt", "Wiedervorlage" | Use simplified German for portal UI: "Bereit zum Download", "Zugestellt am [Datum]", "Ihre naechsten Schritte". Maintain a separate i18n dictionary for portal. |
| Financial module showing cents without comma formatting | Amounts misread (12345 instead of 123,45 EUR) | Use Intl.NumberFormat('de-DE') everywhere. German locale: period for thousands separator, comma for decimal. Store as Decimal in DB, format only in UI layer. |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **IMAP Email Sync:** Often missing handling for HTML-only emails (no plain text part), inline images (CID references), charset encoding beyond UTF-8 (ISO-8859-1, Windows-1252 common in German emails), and multipart/mixed attachments nested inside multipart/alternative -- verify all four.
- [ ] **RVG Calculator:** Often missing Anrechnung logic (VV Vorbem. 3 Abs. 4), Erhoehungsgebuehr for multiple clients (Section 7 RVG), and Auslagenpauschale (VV 7002 -- 20% capped at 20 EUR) -- verify all three are implemented, not just basic Streitwert-to-Gebuehr lookup.
- [ ] **Fristenberechnung:** Often missing Section 193 BGB weekend extension (only applies to specific deadline types, not all), Bundesland holiday awareness, and Vorfrist calculation -- verify with test cases for Jan 31 + 1 month, deadline on Heiligabend (not a Feiertag but courts closed), and Reformationstag (Feiertag only in some states).
- [ ] **WOPI Integration:** Often missing RefreshLock handling, PutFile error recovery, and token renewal mid-session -- verify with a test session lasting >2 hours.
- [ ] **E-Rechnung:** Often missing XRechnung validation against Schematron rules, ZUGFeRD PDF/A-3 conformance, and Leitweg-ID for public sector invoices -- verify with official validators.
- [ ] **DATEV Export:** Often missing correct header row format (EXTF_ prefix, Datenkategorie, Versionsnummer), field length limits (Buchungstext 60 chars), and correct character encoding -- verify by importing into a DATEV test environment or using the official DATEV format validator.
- [ ] **CalDAV Sync:** Often missing conflict resolution for simultaneously edited events, timezone handling (Germany uses CET/CEST with DST transitions), and VTIMEZONE component in iCal output -- verify bidirectional sync with Google Calendar AND Outlook.
- [ ] **Mandantenportal:** Often missing rate limiting on login endpoint (brute force protection), invitation link expiration, and session invalidation when the Mandant is removed from the Akte -- verify all three.
- [ ] **beA Interface:** Often missing XJustiz XML namespace versioning (currently v3.4.1), eEB (electronic acknowledgment) response handling, and Pruefprotokoll display -- verify that the UI handles both successful and failed message transmissions.
- [ ] **OCR Pipeline:** Often missing detection of already-OCR'd PDFs (re-OCR degrades quality), language detection for Tesseract (German requires `deu` language pack, many PDFs contain English too), and handling of scanned-image-only PDFs (no text layer at all) -- verify with real Kanzlei document samples.

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Wrong Fristenberechnung deployed to production | HIGH -- potentially missed deadlines | 1. Immediately recalculate all open Fristen. 2. Notify all attorneys with affected Akten. 3. Check if any Fristen have passed. 4. Deploy fix within hours, not days. 5. Consider adding a manual "Frist pruefen" button for attorneys to verify. |
| WOPI data loss (document reverted to old version) | MEDIUM -- if OnlyOffice stores recovery files | 1. Check OnlyOffice Docker volume for recovery files in `/var/lib/onlyoffice/documentserver/App_Data/cache/files/`. 2. Check MinIO versioning (if enabled) for previous versions. 3. Implement MinIO bucket versioning as prevention for future. |
| Embedding model upgrade without re-embedding | MEDIUM -- search quality degrades | 1. Add `embeddingModel` column to embedding table. 2. Run batch re-embedding job for all documents. 3. During migration, fall back to keyword search (Meilisearch) for documents not yet re-embedded. |
| Fremdgeld not forwarded (compliance issue) | HIGH -- professional liability | 1. Generate immediate report of all Fremdgeld bookings older than 7 days without outgoing transfer. 2. Flag each affected Akte for attorney review. 3. Implement the alert system retroactively. 4. Document the review in AuditLog for compliance records. |
| Portal auth isolation breach | CRITICAL -- Mandatsgeheimnis violation | 1. Immediately disable portal access. 2. Audit all portal access logs (AuditLog) for unauthorized data access. 3. Rebuild portal with separate auth system. 4. Notify affected Mandanten per DSGVO Art. 34 if personal data was exposed. 5. Consult with Datenschutzbeauftragter. |
| IMAP worker crashes and stops syncing | LOW -- if detected quickly | 1. Implement Docker healthcheck with restart policy `unless-stopped`. 2. Dashboard alert for "last sync > 15 minutes ago". 3. Worker resumes from last synced UID (no data loss, just delay). |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| IMAP IDLE in serverless architecture | Email Client | Docker Compose includes separate IMAP worker service; Next.js has zero IMAP imports |
| Fristenberechnung edge cases | Deadline Calculation | Unit test suite with >50 edge case scenarios passes; manual comparison with LTO Fristenrechner for 10 random cases |
| RVG version drift | Financial Module | Fee table stored as versioned data; test invoices match DAV Prozesskostenrechner output |
| WOPI lock/save data loss | OnlyOffice Rebuild | 2-hour editing session test with 2 concurrent users completes without data loss |
| Fremdgeld compliance | Financial Module | Fremdgeld balance displayed separately; 7-day alert triggers on test data |
| RAG hallucination on German legal text | AI/RAG Pipeline | Test with 20 known questions about real case documents; AI cites correct source for >90% |
| E-Rechnung format validation | Financial Module (Invoicing) | Generated invoices pass official XRechnung Validator and ZUGFeRD Checker |
| Portal auth isolation | Client Portal | Penetration test: portal token rejected by internal API; internal token rejected by portal API |
| CalDAV sync loops | Calendar/CalDAV | Bidirectional sync with Google Calendar does not create duplicate events after 10 sync cycles |
| DATEV export format errors | Financial Module | Export file accepted by DATEV Unternehmen Online import (or validated by format checker) |
| beA version/standard changes | beA Interface | XJustiz version configurable; eEB response tested with mock messages |
| Stirling-PDF OCR timeout | Document Pipeline | OCR job for 50-page scanned PDF completes asynchronously; UI shows progress, no timeout error |
| pgvector performance degradation | AI/RAG Pipeline | Vector search returns results in <200ms with >10,000 embeddings; HNSW index created |
| WebSocket memory leak (messaging) | Internal Messaging | Load test with 50 concurrent connections stable for 1 hour; no memory growth |

## Sources

- [Nylas: The Intricacies of IMAP Integration](https://www.nylas.com/blog/the-intricacies-of-integrating-with-imap/) -- MEDIUM confidence (verified pattern across multiple sources)
- [ImapFlow Documentation](https://imapflow.com/module-imapflow-ImapFlow.html) -- HIGH confidence (official library docs)
- [node-imap GitHub Issues #311, #583, #877](https://github.com/mscdex/node-imap/issues) -- HIGH confidence (primary source, real bug reports)
- [OnlyOffice WOPI FAQ](https://api.onlyoffice.com/docs/docs-api/more-information/faq/using-wopi/) -- HIGH confidence (official docs)
- [OnlyOffice DocumentServer GitHub Issue #1884 (Missing WOPI Callback)](https://github.com/ONLYOFFICE/DocumentServer/issues/1884) -- HIGH confidence (primary source)
- [OnlyOffice WOPI Protocol DeepWiki](https://deepwiki.com/ONLYOFFICE/DocumentServer/7.4-wopi-protocol) -- MEDIUM confidence
- [BGB Sections 187-193 on gesetze-im-internet.de](https://www.gesetze-im-internet.de/bgb/__188.html) -- HIGH confidence (authoritative legal source)
- [Constellatio: Fristen Sections 187 ff. BGB](https://www.constellatio.de/artikel/fristen-187-ff-bgb) -- MEDIUM confidence (legal education resource)
- [RVG KostBRAeG 2025 -- Anwaltsblatt](https://anwaltsblatt.anwaltverein.de/de/themen/recht-gesetz/rvg-kostbraeg-2025) -- HIGH confidence (official DAV publication)
- [DAV Prozesskostenrechner](https://anwaltsblatt.anwaltverein.de/de/apps/prozesskostenrechner) -- HIGH confidence (reference implementation)
- [Fremdgeldkonto Checkliste -- Anwaltsblatt](https://anwaltsblatt.anwaltverein.de/de/themen/kanzlei-praxis/fremdgeldkonto-was-anwaeltinnen-und-anwaelte-wissen-muessen) -- HIGH confidence (official DAV guidance)
- [BORA Section 4 -- dejure.org](https://dejure.org/gesetze/BORA/4.html) -- HIGH confidence (authoritative legal source)
- [beA.expert API Documentation](https://bea.expert/api/) -- MEDIUM confidence (third-party API provider)
- [j-lawyer.org beA Integration -- GitHub Issues](https://github.com/jlawyerorg/j-lawyer-org/issues) -- MEDIUM confidence (real-world integration experience)
- [DATEV Buchungsstapel Format -- conaktiv Handbuch](https://handbuch.conaktiv.de/wiki/version-15/buchhaltungsmodule/buchhaltung-in-conaktiv/nutzung-der-datev-schnittstelle-2017/datev-buchungsstapel-datei-extf-buchungsstapel-csv/) -- HIGH confidence (detailed format specification)
- [DATEV Interface Explained -- Qualimero](https://qualimero.com/en/blog/datev-interface-csv-exports-ai-integration) -- MEDIUM confidence
- [Stirling-PDF OCR Issues #5130, #3301](https://github.com/Stirling-Tools/Stirling-PDF/issues) -- HIGH confidence (primary source, confirmed bugs)
- [ZUGFeRD/XRechnung Dilemma -- Finmatics](https://www.finmatics.com/blog/zugferd-vs--xrechnung-das-dilemma-der-e-rechnungs-hybridformate) -- MEDIUM confidence
- [XRechnung FAQ -- e-rechnung-bund.de](https://www.e-rechnung-bund.de/faq/xrechnung/) -- HIGH confidence (official government resource)
- [CalDAV Bidirectional Sync Guide -- CalendHub](https://calendhub.com/blog/implement-bidirectional-calendar-sync-2025/) -- MEDIUM confidence
- [pgvector Performance Tuning -- Medium](https://medium.com/@dikhyantkrishnadalai/optimizing-vector-search-at-scale-lessons-from-pgvector-supabase-performance-tuning-ce4ada4ba2ed) -- LOW confidence (single source, verify with benchmarks)
- [The Case Against pgvector -- Alex Jacobs](https://alex-jacobs.com/posts/the-case-against-pgvector/) -- MEDIUM confidence (corroborated by multiple performance reports)
- [RAG Chunking Strategies -- Weaviate Blog](https://weaviate.io/blog/chunking-strategies-for-rag) -- MEDIUM confidence
- [Chunking Strategies for RAG -- Stack Overflow Blog](https://stackoverflow.blog/2024/12/27/breaking-up-is-hard-to-do-chunking-in-rag-applications/) -- MEDIUM confidence
- [Next.js Real-Time Chat Architecture](https://eastondev.com/blog/en/posts/dev/20260107-nextjs-realtime-chat/) -- MEDIUM confidence
- [EGVP Drittprodukte Anforderungen (OSCI protocol)](https://egvp.justiz.de/Drittprodukte/EGVP_Infrastruktur_Anforderungen_Teilnahme_von_Drittanwendungen.pdf) -- HIGH confidence (official government specification)
- [Kanzleien haben kein KI-Problem, sie haben ein Systemproblem](https://legal-tech-verzeichnis.de/fachartikel/kanzleien-haben-kein-ki-problem-sie-haben-ein-systemproblem/) -- LOW confidence (opinion piece, but validates integration-over-monolith approach)

---
*Pitfalls research for: AI-First Kanzleisoftware (German Legal Practice Management)*
*Researched: 2026-02-24*
