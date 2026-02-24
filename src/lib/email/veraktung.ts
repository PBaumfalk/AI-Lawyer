/**
 * Veraktung (email-to-case assignment) logic.
 * Handles auto-suggest, assignment, attachment copy to DMS, and reversal.
 */

import { prisma } from "@/lib/db";
import { uploadFile, getFileStream } from "@/lib/storage";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AkteSuggestion {
  akteId: string;
  aktenzeichen: string;
  kurzrubrum: string;
  confidence: "hoch" | "mittel" | "niedrig";
  reason: string;
}

interface SuggestInput {
  absender: string;
  betreff: string;
  empfaenger: string[];
  threadId?: string | null;
}

interface VerakteParams {
  emailId: string;
  akteId: string;
  userId: string;
  anhangIds?: string[];
  dmsOrdner?: string;
  notiz?: string;
}

// ─── Auto-suggest Akten for an email ────────────────────────────────────────

/**
 * Suggest top 3 Akten based on:
 * 1. Thread history (replies to veraktete emails -> same Akte) -- highest priority
 * 2. Sender/recipient email matching against known Kontakte -> Beteiligter -> Akte
 * 3. Aktenzeichen pattern in subject line (e.g. "123/2025" or "AZ: 123/2025")
 */
export async function suggestAktenForEmail(
  input: SuggestInput
): Promise<AkteSuggestion[]> {
  const suggestions: AkteSuggestion[] = [];
  const seenAkteIds = new Set<string>();

  // Priority 1: Thread history -- if email is in a thread that has veraktete emails, suggest same Akte
  if (input.threadId) {
    const threadVeraktungen = await prisma.emailVeraktung.findMany({
      where: {
        emailNachricht: { threadId: input.threadId },
        aufgehoben: false,
      },
      include: {
        akte: { select: { id: true, aktenzeichen: true, kurzrubrum: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 3,
    });

    for (const v of threadVeraktungen) {
      if (!seenAkteIds.has(v.akte.id)) {
        seenAkteIds.add(v.akte.id);
        suggestions.push({
          akteId: v.akte.id,
          aktenzeichen: v.akte.aktenzeichen,
          kurzrubrum: v.akte.kurzrubrum,
          confidence: "hoch",
          reason: "Antwort auf veraktete E-Mail im selben Thread",
        });
      }
    }
  }

  // Priority 2: Match sender/recipient against Kontakt.email -> Beteiligter -> Akte
  const emailAddresses = [input.absender, ...input.empfaenger].filter(Boolean);
  if (emailAddresses.length > 0) {
    const kontakte = await prisma.kontakt.findMany({
      where: {
        OR: [
          { email: { in: emailAddresses } },
          { email2: { in: emailAddresses } },
        ],
      },
      select: {
        id: true,
        email: true,
        email2: true,
        vorname: true,
        nachname: true,
        firma: true,
        beteiligte: {
          include: {
            akte: {
              select: {
                id: true,
                aktenzeichen: true,
                kurzrubrum: true,
                status: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    for (const kontakt of kontakte) {
      const kontaktName =
        kontakt.firma ??
        [kontakt.vorname, kontakt.nachname].filter(Boolean).join(" ") ??
        kontakt.email;

      for (const beteiligter of kontakt.beteiligte) {
        if (
          beteiligter.akte.status === "GESCHLOSSEN" ||
          beteiligter.akte.status === "ARCHIVIERT"
        ) {
          continue;
        }
        if (!seenAkteIds.has(beteiligter.akte.id)) {
          seenAkteIds.add(beteiligter.akte.id);
          suggestions.push({
            akteId: beteiligter.akte.id,
            aktenzeichen: beteiligter.akte.aktenzeichen,
            kurzrubrum: beteiligter.akte.kurzrubrum,
            confidence: "mittel",
            reason: `Kontakt "${kontaktName}" ist Beteiligter`,
          });
        }
      }
    }
  }

  // Priority 3: Aktenzeichen regex in subject
  const aktenzeichenMatches = extractAktenzeichen(input.betreff);
  if (aktenzeichenMatches.length > 0) {
    const matchedAkten = await prisma.akte.findMany({
      where: {
        aktenzeichen: { in: aktenzeichenMatches },
        status: { notIn: ["GESCHLOSSEN", "ARCHIVIERT"] },
      },
      select: { id: true, aktenzeichen: true, kurzrubrum: true },
    });

    for (const akte of matchedAkten) {
      if (!seenAkteIds.has(akte.id)) {
        seenAkteIds.add(akte.id);
        suggestions.push({
          akteId: akte.id,
          aktenzeichen: akte.aktenzeichen,
          kurzrubrum: akte.kurzrubrum,
          confidence: "niedrig",
          reason: `Aktenzeichen "${akte.aktenzeichen}" im Betreff gefunden`,
        });
      }
    }
  }

  // Return top 3, ordered by confidence
  const confidenceOrder: Record<string, number> = {
    hoch: 0,
    mittel: 1,
    niedrig: 2,
  };
  suggestions.sort(
    (a, b) => confidenceOrder[a.confidence] - confidenceOrder[b.confidence]
  );
  return suggestions.slice(0, 3);
}

// ─── Veraktung (assign email to case) ───────────────────────────────────────

/**
 * Create a Veraktung record, copy selected attachments to DMS, set veraktet flag.
 */
export async function verakteEmail(params: VerakteParams) {
  const { emailId, akteId, userId, anhangIds, dmsOrdner, notiz } = params;
  const targetFolder = dmsOrdner ?? "Korrespondenz";

  // Create EmailVeraktung record
  const veraktung = await prisma.emailVeraktung.create({
    data: {
      emailNachrichtId: emailId,
      akteId,
      userId,
      notiz,
      dmsOrdner: targetFolder,
      anhaengeKopiert: (anhangIds?.length ?? 0) > 0,
    },
    include: {
      akte: { select: { id: true, aktenzeichen: true, kurzrubrum: true } },
      user: { select: { id: true, name: true } },
    },
  });

  // Set email veraktet flag
  await prisma.emailNachricht.update({
    where: { id: emailId },
    data: { veraktet: true },
  });

  // Copy selected attachments to DMS
  if (anhangIds && anhangIds.length > 0) {
    const anhaenge = await prisma.emailAnhang.findMany({
      where: { id: { in: anhangIds }, emailNachrichtId: emailId },
    });

    for (const anhang of anhaenge) {
      try {
        // Read attachment from MinIO
        const stream = await getFileStream(anhang.speicherPfad);
        if (stream) {
          // Generate DMS storage key
          const timestamp = Date.now();
          const sanitized = anhang.dateiname
            .replace(/[^a-zA-Z0-9._-]/g, "_")
            .replace(/_+/g, "_");
          const dmsKey = `akten/${akteId}/${targetFolder}/${timestamp}_${sanitized}`;

          // Convert stream to buffer for upload
          const chunks: Uint8Array[] = [];
          const reader = stream as AsyncIterable<Uint8Array>;
          for await (const chunk of reader) {
            chunks.push(chunk);
          }
          const buffer = Buffer.concat(chunks);

          // Upload to DMS path
          await uploadFile(dmsKey, buffer, anhang.mimeType, buffer.length);

          // Create Dokument record in the case
          await prisma.dokument.create({
            data: {
              akteId,
              name: anhang.dateiname,
              dateipfad: dmsKey,
              mimeType: anhang.mimeType,
              groesse: anhang.groesse,
              ordner: targetFolder,
              tags: ["E-Mail-Anhang"],
              erstelltDurch: "system",
              createdById: userId,
            },
          });
        }
      } catch (error) {
        console.error(
          `Failed to copy attachment ${anhang.id} to DMS:`,
          error
        );
        // Continue with other attachments even if one fails
      }
    }
  }

  return veraktung;
}

// ─── Reverse a Veraktung ────────────────────────────────────────────────────

/**
 * Reverse a Veraktung. Sets aufgehoben=true, does NOT remove DMS copies.
 * Updates email.veraktet based on remaining active Veraktungen.
 */
export async function hebeVeraktungAuf(
  veraktungId: string,
  userId: string
) {
  const veraktung = await prisma.emailVeraktung.update({
    where: { id: veraktungId },
    data: {
      aufgehoben: true,
      aufgehobenAm: new Date(),
    },
    include: {
      emailNachricht: { select: { id: true } },
    },
  });

  // Check if email still has other active Veraktungen
  const remainingActive = await prisma.emailVeraktung.count({
    where: {
      emailNachrichtId: veraktung.emailNachricht.id,
      aufgehoben: false,
    },
  });

  // If no more active Veraktungen, unset veraktet flag
  if (remainingActive === 0) {
    await prisma.emailNachricht.update({
      where: { id: veraktung.emailNachricht.id },
      data: { veraktet: false },
    });
  }

  return veraktung;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Extract Aktenzeichen patterns from a subject line.
 * Matches patterns like "123/2025", "AZ: 123/2025", "Az. 45/24"
 */
function extractAktenzeichen(subject: string): string[] {
  const patterns = [
    // AZ: 123/2025 or Az. 123/2025 or AZ 123/2025
    /(?:AZ[.:]?\s*)(\d{1,5}\/\d{2,4})/gi,
    // Standalone number/year patterns
    /\b(\d{1,5}\/\d{4})\b/g,
    /\b(\d{1,5}\/\d{2})\b/g,
  ];

  const matches = new Set<string>();
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(subject)) !== null) {
      matches.add(match[1] ?? match[0]);
    }
  }

  return Array.from(matches);
}
