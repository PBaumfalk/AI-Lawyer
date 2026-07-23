---
status: passed
phase: 63-tab-reduktion-keyfacts
source: [63-VERIFICATION.md]
started: 2026-07-23T13:10:00Z
updated: 2026-07-23T13:10:00Z
---

## Current Test

number: 1
name: Overflow-Tab-Wechsel + Highlight
expected: |
  Falldaten/KI-Analyse über das Drei-Punkte-Menü auswählen; das korrekte Panel rendert; der Overflow-Button zeigt den aktiven Zustand.
awaiting: user response

## Tests

### 1. Overflow-Tab-Wechsel + Highlight
expected: Falldaten oder KI-Analyse über das Overflow-Menü (Drei Punkte) öffnen — der richtige Inhalt rendert und der Overflow-Button ist als aktiv hervorgehoben.
result: [passed]

### 2. Unsaved-Changes-Guard über Overflow
expected: Falldaten bearbeiten (dirty), dann über das Overflow-Menü zu einem anderen Tab wechseln — der AlertDialog "Ungespeicherte Änderungen" erscheint.
result: [passed]

### 3. Sticky Key-Facts-Panel beim Scrollen
expected: Im Tab-Inhalt nach unten scrollen — das Key-Facts-Panel bleibt oben sichtbar (sticky).
result: [passed]

### 4. Guarded Soft Navigation (Review-Fix WR-01)
expected: Falldaten dirty + Klick auf die E-Mails-KPI-Karte — der Dialog fängt den router.push ab statt still zu verwerfen.
result: [passed]

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
