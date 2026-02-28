/**
 * Akte summary embedding infrastructure for SCAN-05 Neu-Urteil-Check.
 * Assembles case context into embedding-ready text and refreshes
 * all active Akte embeddings via pgvector raw SQL.
 */

import { prisma } from "@/lib/db";
import { generateEmbedding } from "@/lib/embedding/embedder";
import { createLogger } from "@/lib/logger";
import pgvector from "pgvector";
import type { Akte, HelenaMemory, AkteNorm } from "@prisma/client";

const log = createLogger("akte-embedding");

/** Shape of HelenaMemory.content JSON */
interface HelenaMemoryContent {
  summary?: string;
  risks?: string[];
  relevantNorms?: string[];
  proceduralStatus?: string;
}

/** Akte with all context relations included for embedding assembly */
type AkteWithContext = Akte & {
  helenaMemory: HelenaMemory | null;
  normen: AkteNorm[];
};

/**
 * Assemble a single Akte's context into a text string suitable for embedding.
 * Field ordering: Sachgebiet, Kurzrubrum, Wegen, HelenaMemory content,
 * Falldaten key-value pairs, pinned Normen.
 */
export function assembleAkteSummaryText(akte: AkteWithContext): string {
  const parts: string[] = [];

  // Core fields
  parts.push(`Sachgebiet: ${akte.sachgebiet}`);
  parts.push(`Kurzrubrum: ${akte.kurzrubrum}`);
  if (akte.wegen) {
    parts.push(`Wegen: ${akte.wegen}`);
  }

  // HelenaMemory content (if available)
  if (akte.helenaMemory?.content) {
    try {
      const memory = akte.helenaMemory.content as unknown as HelenaMemoryContent;
      if (memory.summary) {
        parts.push(`Zusammenfassung: ${memory.summary}`);
      }
      if (memory.risks?.length) {
        parts.push(`Risiken: ${memory.risks.join(", ")}`);
      }
      if (memory.relevantNorms?.length) {
        parts.push(`Relevante Normen: ${memory.relevantNorms.join(", ")}`);
      }
      if (memory.proceduralStatus) {
        parts.push(`Verfahrensstand: ${memory.proceduralStatus}`);
      }
    } catch {
      // Malformed JSON -- skip HelenaMemory gracefully
    }
  }

  // Falldaten JSON key-value pairs (if available)
  if (akte.falldaten && typeof akte.falldaten === "object") {
    const falldaten = akte.falldaten as Record<string, unknown>;
    for (const [key, value] of Object.entries(falldaten)) {
      if (value != null && value !== "") {
        parts.push(`${key}: ${String(value)}`);
      }
    }
  }

  // Pinned Normen (gesetzKuerzel + paragraphNr are directly on AkteNorm)
  if (akte.normen?.length) {
    const normenText = akte.normen
      .map((an) => `${an.gesetzKuerzel} ${an.paragraphNr}`)
      .join(", ");
    parts.push(`Normen: ${normenText}`);
  }

  return parts.join("\n");
}

/**
 * Refresh summary embeddings for all active (OFFEN) Akten.
 * Processes each Akte individually with error isolation.
 * Returns counts for logging and processor result.
 */
export async function refreshAkteEmbeddings(): Promise<{
  refreshed: number;
  failed: number;
  total: number;
}> {
  const akten = await prisma.akte.findMany({
    where: { status: "OFFEN" },
    include: {
      helenaMemory: true,
      normen: true,
    },
  });

  let refreshed = 0;
  let failed = 0;

  for (const akte of akten) {
    try {
      const text = assembleAkteSummaryText(akte as unknown as AkteWithContext);
      const embedding = await generateEmbedding(text);
      const vectorSql = pgvector.toSql(embedding);

      await prisma.$executeRaw`
        UPDATE akten
        SET "summaryEmbedding" = ${vectorSql}::vector,
            "summaryEmbeddingAt" = NOW()
        WHERE id = ${akte.id}
      `;

      refreshed++;
    } catch (err) {
      failed++;
      log.warn(
        { akteId: akte.id, err: err instanceof Error ? err.message : err },
        "Failed to refresh embedding for Akte"
      );
    }
  }

  log.info(
    { total: akten.length, refreshed, failed },
    "Akte embedding refresh summary"
  );

  return { refreshed, failed, total: akten.length };
}
