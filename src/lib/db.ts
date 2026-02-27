import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createExtendedPrisma> | undefined;
};

function createExtendedPrisma() {
  const basePrisma = new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

  return basePrisma.$extends({
    query: {
      dokument: {
        async create({ args, query }) {
          // BRAK 2025 / BRAO 43: AI-created documents MUST be ENTWURF
          if (args.data.erstelltDurch === "ai") {
            args.data.status = "ENTWURF";
          }
          return query(args);
        },
        async update({ args, query }) {
          // Prevent AI-created documents from leaving ENTWURF
          // unless a human reviewer (freigegebenDurchId) is set
          if (
            args.data &&
            typeof args.data === "object" &&
            "status" in args.data &&
            args.data.status !== "ENTWURF" &&
            !("freigegebenDurchId" in args.data && args.data.freigegebenDurchId)
          ) {
            // Look up original record to check if AI-created
            const existing = await basePrisma.dokument.findUnique({
              where: args.where,
              select: { erstelltDurch: true },
            });
            if (existing?.erstelltDurch === "ai") {
              args.data.status = "ENTWURF";
            }
          }
          return query(args);
        },
      },
    },
  });
}

export const prisma = globalForPrisma.prisma ?? createExtendedPrisma();

export type ExtendedPrismaClient = typeof prisma;

/**
 * Transaction client type compatible with $extends.
 * Use this instead of deriving from PrismaClient['$transaction'] directly,
 * because $extends changes the client type signature.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PrismaTransactionClient = Parameters<Parameters<ExtendedPrismaClient["$transaction"]>[0]>[0];

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
