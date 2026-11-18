import { prisma } from "@/lib/db";
import type { JLawyerClient } from "./client";
import type { JLawyerMigrationIssue, JLawyerUser } from "./types";

/** SystemSetting key of the configurable default responsible user. */
export const STANDARD_VERANTWORTLICHER_KEY = "jlawyer.migration.standardVerantwortlicherId";

export interface Benutzerabgleich {
  /** AI-Lawyer user id for a j-lawyer principal (login), or null if not matchable. */
  resolve(principal: string | null | undefined): string | null;
  /** Fallback responsible user (configured default, otherwise the starting admin). */
  standardId: string;
  standardName: string;
}

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/**
 * Matches j-lawyer users (principals) to AI-Lawyer users.
 *
 * Order (first unambiguous hit wins):
 *   1. e-mail address of the j-lawyer user (from /v6/security/users/list)
 *   2. j-lawyer login equals the AI-Lawyer e-mail or its local part
 *   3. display name / "first name last name" equals the AI-Lawyer user name
 * Only active, non-system, non-portal users are candidates. An ambiguous
 * match counts as no match, so nothing is silently assigned to the wrong
 * person.
 */
export async function buildBenutzerabgleich(
  client: JLawyerClient,
  startenderAdminId: string,
  hinweise: JLawyerMigrationIssue[],
): Promise<Benutzerabgleich> {
  const kandidaten = await prisma.user.findMany({
    where: { aktiv: true, isSystem: false, role: { not: "MANDANT" } },
    select: { id: true, email: true, name: true },
  });

  let jlUsers: JLawyerUser[] = [];
  try {
    jlUsers = await client.listUsers();
  } catch (e) {
    hinweise.push({
      entity: "Benutzer",
      id: "-",
      message:
        `j-lawyer-Benutzerliste nicht lesbar (${(e as Error).message}); ` +
        "Zuordnung nur über Login = E-Mail bzw. E-Mail-Präfix.",
    });
  }

  const unique = (ids: string[]) => (ids.length === 1 ? ids[0] : null);
  const byEmail = (email: string) =>
    unique(kandidaten.filter((u) => norm(u.email) === email).map((u) => u.id));
  const byLocalPart = (login: string) =>
    unique(kandidaten.filter((u) => norm(u.email).split("@")[0] === login).map((u) => u.id));
  const byName = (name: string) =>
    unique(kandidaten.filter((u) => norm(u.name) === name).map((u) => u.id));

  const cache = new Map<string, string | null>();

  function resolve(principal: string | null | undefined): string | null {
    const login = norm(principal);
    if (!login) return null;
    if (cache.has(login)) return cache.get(login)!;

    const jl = jlUsers.find((u) => norm(u.principalId) === login);
    let hit: string | null = null;
    if (jl?.email) hit = byEmail(norm(jl.email));
    if (!hit) hit = login.includes("@") ? byEmail(login) : byLocalPart(login);
    if (!hit && jl) {
      const names = [jl.displayName, [jl.firstName, jl.name].filter(Boolean).join(" ")]
        .map(norm)
        .filter(Boolean);
      for (const n of names) {
        hit = byName(n);
        if (hit) break;
      }
    }
    cache.set(login, hit);
    return hit;
  }

  // Default responsible user: configured setting, else the starting admin
  const setting = await prisma.systemSetting.findUnique({
    where: { key: STANDARD_VERANTWORTLICHER_KEY },
  });
  let standard = setting?.value
    ? kandidaten.find((u) => u.id === setting.value) ?? null
    : null;
  if (setting?.value && !standard) {
    hinweise.push({
      entity: "Benutzer",
      id: setting.value,
      message:
        "Konfigurierter Standard-Verantwortlicher ist nicht (mehr) aktiv; " +
        "stattdessen wird der startende Administrator verwendet.",
    });
  }
  if (!standard) {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { id: startenderAdminId },
      select: { id: true, email: true, name: true },
    });
    standard = admin;
  }

  return { resolve, standardId: standard.id, standardName: standard.name };
}
