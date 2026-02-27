/**
 * Role-based tool filtering for Helena.
 *
 * Restricts available tools based on the user's role:
 * - ADMIN/ANWALT: all tools
 * - SACHBEARBEITER: all read + limited write (no update_akte_rag)
 * - SEKRETARIAT: all read + create_notiz only
 *
 * PRAKTIKANT is not in the current schema. SEKRETARIAT serves as
 * the most restricted tier.
 */

import type { UserRole } from "@prisma/client";

const READ_TOOLS = [
  "read_akte",
  "read_akte_detail",
  "read_dokumente",
  "read_dokumente_detail",
  "read_fristen",
  "read_zeiterfassung",
  "search_gesetze",
  "search_urteile",
  "search_muster",
  "get_kosten_rules",
  "search_alle_akten",
  "search_web",
];

const SACHBEARBEITER_WRITE_TOOLS = [
  "create_draft_dokument",
  "create_draft_frist",
  "create_notiz",
  "create_alert",
  "create_draft_zeiterfassung",
];

const ALL_WRITE_TOOLS = [
  ...SACHBEARBEITER_WRITE_TOOLS,
  "update_akte_rag",
];

/**
 * Filter tools by user role. Returns a new Record containing
 * only the tools the given role is allowed to use.
 */
export function filterToolsByRole(
  tools: Record<string, unknown>,
  role: UserRole,
): Record<string, unknown> {
  let allowedNames: string[];

  switch (role) {
    case "ADMIN":
    case "ANWALT":
      allowedNames = [...READ_TOOLS, ...ALL_WRITE_TOOLS];
      break;
    case "SACHBEARBEITER":
      allowedNames = [...READ_TOOLS, ...SACHBEARBEITER_WRITE_TOOLS];
      break;
    case "SEKRETARIAT":
      allowedNames = [...READ_TOOLS, "create_notiz"];
      break;
    default:
      allowedNames = [...READ_TOOLS];
  }

  return Object.fromEntries(
    Object.entries(tools).filter(([name]) => allowedNames.includes(name)),
  );
}
