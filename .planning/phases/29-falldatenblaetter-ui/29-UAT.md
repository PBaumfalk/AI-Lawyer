---
status: deferred
phase: 29-falldatenblaetter-ui
source: 29-01-SUMMARY.md, 29-02-SUMMARY.md
started: 2026-02-28T21:10:00Z
updated: 2026-02-28T21:10:00Z
---

## Current Test

number: 1
name: Falldaten Tab Visible
expected: |
  Navigate to any Akte detail view. A "Falldaten" tab should appear in the tab bar alongside Feed, Dokumente, Kalender, Finanzen. Clicking it should load the Falldaten content area.
awaiting: deferred by user

## Tests

### 1. Falldaten Tab Visible
expected: Navigate to any Akte detail view. A "Falldaten" tab should appear in the tab bar alongside Feed, Dokumente, Kalender, Finanzen. Clicking it should load the Falldaten content area.
result: [pending]

### 2. Template Auto-Assignment
expected: Open the Falldaten tab on an Akte that has no template assigned yet. A STANDARD template matching the Akte's Sachgebiet should auto-assign, and the form fields should render grouped by the template's section structure.
result: [pending]

### 3. All Field Types Render
expected: The form renders all 8 field types correctly: text input, textarea, number, currency (with Euro formatting), date picker, select dropdown, boolean toggle, and multiselect as a checkbox group.
result: [pending]

### 4. Multiselect Checkbox Group
expected: A multiselect field renders as a group of checkboxes. You can select multiple options. Selected values are visually checked and persist in the form state.
result: [pending]

### 5. Required Field Amber Highlighting
expected: Empty required fields have a subtle amber border (amber-colored outline). Filling in a required field removes the amber highlight, returning to the normal border.
result: [pending]

### 6. Completeness Progress Bar
expected: Inside the form header, a progress bar shows "X von Y Pflichtfelder" with an emerald green fill. As you fill required fields, X increments and the bar fills proportionally.
result: [pending]

### 7. Completeness Badge in Tab Trigger
expected: The Falldaten tab trigger shows a percentage like "Falldaten (75%)" reflecting how many required fields are filled. The percentage updates reactively as you fill or clear fields (no save needed).
result: [pending]

### 8. Save and Persist Data
expected: Fill in some fields and click Speichern. Navigate away to another tab, then return to Falldaten. All saved data should persist and display correctly.
result: [pending]

### 9. Soft Warning on Save with Empty Required Fields
expected: Leave some required fields empty and click Speichern. A toast notification appears warning about empty required fields, but the save proceeds (non-blocking).
result: [pending]

### 10. Unsaved Changes Guard on Tab Switch
expected: Make changes to the form without saving. Try switching to another tab (e.g., Feed). An AlertDialog should appear warning about unsaved changes, giving you the option to stay or discard.
result: [pending]

### 11. Template Switching
expected: If multiple approved templates exist for the Sachgebiet, a "Template wechseln" button is visible. Clicking it shows alternatives. Selecting a different template shows a warning dialog. After confirming, the new template's fields render. Previously filled data for matching fields is preserved.
result: [pending]

### 12. Empty State for Missing Template
expected: Open the Falldaten tab on an Akte with Sachgebiet SONSTIGES (or one where no STANDARD template exists). An empty state message appears. If GENEHMIGT templates exist, they are shown as selectable alternatives.
result: [pending]

## Summary

total: 12
passed: 0
issues: 0
pending: 12
skipped: 0

## Gaps

[none yet]
