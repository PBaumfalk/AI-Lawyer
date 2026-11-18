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
  "src/app/api/bea/messages/route.ts": "firm beA postbox for all roles with canReadBeA; akteId only narrows the list, POST has no akteId",
  "src/app/api/bea/auto-assign/route.ts": "firm beA postbox; assignment suggestions only, no data of other Akten returned",
  "src/app/api/bea/messages/[id]/eeb/route.ts": "acts on the firm beA postbox message, no Akte data",
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
