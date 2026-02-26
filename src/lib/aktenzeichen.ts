import { prisma } from "@/lib/db";

/**
 * Generates the next Aktenzeichen in format NNNNN/YY
 * e.g. 00001/26, 00002/26, 00013/26
 * Resets numbering each year.
 */
export async function generateAktenzeichen(): Promise<string> {
  const now = new Date();
  const yearSuffix = String(now.getFullYear()).slice(-2); // "26"
  const pattern = `%/${yearSuffix}`;

  // Find the highest Aktenzeichen for the current year
  const latest = await prisma.akte.findFirst({
    where: { aktenzeichen: { endsWith: `/${yearSuffix}` } },
    orderBy: { aktenzeichen: "desc" },
    select: { aktenzeichen: true },
  });

  let nextNumber = 1;
  if (latest) {
    const numPart = latest.aktenzeichen.split("/")[0];
    nextNumber = parseInt(numPart, 10) + 1;
  }

  const padded = String(nextNumber).padStart(5, "0");
  return `${padded}/${yearSuffix}`;
}
