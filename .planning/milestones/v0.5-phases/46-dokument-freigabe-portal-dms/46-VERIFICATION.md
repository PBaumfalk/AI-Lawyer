---
phase: 46-dokument-freigabe-portal-dms
verified: 2026-03-03T14:00:00Z
status: passed
score: 7/7 must-haves verified
re_verification: false
---

# Phase 46: Dokument Freigabe Portal DMS Verification Report

**Phase Goal:** Document sharing — Anwalt toggles mandantSichtbar on documents, Mandant sees freigegebene documents, presigned URL download, Mandant file upload into dedicated folder, Anwalt notification on upload
**Verified:** 2026-03-03T14:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Anwalt kann pro Dokument einen 'Mandant sichtbar' Toggle setzen und zuruecknehmen | VERIFIED | `dokumente-tab.tsx` lines 347-379: `handleMandantSichtbarToggle` with optimistic update, PATCH to `/api/akten/${akteId}/dokumente/${doc.id}/mandant-sichtbar`, role-gated by `MANDANT_SICHTBAR_ROLES` |
| 2 | Mandant sieht im Portal eine Liste aller fuer ihn freigegebenen Dokumente mit Name, Datum, Typ und Groesse | VERIFIED | `portal/akten/[id]/dokumente/page.tsx`: `DocumentRow` renders icon, name, formatted size, formatted German date; `groupByOrdner` helper; Glass card list |
| 3 | Nicht freigegebene Dokumente sind fuer den Mandant unsichtbar (auch per API) | VERIFIED | `portal/akten/[id]/dokumente/route.ts` line 38-39: `prisma.dokument.findMany({ where: { akteId, mandantSichtbar: true } })` — schema-level filter enforced on every request |
| 4 | Mandant kann freigegebene Dokumente ueber signierte MinIO-URLs herunterladen | VERIFIED | `download/route.ts`: loads dokument where `mandantSichtbar: true`, calls `getDownloadUrl(dokument.dateipfad)`, returns `{ url, name, mimeType }`. Portal page calls fetch then `window.open(data.url, "_blank")` |
| 5 | Mandant kann Dokumente in einen dedizierten 'Mandant'-Ordner der Akte hochladen | VERIFIED | `upload/route.ts`: `ordner: "Mandant"`, FormData POST, 50MB limit enforced both server (line 54-59) and client (portal page line 121-124) |
| 6 | Anwalt erhaelt eine In-App-Benachrichtigung wenn der Mandant ein Dokument hochgeladen hat | VERIFIED | `upload/route.ts` lines 125-136: `createNotification({ userId: akte.anwaltId, type: "document:mandant-upload", ... })`. Type registered in `notifications/types.ts`, icon+color in `notification-center.tsx` |
| 7 | Hochgeladene Dokumente haben erstelltDurch='mandant' und werden ohne OCR/RAG erstellt | VERIFIED | `upload/route.ts` line 93: `erstelltDurch: "mandant"`, line 94: `ocrStatus: "NICHT_NOETIG"`, no OCR/RAG/preview calls |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Plan | Status | Details |
|----------|------|--------|---------|
| `prisma/schema.prisma` | mandantSichtbar Boolean on Dokument model | VERIFIED | Line 1049: `mandantSichtbar Boolean @default(false)`, line 1061: `@@index([akteId, mandantSichtbar])`. Also on AktenActivity (line 2173) for Mandant timeline |
| `src/app/api/akten/[id]/dokumente/[dId]/mandant-sichtbar/route.ts` | PATCH toggle endpoint | VERIFIED | 95 lines, exports `PATCH`, uses `requireAkteAccess`, validates body, updates prisma, creates AktenActivity on enable, `logAuditEvent` both directions |
| `src/components/dokumente/dokumente-tab.tsx` | Toggle button in document row | VERIFIED | `mandantSichtbar` in DokumentItem interface (line 97), Eye/EyeOff icon toggle (lines 832-852), role gating via `MANDANT_SICHTBAR_ROLES` (line 135) |
| `src/app/api/portal/akten/[id]/dokumente/route.ts` | GET endpoint mandantSichtbar=true filter | VERIFIED | 60 lines, exports `GET`, MANDANT role check, `requireMandantAkteAccess`, `mandantSichtbar: true` in findMany where clause, no `dateipfad` in select |
| `src/app/(portal)/akten/[id]/dokumente/page.tsx` | Portal document list page | VERIFIED | 379 lines: fetch on mount, Glass card list, DocumentRow component, drag-drop upload, ordner grouping, "Von mir hochgeladen" badge |
| `src/app/api/portal/akten/[id]/dokumente/[dId]/download/route.ts` | GET presigned URL endpoint | VERIFIED | 74 lines, exports `GET`, MANDANT role check, `requireMandantAkteAccess`, mandantSichtbar=true guard, `getDownloadUrl()`, no dateipfad exposed |
| `src/app/api/portal/akten/[id]/dokumente/upload/route.ts` | POST Mandant upload endpoint | VERIFIED | 156 lines, exports `POST`, 50MB limit, `generateStorageKey`+`uploadFile`, `erstelltDurch: "mandant"`, `ocrStatus: "NICHT_NOETIG"`, `createNotification`, `logAuditEvent`, AktenActivity |

