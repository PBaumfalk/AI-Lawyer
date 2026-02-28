import { prisma } from "@/lib/db";
import { getSetting, updateSetting } from "@/lib/settings/service";
import { falldatenSchemas } from "@/lib/falldaten-schemas";
import type { Sachgebiet } from "@prisma/client";
import { createLogger } from "@/lib/logger";

const log = createLogger("seed-falldaten");

const SEED_VERSION = "v0.3";
const SEED_SETTING_KEY = "falldaten.templates_seed_version";

export async function seedFalldatenTemplates(): Promise<void> {
  const currentVersion = await getSetting(SEED_SETTING_KEY);
  if (currentVersion === SEED_VERSION) {
    log.debug("Falldaten templates already seeded (version %s)", SEED_VERSION);
    return;
  }

  log.info("Seeding Falldaten templates (version %s)...", SEED_VERSION);

  // Find first ADMIN user as creator
  const adminUser = await prisma.user.findFirst({
    where: { role: "ADMIN", aktiv: true },
  });
  if (!adminUser) {
    throw new Error("No active ADMIN user found — cannot seed Falldaten templates");
  }

  let created = 0;
  for (const [sachgebiet, schema] of Object.entries(falldatenSchemas)) {
    // Idempotent: skip if STANDARD template already exists for this Sachgebiet
    const existing = await prisma.falldatenTemplate.findFirst({
      where: {
        sachgebiet: sachgebiet as Sachgebiet,
        status: "STANDARD",
      },
    });
    if (existing) {
      log.debug("STANDARD template for %s already exists, skipping", sachgebiet);
      continue;
    }

    await prisma.falldatenTemplate.create({
      data: {
        name: schema.label,
        beschreibung: schema.beschreibung,
        sachgebiet: sachgebiet as Sachgebiet,
        schema: { felder: schema.felder },
        status: "STANDARD",
        erstelltVonId: adminUser.id,
      },
    });
    created++;
  }

  await updateSetting(SEED_SETTING_KEY, SEED_VERSION);
  log.info("Seeded %d Falldaten STANDARD templates", created);
}
