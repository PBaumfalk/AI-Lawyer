import { prisma } from "@/lib/db";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

/**
 * Generate an Auskunftsrecht (Art. 15 DSGVO) PDF for a given Kontakt.
 * Contains all stored personal data sections.
 */
export async function generateAuskunftPdf(kontaktId: string): Promise<Buffer> {
  // Load all data related to this Kontakt
  const kontakt = await prisma.kontakt.findUnique({
    where: { id: kontaktId },
    include: {
      adressen: true,
      beteiligte: {
        include: {
          akte: {
            select: {
              id: true,
              aktenzeichen: true,
              kurzrubrum: true,
              status: true,
              dokumente: {
                select: { id: true, name: true, mimeType: true, createdAt: true },
                orderBy: { createdAt: "desc" },
              },
              kalenderEintraege: {
                select: { id: true, titel: true, datum: true, typ: true },
                orderBy: { datum: "desc" },
              },
            },
          },
        },
      },
    },
  });

  if (!kontakt) throw new Error("Kontakt nicht gefunden");

  // Create PDF
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 50;
  const lineHeight = 14;
  const maxWidth = pageWidth - 2 * margin;

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // Helper to add a new page if needed
  function checkPage(needed: number = lineHeight * 2) {
    if (y < margin + needed) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  }

  function drawText(text: string, opts?: { bold?: boolean; size?: number; color?: [number, number, number] }) {
    const f = opts?.bold ? fontBold : font;
    const s = opts?.size ?? 9;
    const c = opts?.color ?? [0.1, 0.1, 0.1];
    // Truncate very long text to prevent overflow
    const truncated = text.length > 120 ? text.substring(0, 117) + "..." : text;
    checkPage();
    page.drawText(truncated, { x: margin, y, font: f, size: s, color: rgb(c[0], c[1], c[2]) });
    y -= lineHeight;
  }

  function drawKeyValue(key: string, value: string | null | undefined) {
    if (!value) return;
    checkPage();
    page.drawText(`${key}: `, { x: margin, y, font: fontBold, size: 9, color: rgb(0.3, 0.3, 0.3) });
    page.drawText(value, { x: margin + font.widthOfTextAtSize(`${key}: `, 9) + 10, y, font, size: 9, color: rgb(0.1, 0.1, 0.1) });
    y -= lineHeight;
  }

  function drawSection(title: string) {
    y -= 8;
    checkPage(30);
    page.drawLine({
      start: { x: margin, y: y + 4 },
      end: { x: pageWidth - margin, y: y + 4 },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });
    y -= 4;
    drawText(title, { bold: true, size: 12, color: [0.1, 0.1, 0.4] });
    y -= 4;
  }

  // ─── Header ────────────────────────────────────────────────
  drawText("Datenauskunft gemaess Art. 15 DSGVO", { bold: true, size: 18, color: [0.1, 0.1, 0.3] });
  y -= 8;
  drawText(`Erstellt am: ${new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}`, {
    size: 9,
    color: [0.4, 0.4, 0.4],
  });
  y -= 12;

  // ─── 1. Kontaktdaten ──────────────────────────────────────
  drawSection("1. Kontaktdaten");
  const displayName =
    kontakt.typ === "NATUERLICH"
      ? `${kontakt.vorname ?? ""} ${kontakt.nachname ?? ""}`.trim()
      : kontakt.firma ?? "Unbekannt";
  drawKeyValue("Name", displayName);
  drawKeyValue("Typ", kontakt.typ === "NATUERLICH" ? "Natuerliche Person" : "Juristische Person");
  drawKeyValue("Anrede", kontakt.anrede);
  drawKeyValue("Titel", kontakt.titel);
  drawKeyValue("E-Mail", kontakt.email);
  drawKeyValue("E-Mail (2)", kontakt.email2);
  drawKeyValue("Telefon", kontakt.telefon);
  drawKeyValue("Telefon (2)", kontakt.telefon2);
  drawKeyValue("Mobil", kontakt.mobil);
  drawKeyValue("Fax", kontakt.fax);
  drawKeyValue("Geburtsdatum", kontakt.geburtsdatum?.toLocaleDateString("de-DE"));
  drawKeyValue("Geburtsname", kontakt.geburtsname);
  drawKeyValue("Geburtsort", kontakt.geburtsort);
  drawKeyValue("Geburtsland", kontakt.geburtsland);
  drawKeyValue("Beruf", kontakt.beruf);
  drawKeyValue("Branche", kontakt.branche);
  drawKeyValue("Steuernummer", kontakt.steuernr);
  drawKeyValue("USt-Id", kontakt.ustIdNr);
  drawKeyValue("IBAN", kontakt.iban);
  drawKeyValue("BIC", kontakt.bic);
  drawKeyValue("Kontoinhaber", kontakt.kontoinhaber);
  drawKeyValue("beA SAFE-ID", kontakt.beaSafeId);
  drawKeyValue("Mandantennummer", kontakt.mandantennummer);
  if (kontakt.tags.length > 0) {
    drawKeyValue("Tags", kontakt.tags.join(", "));
  }

  // Addresses
  if (kontakt.adressen.length > 0) {
    y -= 4;
    drawText("Adressen:", { bold: true, size: 10 });
    for (const addr of kontakt.adressen) {
      const parts = [addr.strasse, addr.hausnummer, addr.plz, addr.ort, addr.land].filter(Boolean);
      drawText(`  ${addr.typ}: ${parts.join(", ") || "Keine Angabe"}`);
    }
  }

  // ─── 2. Akten ─────────────────────────────────────────────
  drawSection("2. Akten (als Beteiligter)");
  if (kontakt.beteiligte.length === 0) {
    drawText("Keine Akten-Beteiligungen vorhanden.");
  } else {
    for (const bet of kontakt.beteiligte) {
      const a = bet.akte;
      drawText(`${a.aktenzeichen} - ${a.kurzrubrum} (${a.status}, Rolle: ${bet.rolle})`, {
        size: 9,
      });
    }
  }

  // ─── 3. Dokumente ─────────────────────────────────────────
  drawSection("3. Dokumente in zugehoerigen Akten");
  let docCount = 0;
  for (const bet of kontakt.beteiligte) {
    for (const dok of bet.akte.dokumente) {
      checkPage();
      drawText(
        `${dok.name} (${dok.mimeType}) - ${dok.createdAt.toLocaleDateString("de-DE")} [Akte: ${bet.akte.aktenzeichen}]`
      );
      docCount++;
      if (docCount >= 200) {
        drawText("... (weitere Dokumente nicht aufgefuehrt, max. 200)");
        break;
      }
    }
    if (docCount >= 200) break;
  }
  if (docCount === 0) {
    drawText("Keine Dokumente vorhanden.");
  }

  // ─── 4. Kalendereintraege ─────────────────────────────────
  drawSection("4. Kalendereintraege");
  let calCount = 0;
  for (const bet of kontakt.beteiligte) {
    for (const ke of bet.akte.kalenderEintraege) {
      checkPage();
      drawText(
        `${ke.titel} (${ke.typ}) - ${ke.datum.toLocaleDateString("de-DE")} [Akte: ${bet.akte.aktenzeichen}]`
      );
      calCount++;
      if (calCount >= 100) {
        drawText("... (weitere Eintraege nicht aufgefuehrt, max. 100)");
        break;
      }
    }
    if (calCount >= 100) break;
  }
  if (calCount === 0) {
    drawText("Keine Kalendereintraege vorhanden.");
  }

  // ─── 5. Buchungen (Aktenkonto) ────────────────────────────
  drawSection("5. Buchungen (Aktenkonto)");
  const akteIds = kontakt.beteiligte.map((b) => b.akte.id);
  let buchungen: Array<{ buchungsdatum: Date; verwendungszweck: string; betrag: any; buchungstyp: string }> = [];
  if (akteIds.length > 0) {
    buchungen = await prisma.aktenKontoBuchung.findMany({
      where: { akteId: { in: akteIds } },
      select: { buchungsdatum: true, verwendungszweck: true, betrag: true, buchungstyp: true },
      orderBy: { buchungsdatum: "desc" },
      take: 100,
    });
  }
  if (buchungen.length === 0) {
    drawText("Keine Buchungen vorhanden.");
  } else {
    for (const b of buchungen) {
      drawText(
        `${b.buchungsdatum.toLocaleDateString("de-DE")} - ${b.verwendungszweck} (${b.buchungstyp}: ${parseFloat(String(b.betrag)).toFixed(2)} EUR)`
      );
    }
  }

  // ─── Footer ───────────────────────────────────────────────
  y -= 20;
  checkPage(40);
  page.drawLine({
    start: { x: margin, y: y + 4 },
    end: { x: pageWidth - margin, y: y + 4 },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 10;
  drawText(
    `Generiert am ${new Date().toLocaleDateString("de-DE")} ${new Date().toLocaleTimeString("de-DE")} | Kontakt-ID: ${kontaktId}`,
    { size: 8, color: [0.5, 0.5, 0.5] }
  );

  const pdfBytes = await pdf.save();
  return Buffer.from(pdfBytes);
}
