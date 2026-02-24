import { prisma } from "@/lib/db";

// ─── Helper: Apply OrdnerSchema to new Akte ──────────────────────────────────

/**
 * Get the default folder structure for a given Sachgebiet.
 * Can be called when creating new Akten to set initial ordner structure.
 */
export async function getDefaultOrdnerForSachgebiet(
  sachgebiet: string
): Promise<string[] | null> {
  // First try to find a schema specific to this Sachgebiet
  let schema = await prisma.ordnerSchema.findFirst({
    where: {
      sachgebiet: sachgebiet as any,
      istStandard: true,
    },
  });

  // Fall back to a general default (no sachgebiet)
  if (!schema) {
    schema = await prisma.ordnerSchema.findFirst({
      where: {
        sachgebiet: null,
        istStandard: true,
      },
    });
  }

  return schema?.ordner ?? null;
}
