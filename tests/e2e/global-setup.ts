// Vor den Browsertests: Anmeldezähler der Testumgebung leeren, damit frühere
// Läufe die Drosselung nicht vorbelegen. Nur gegen die Test-Redis-Instanz.
import Redis from "ioredis";

export default async function globalSetup() {
  if (!process.env.E2E_ADMIN_PASSWORD) {
    throw new Error("E2E_ADMIN_PASSWORD fehlt (Startpasswort des Test-Admins, siehe tests/e2e/README.md)");
  }
  const url = process.env.E2E_REDIS_URL;
  if (!url) return;
  const r = new Redis(url, { maxRetriesPerRequest: 1 });
  try {
    for (const muster of ["login:*", "limit:*"]) {
      let cursor = "0";
      do {
        const [next, keys] = await r.scan(cursor, "MATCH", muster, "COUNT", 500);
        if (keys.length) await r.del(...keys);
        cursor = next;
      } while (cursor !== "0");
    }
  } finally {
    r.disconnect();
  }
}
