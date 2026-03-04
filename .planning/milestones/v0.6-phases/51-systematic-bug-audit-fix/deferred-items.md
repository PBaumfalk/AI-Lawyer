# Deferred Items - Phase 51

## Pre-existing TypeScript Errors (Out of Scope)

- **compose-popup.tsx:153** — `TS2448: Block-scoped variable 'saveDraft' used before its declaration.` — useCallback ordering issue similar to the hooks violation fixed in rollen/page.tsx but in a different file not in scope for 51-01.
