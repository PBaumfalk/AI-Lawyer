---
phase: 63-tab-reduktion-keyfacts
verified: 2026-07-23T12:00:00Z
status: passed
score: 10/12 must-haves verified
behavior_unverified: 2
overrides_applied: 0
behavior_unverified_items:
  - truth: "Switching to a hidden tab via the overflow menu works correctly and the correct content renders"
    test: "Open an Akte detail page, click the three-dot overflow button, select 'Falldaten', then 'KI-Analyse'"
    expected: "Each selection renders the corresponding TabsContent panel (FalldatenTab / CaseSummaryPanel); the tab bar remains on the 4 primary tabs"
    why_human: "Presence checks confirm the onClick -> handleTabChange(value) wiring and that both TabsContent panels exist, but no test exercises the click-to-render state transition"
  - truth: "Unsaved-changes guard for Falldaten still fires when switching away via the overflow menu"
    test: "Open Falldaten via the overflow menu, edit a field (dirty state), then select any other tab from the overflow menu"
    expected: "The 'Ungespeicherte Aenderungen' AlertDialog appears; 'Abbrechen' stays on Falldaten; 'Trotzdem fortfahren' switches and discards"
    why_human: "The overflow button routes through handleTabChange (line 273) which checks falldatenDirty (line 164), but the conditional dialog-firing transition is not covered by any test"
human_verification:
  - test: "Open an Akte detail page, open the three-dot overflow menu, select 'Falldaten' and then 'KI-Analyse'"
    expected: "The correct content panel renders for each; the three-dot button shows as highlighted/active while a hidden tab is selected"
    why_human: "Click-to-render state transition and visual active-state styling are not exercised by any test"
  - test: "In Falldaten, edit a field, then switch to another tab via the overflow menu"
    expected: "The unsaved-changes dialog fires; cancel keeps you on Falldaten; confirm switches and discards changes"
    why_human: "Conditional guard firing on dirty state is a runtime state transition; code inspection shows the wiring but no test executes it"
  - test: "Scroll a long tab content (e.g. Aktivitaeten feed) on the Akte detail page"
    expected: "The Key-Facts panel stays pinned near the top of the viewport (sticky top-2 z-10) above the scrolling tab content"
    why_human: "Sticky-on-scroll rendering is visual; the SUMMARY itself flagged human_judgment for this"
  - test: "In Falldaten with unsaved changes, click the 'E-Mails' KPI card (soft navigation via router.push)"
    expected: "The unsaved-changes dialog fires before navigating away (review-fix WR-01 partial mitigation via registerGuardedNavigation)"
    why_human: "Review-fix iter3 explicitly marked WR-01 as a partial mitigation requiring human verification"
---

# Phase 63: Tab-Reduktion & Key-Facts Verification Report

**Phase Goal:** Akte detail page is streamlined with fewer visible tabs and at-a-glance case facts
**Verified:** 2026-07-23
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Only 4 primary tabs visible: Aktivitaeten, Dokumente, Termine & Fristen, Finanzen | ✓ VERIFIED | akte-detail-tabs.tsx lines 241-248: TabsList contains exactly 4 TabsTriggers (feed, dokumente with count badge, kalender with count badge, finanzen) |
| 2 | KI-Analyse and Falldaten accessible via overflow menu | ✓ VERIFIED | overflowTabs lines 214-219: falldaten (FileText), zusammenfassung (FileBarChart), nachrichten, portal-nachrichten; dropdown buttons render at lines 268-285 |
| 3 | Overflow button highlighted when a hidden tab is selected | ✓ VERIFIED | overflowActive = overflowTabs.some(t => t.value === currentTab) (line 220) drives conditional active styling on the button (lines 258-261) |
| 4 | Switching to a hidden tab via overflow renders correct content | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | onClick -> handleTabChange(value) wired (line 273); TabsContent panels for falldaten (340-349) and zusammenfassung (352-354) intact; no test exercises the transition |
| 5 | Unsaved-changes guard fires when switching away via overflow | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Overflow routes through handleTabChange (line 273) which checks currentTab === "falldaten" && falldatenDirty (line 164) and shows AlertDialog; no test covers the guard firing |
| 6 | Key-Facts panel is sticky | ✓ VERIFIED | Panel div className includes "sticky top-2 z-10" (line 142); panel rendered above AkteDetailTabs (line 329 vs 332) |
| 7 | Panel shows Gegenstandswert (not Streitwert) as Euro | ✓ VERIFIED | Label "Gegenstandswert:" (line 147); formatGegenstandswert uses Intl.NumberFormat de-DE currency EUR (lines 67-72); zero "Streitwert" occurrences repo-checked in both files |
| 8 | Panel shows Gericht derived from rolle=GERICHT Beteiligter | ✓ VERIFIED | beteiligte.find(b => b.rolle === "GERICHT") (line 86) with firma-or-name fallback (lines 94-98); Building2 chip (lines 169-175) |
| 9 | Panel shows Phase/Status in human-readable German | ✓ VERIFIED | STATUS_LABELS OFFEN/RUHEND/ARCHIVIERT (lines 75-79); statusLabel with raw fallback (line 101); Phase chip (lines 153-158) |
| 10 | Panel shows naechste Frist with date and urgency warning | ✓ VERIFIED | nextFrist day-granularity derivation (lines 105-110); AlertTriangle + amber styling at <=7 days, date + "heute/morgen/N Tage" countdown (lines 178-190); overdue-Frist fallback chip from review-fix (lines 192-204) |
| 11 | Panel shows Mandant and Gegner names when present | ✓ VERIFIED | rolle MANDANT / GEGNER|GEGNERVERTRETER lookups with firma-or-name fallback (lines 84-93); chips at lines 207-220 |
| 12 | Panel hidden only when ALL facts unavailable | ✓ VERIFIED | hasAnyInfo includes gegenstandswert, nextFrist, overdueFrist, mandantName, gegnerName, sachgebiet, gerichtName, status (line 137); early return null at line 139 |

