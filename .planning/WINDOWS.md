---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 0
total_count: 1
last_updated: 2026-07-23T09:42:00.957Z
---

# Broken Windows Ledger

> Cross-phase defect register. `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 63 | deviation | src/lib/jlawyer/client.ts | 49 | Pre-existing syntax errors (extra closing brace) block repo-wide tsc --noEmit; logged in phase-63 deferred-items.md | open |  | 2026-07-23T09:42:00.957Z |  |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "63",
    "file": "src/lib/jlawyer/client.ts",
    "line": 49,
    "description": "Pre-existing syntax errors (extra closing brace) block repo-wide tsc --noEmit; logged in phase-63 deferred-items.md",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-23T09:42:00.957Z",
    "resolved_at": null
  }
]
````