**Path note:** Plan frontmatter listed `src/app/(portal)/portal/akten/[id]/dokumente/page.tsx` (with an extra `/portal/` URL segment). Actual file is at `src/app/(portal)/akten/[id]/dokumente/page.tsx` — correctly under the `(portal)` route group layout. This is a plan wording error only; the implementation path is correct and the file is served under the portal layout.

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `dokumente-tab.tsx` | `/api/akten/[id]/dokumente/[dId]/mandant-sichtbar` | fetch PATCH on toggle click | WIRED | Line 356-363: `fetch(\`/api/akten/${akteId}/dokumente/${doc.id}/mandant-sichtbar\`, { method: "PATCH", body: JSON.stringify({ mandantSichtbar: newValue }) })` |
| `portal/akten/[id]/dokumente/page.tsx` | `/api/portal/akten/[id]/dokumente` | fetch GET on mount | WIRED | Line 81: `fetch(\`/api/portal/akten/${akteId}/dokumente\`)` in `fetchDokumente`, called in `useEffect` |
| `portal/akten/[id]/dokumente/route.ts` | `prisma.dokument` | findMany with mandantSichtbar: true filter | WIRED | Lines 35-51: `prisma.dokument.findMany({ where: { akteId, mandantSichtbar: true }, ...select without dateipfad })` |
| `portal/akten/[id]/dokumente/page.tsx` | `/api/portal/akten/[id]/dokumente/[dId]/download` | fetch GET then window.open(presignedUrl) | WIRED | Lines 102-111: fetch download endpoint, `window.open(data.url, "_blank")` |
| `portal/akten/[id]/dokumente/page.tsx` | `/api/portal/akten/[id]/dokumente/upload` | FormData POST on file drop/select | WIRED | Lines 128-134: `formData.append("file", file)`, POST to upload endpoint |
| `upload/route.ts` | `src/lib/notifications/service.ts` | createNotification() to Akte anwalt | WIRED | Lines 125-135: `createNotification({ userId: akte.anwaltId, type: "document:mandant-upload", ... })` |
| `upload/route.ts` | `src/lib/storage.ts` | uploadFile() + generateStorageKey() | WIRED | Lines 5, 76-77: imports both, calls `generateStorageKey(akteId, file.name)` then `uploadFile(storageKey, buffer, file.type, file.size)` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DOC-01 | 46-01 | Anwalt kann pro Dokument "Mandant sichtbar" aktivieren/deaktivieren | SATISFIED | `mandant-sichtbar/route.ts` PATCH endpoint + `dokumente-tab.tsx` Eye/EyeOff toggle |
| DOC-02 | 46-01 | Mandant sieht Liste aller freigegebenen Dokumente seiner Akte | SATISFIED | Portal GET API filters `mandantSichtbar: true` + portal page renders name, date, type, size |
| DOC-03 | 46-02 | Mandant kann freigegebene Dokumente herunterladen | SATISFIED | `download/route.ts` returns presigned URL; portal page opens URL in new tab |
| DOC-04 | 46-02 | Mandant kann Dokumente in dedizierten "Mandant"-Ordner hochladen | SATISFIED | `upload/route.ts` sets `ordner: "Mandant"`; portal page has drag-drop + file picker |
| DOC-05 | 46-02 | Anwalt wird bei Mandant-Upload benachrichtigt | SATISFIED | `upload/route.ts` calls `createNotification` to `akte.anwaltId`; type registered in notification system |

All 5 DOC requirements claimed by plans 46-01 and 46-02 are satisfied. No orphaned requirements found — all DOC-01 through DOC-05 entries in REQUIREMENTS.md are mapped to Phase 46 and marked complete.

### Anti-Patterns Found

None detected. All phase-46 files are clean of TODO/FIXME/placeholder comments, empty implementations, or stub handlers.

### Human Verification Required

#### 1. Mandant download opens correct file in browser

**Test:** As a Mandant user, navigate to a case with freigegebene documents. Click Download on a document row.
**Expected:** Browser opens a new tab with the presigned MinIO URL and downloads or displays the file.
**Why human:** Requires a running MinIO instance and a seeded document. Presigned URL generation (`getDownloadUrl`) cannot be verified without a live MinIO connection.

#### 2. Drag-and-drop upload feedback and list refresh

**Test:** As a Mandant user, drag a file (< 50 MB) onto the upload zone. Observe behavior.
**Expected:** Loading spinner appears during upload, success toast fires, document appears in the list immediately with "Von mir hochgeladen" badge.
**Why human:** End-to-end upload flow with real file I/O and MinIO cannot be verified statically.

#### 3. Anwalt notification appears in NotificationBell

**Test:** After a Mandant uploads a document, switch to the Anwalt account. Observe the notification bell.
**Expected:** NotificationBell shows a new notification "Mandant-Upload" with Upload icon in emerald, containing the file name and case reference.
**Why human:** Requires Socket.IO real-time delivery or page refresh to observe; two-user session flow not verifiable statically.

#### 4. Toggle visibility in Anwalt document row

**Test:** As an Anwalt, open an Akte document list. Toggle mandantSichtbar on a document. Immediately toggle it back.
**Expected:** Icon switches between Eye (emerald, sichtbar) and EyeOff (muted, unsichtbar) optimistically. Toast confirms action. No Mandant-side activity created on disable.
**Why human:** Optimistic update UX and real database persistence require live app interaction.

### Gaps Summary

No gaps. All 7 observable truths are verified, all 7 artifacts are substantive and wired, all 4 key links in plan 46-01 and all 4 key links in plan 46-02 are wired. All DOC-01 through DOC-05 requirements are satisfied. No anti-patterns found.

The single notable deviation — the portal page path listed in plan 46-01 frontmatter includes a spurious `/portal/` URL segment (`src/app/(portal)/portal/akten/...`) while the actual implementation correctly places the file at `src/app/(portal)/akten/[id]/dokumente/page.tsx` — is a plan documentation error that does not affect functionality. The file is served under the `(portal)` layout as intended.

---

_Verified: 2026-03-03T14:00:00Z_
_Verifier: Claude (gsd-verifier)_