**Score:** 10/12 truths verified (2 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| src/components/akten/akte-detail-tabs.tsx | 4-visible-tab layout with extended overflow menu | ✓ VERIFIED | 405 lines, substantive; overflowTabs has 4 entries incl. falldaten + zusammenfassung; imported and rendered by akte-detail-client.tsx (line 16, 332) |
| src/app/(dashboard)/akten/[id]/akte-detail-client.tsx | Sticky Key-Facts panel with all required fields | ✓ VERIFIED | 345 lines, substantive; "sticky top-2 z-10" present; imported and rendered by page.tsx (lines 13, 113) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| overflowTabs array | handleTabChange | button onClick in overflow dropdown | ✓ WIRED | Line 273: onClick={() => { handleTabChange(value); setOverflowOpen(false); }} |
| KeyFactsPanel | akte.beteiligte | find(b => b.rolle === "GERICHT") | ✓ WIRED | Line 86 |
| KeyFactsPanel | akte.status | STATUS_LABELS map | ✓ WIRED | Lines 75-79, 101 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| AkteDetailTabs | akte (AkteData) | akte-detail-client.tsx prop | Yes — serialized Prisma query from page.tsx | ✓ FLOWING |
| KeyFactsPanel | akte.beteiligte / status / kalenderEintraege / gegenstandswert | akte prop from page.tsx server component | Yes — server-side Prisma include chain | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Repo-wide TypeScript compiles (post review-fix chain) | `npx tsc --noEmit` | exit 0, zero errors | ✓ PASS — the pre-existing jlawyer/client.ts brace bug flagged in deferred-items.md was fixed during the 3-iteration review-fix chain |
| Test suite exists | `npx vitest list` | 442 tests enumerated | ✓ PASS (no tests target the two modified UI components — consistent with the project's max-20%-test-effort convention; SUMMARY flagged human_judgment) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FEED-06 | 63-01 | Tab-Reduktion von 11 auf 4-5 sichtbare Tabs mit Overflow-Menue | ✓ SATISFIED | 4 visible TabsTriggers + 4-entry overflow menu in akte-detail-tabs.tsx |
| FEED-07 | 63-02 | Key-Facts-Panel sticky oberhalb Tabs (Gegenstandswert, Gericht, Phase, naechste Frist, Mandant/Gegner) | ✓ SATISFIED | All five fact categories + Sachgebiet + overdue-Frist in KeyFactsPanel with sticky class |

No orphaned requirements: REQUIREMENTS.md maps exactly FEED-06 and FEED-07 to Phase 63, and both are claimed by plans. (Info: REQUIREMENTS.md checkboxes for FEED-06/FEED-07 still show unchecked/Pending — status bookkeeping only, not an implementation gap.)

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | None. No TODO/FIXME/XXX/placeholder markers, no empty handlers, no hardcoded empty render data in either modified file |

### Human Verification Required

Four interaction/visual items need human confirmation (details in frontmatter `human_verification`):

1. **Overflow tab switching + active highlight** — select Falldaten/KI-Analyse via the three-dot menu; correct panel renders; button highlights while a hidden tab is active
2. **Unsaved-changes guard via overflow** — dirty Falldaten, switch away via overflow; dialog fires with working cancel/confirm
3. **Sticky panel on scroll** — panel stays pinned while scrolling long tab content (flagged as human_judgment in the SUMMARY itself)
4. **Guarded soft navigation (WR-01 partial mitigation)** — dirty Falldaten + E-Mails KPI click; dialog intercepts router.push (review-fix iter3 explicitly requested human verification)

### Gaps Summary

No gaps. All artifacts exist, are substantive, are wired, and have real data flowing. The two behavior-unverified truths concern interaction transitions (overflow tab switching, dirty-guard firing) whose wiring is fully confirmed by code inspection but which no automated test exercises — they route to human UAT rather than blocking. tsc --noEmit passes repo-wide, confirming the review-fix chain resolved the pre-existing jlawyer/client.ts syntax errors.

---

_Verified: 2026-07-23T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
