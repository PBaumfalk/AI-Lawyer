import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Architecture guard: every API route that handles an `akteId` must use one of
 * the access helpers. Routes listed in REVIEWED were checked by hand; each
 * entry states why it does not need an Akte check. Adding a route that takes
 * an akteId without a helper fails this test until it is fixed or reviewed.
 */
const HELPERS =
  /requireAkteAccess|akteAccessDenied|canAccessAkte|buildAkteAccessFilter|requireMandantAkteAccess|getMandantAkten|ticketAccessWhere|findAccessibleTicket|searchDokumenteForUser/;

const SKIP_DIRS = [
  "src/app/api/portal/", // client portal: own checks via portal-access.ts
  "src/app/api/openclaw/", // machine gateway with its own token auth
  "src/app/api/onlyoffice/", // document server callbacks, JWT-signed
  "src/app/api/auth/",
  "src/app/api/admin/", // all handlers require role ADMIN, which may see every Akte
];

const REVIEWED: Record<string, string> = {
  "src/app/api/channels/route.ts": "lists only channels the user is a member of; POST takes no akteId",
  "src/app/api/emails/route.ts": "scoped to mailboxes assigned to the user; akteId only narrows that list",
  "src/app/api/helena/suggestions/route.ts": "scoped to suggestions of the current user",
  "src/app/api/helena/suggestions/[id]/route.ts": "owner check on the suggestion",
  "src/app/api/ki-chat/pending/route.ts": "pending state is keyed by the current user",
  "src/app/api/dokumente/reindex/route.ts": "ADMIN only",
  "src/app/api/bea/auto-assign/route.ts": "firm beA postbox; assignment suggestions only, no data of other Akten returned",
};

function walk(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name === "route.ts") out.push(p);
  }
  return out;
}

describe("Architektur: Aktenzugriff in API-Routen", () => {
  const root = process.cwd();
  const routes = walk(join(root, "src/app/api")).map((p) => relative(root, p));

  it("jede Route mit akteId nutzt eine Zugriffsfunktion oder ist begründet ausgenommen", () => {
    const offen = routes.filter((r) => {
      if (SKIP_DIRS.some((d) => r.startsWith(d))) return false;
      const src = readFileSync(join(root, r), "utf8");
      return /akteId/.test(src) && !HELPERS.test(src) && !(r in REVIEWED);
    });
    expect(offen).toEqual([]);
  });

  it("die Ausnahmeliste enthält keine veralteten Einträge", () => {
    const veraltet = Object.keys(REVIEWED).filter((r) => {
      if (!routes.includes(r)) return true;
      return HELPERS.test(readFileSync(join(root, r), "utf8"));
    });
    expect(veraltet).toEqual([]);
  });

  it("keine Route ruft die Volltextsuche ohne Zugriffsfilter auf", () => {
    const direkt = routes.filter((r) => /searchDokumente\(/.test(readFileSync(join(root, r), "utf8")));
    expect(direkt).toEqual([]);
  });
});

/**
 * Every DELETE handler must enforce the delete permission (canLoeschen) or be
 * a reviewed handler that only deletes the caller's own objects / is admin-only.
 */
const DELETE_GUARDS = /loeschenVerweigert|requireDelete: true|canLoeschen|requireRole\(["']ADMIN["']\)|role !== ["']ADMIN["']/;
const DELETE_REVIEWED: Record<string, string> = {
  "src/app/api/ki-chat/pending/route.ts": "deletes the caller's own pending pipeline state",
  "src/app/api/ki-chat/conversations/[id]/route.ts": "owner-only (isOwner check)",
  "src/app/api/users/[id]/urlaub/route.ts": "own vacation entries or admin (role check in handler)",
  "src/app/api/caldav-konten/[id]/route.ts": "own CalDAV account (where userId = session user)",
  "src/app/api/email-konten/[id]/route.ts": "admin-only handler",
  "src/app/api/channels/[id]/messages/[messageId]/route.ts": "author or admin (checked in service)",
  "src/app/api/channels/[id]/reactions/route.ts": "removes the caller's own reaction",
  "src/app/api/vorlagen/[id]/freigabe/route.ts": "withdraws an approval, deletes no data (role check in handler)",
  "src/app/api/falldaten-templates/[id]/route.ts": "own draft templates or admin (checked in handler)",
  "src/app/api/email-send/route.ts": "cancels the caller's own scheduled e-mail",
  "src/app/api/channels/[id]/members/route.ts": "leaves the channel (deletes the caller's own membership)",
  "src/app/api/email-folders/[id]/route.ts": "mailbox operation, scoped to mailboxes assigned to the caller",
  "src/app/api/emails/[id]/route.ts": "moves to trash (soft delete), scoped to mailboxes assigned to the caller",
};

describe("Architektur: Löschrecht in DELETE-Handlern", () => {
  const root = process.cwd();
  const routes = walk(join(root, "src/app/api")).map((p) => relative(root, p));

  it("jeder DELETE-Handler prüft canLoeschen oder ist begründet ausgenommen", () => {
    const offen = routes.filter((r) => {
      if (r.startsWith("src/app/api/admin/") || r.startsWith("src/app/api/portal/")) return false;
      const src = readFileSync(join(root, r), "utf8");
      const i = src.indexOf("export async function DELETE");
      if (i < 0) return false;
      return !DELETE_GUARDS.test(src.slice(i)) && !(r in DELETE_REVIEWED);
    });
    expect(offen).toEqual([]);
  });
});
