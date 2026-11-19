import { PrismaClient, UserRole, Sachgebiet, AkteStatus, KontaktTyp, BeteiligterRolle, KalenderTyp, EmailRichtung } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedBasis, isDemoSeed, DEMO_PASSWORT } from "./seed-basis";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  const basis = await seedBasis(prisma);
  const admin = { id: basis.adminId };
  const kanzlei = { id: basis.kanzleiId };

  if (!isDemoSeed()) {
    await prisma.auditLog.create({
      data: { userId: admin.id, aktion: "SYSTEM_SEED", details: { message: "Grundausstattung angelegt" } },
    });
    console.log("Seed completed (Produktion): Administratorkonto + Systembenutzer, keine Beispieldaten.");
    console.log(`   Login: ${basis.adminEmail}`);
    if (basis.erzeugtesPasswort) {
      console.log("   INITIAL_ADMIN_PASSWORD war nicht gesetzt. Einmaliges Passwort:");
      console.log(`   ${basis.erzeugtesPasswort}`);
      console.log("   Bitte nach der ersten Anmeldung unter Einstellungen > Sicherheit ändern.");
    } else {
      console.log("   Passwort: Wert von INITIAL_ADMIN_PASSWORD aus der .env");
    }
    return;
  }

  // ─── Demo-Benutzer (nur Entwicklung oder SEED_DEMO=true) ──────────────────
  const demoHash = await bcrypt.hash(DEMO_PASSWORT, 12);

  const anwalt = await prisma.user.upsert({
    where: { email: "anwalt@kanzlei.de" },
    update: {},
    create: {
      email: "anwalt@kanzlei.de",
      name: "Dr. Maria Schmidt",
      passwordHash: demoHash,
      role: UserRole.ANWALT,
      position: "Rechtsanwältin",
      kanzleiId: kanzlei.id,
    },
  });

  const sachbearbeiter = await prisma.user.upsert({
    where: { email: "sachbearbeiter@kanzlei.de" },
    update: {},
    create: {
      email: "sachbearbeiter@kanzlei.de",
      name: "Anna Meier",
      passwordHash: demoHash,
      role: UserRole.SACHBEARBEITER,
      position: "Rechtsanwaltsfachangestellte",
      kanzleiId: kanzlei.id,
    },
  });

  // ─── Kontakte ──────────────────────────────────────────────────────────────
  const mandant1 = await prisma.kontakt.upsert({
    where: { id: "kontakt-mueller" },
    update: {},
    create: {
      id: "kontakt-mueller",
      typ: KontaktTyp.NATUERLICH,
      anrede: "Herr",
      vorname: "Thomas",
      nachname: "Müller",
      strasse: "Hauptstraße 42",
      plz: "44137",
      ort: "Dortmund",
      telefon: "+49 231 9876543",
      email: "t.mueller@email.de",
    },
  });

  const gegner1 = await prisma.kontakt.upsert({
    where: { id: "kontakt-schmidt-gmbh" },
    update: {},
    create: {
      id: "kontakt-schmidt-gmbh",
      typ: KontaktTyp.JURISTISCH,
      firma: "Schmidt & Partner GmbH",
      rechtsform: "GmbH",
      strasse: "Industrieweg 5",
      plz: "44139",
      ort: "Dortmund",
      telefon: "+49 231 5551234",
      email: "info@schmidt-partner.de",
    },
  });

  const gericht = await prisma.kontakt.upsert({
    where: { id: "kontakt-ag-dortmund" },
    update: {},
    create: {
      id: "kontakt-ag-dortmund",
      typ: KontaktTyp.JURISTISCH,
      firma: "Arbeitsgericht Dortmund",
      strasse: "Ruhrallee 1",
      plz: "44139",
      ort: "Dortmund",
      telefon: "+49 231 9260",
    },
  });

  // ─── Akten ─────────────────────────────────────────────────────────────────
  const akte1 = await prisma.akte.upsert({
    where: { aktenzeichen: "00001/26" },
    update: {},
    create: {
      aktenzeichen: "00001/26",
      kurzrubrum: "Müller ./. Schmidt & Partner GmbH",
      wegen: "Kündigungsschutzklage",
      sachgebiet: Sachgebiet.ARBEITSRECHT,
      status: AkteStatus.OFFEN,
      gegenstandswert: 15000,
      anwaltId: anwalt.id,
      sachbearbeiterId: sachbearbeiter.id,
      kanzleiId: kanzlei.id,
    },
  });

  // ─── Beteiligte ────────────────────────────────────────────────────────────
  await prisma.beteiligter.upsert({
    where: {
      akteId_kontaktId_rolle: {
        akteId: akte1.id,
        kontaktId: mandant1.id,
        rolle: BeteiligterRolle.MANDANT,
      },
    },
    update: {},
    create: {
      akteId: akte1.id,
      kontaktId: mandant1.id,
      rolle: BeteiligterRolle.MANDANT,
    },
  });

  await prisma.beteiligter.upsert({
    where: {
      akteId_kontaktId_rolle: {
        akteId: akte1.id,
        kontaktId: gegner1.id,
        rolle: BeteiligterRolle.GEGNER,
      },
    },
    update: {},
    create: {
      akteId: akte1.id,
      kontaktId: gegner1.id,
      rolle: BeteiligterRolle.GEGNER,
    },
  });

  await prisma.beteiligter.upsert({
    where: {
      akteId_kontaktId_rolle: {
        akteId: akte1.id,
        kontaktId: gericht.id,
        rolle: BeteiligterRolle.GERICHT,
      },
    },
    update: {},
    create: {
      akteId: akte1.id,
      kontaktId: gericht.id,
      rolle: BeteiligterRolle.GERICHT,
    },
  });

  // ─── Kalendereinträge ──────────────────────────────────────────────────────
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);

  await prisma.kalenderEintrag.create({
    data: {
      akteId: akte1.id,
      typ: KalenderTyp.FRIST,
      titel: "Klageschrift einreichen",
      beschreibung: "Frist zur Einreichung der Kündigungsschutzklage",
      datum: nextWeek,
      verantwortlichId: anwalt.id,
      fristablauf: nextWeek,
    },
  });

  await prisma.kalenderEintrag.create({
    data: {
      akteId: akte1.id,
      typ: KalenderTyp.TERMIN,
      titel: "Gütetermin ArbG Dortmund",
      beschreibung: "Güteverhandlung vor dem Arbeitsgericht Dortmund, Saal 201",
      datum: new Date(today.getFullYear(), today.getMonth() + 1, 15, 10, 0),
      datumBis: new Date(today.getFullYear(), today.getMonth() + 1, 15, 11, 0),
      verantwortlichId: anwalt.id,
    },
  });

  // ─── E-Mails ──────────────────────────────────────────────────────────────
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  await prisma.emailMessage.createMany({
    data: [
      {
        richtung: EmailRichtung.EINGEHEND,
        betreff: "Kündigungsschutzklage Müller - Terminvorschlag Güteverhandlung",
        absender: "poststelle@arbg-dortmund.nrw.de",
        absenderName: "Arbeitsgericht Dortmund",
        empfaenger: ["info@kanzlei-baumfalk.de"],
        cc: [],
        inhalt: "<p>Sehr geehrte Damen und Herren,</p><p>in der Sache Müller ./. Schmidt & Partner GmbH (Az. 3 Ca 1234/26) wird Termin zur Güteverhandlung bestimmt auf den 15.04.2026, 10:00 Uhr, Saal 201.</p><p>Mit freundlichen Grüßen<br/>Arbeitsgericht Dortmund</p>",
        inhaltText: "Sehr geehrte Damen und Herren, in der Sache Müller ./. Schmidt & Partner GmbH (Az. 3 Ca 1234/26) wird Termin zur Güteverhandlung bestimmt auf den 15.04.2026, 10:00 Uhr, Saal 201. Mit freundlichen Grüßen, Arbeitsgericht Dortmund",
        empfangenAm: oneHourAgo,
        gelesen: false,
        veraktet: true,
        akteId: akte1.id,
        anhangDokumentIds: [],
      },
      {
        richtung: EmailRichtung.EINGEHEND,
        betreff: "Unterlagen Mandant Müller - Arbeitsvertrag & Kündigung",
        absender: "t.mueller@email.de",
        absenderName: "Thomas Müller",
        empfaenger: ["info@kanzlei-baumfalk.de"],
        cc: [],
        inhalt: "<p>Sehr geehrte Frau Dr. Schmidt,</p><p>anbei sende ich Ihnen wie besprochen den Arbeitsvertrag und das Kündigungsschreiben als Scan.</p><p>Mit freundlichen Grüßen<br/>Thomas Müller</p>",
        inhaltText: "Sehr geehrte Frau Dr. Schmidt, anbei sende ich Ihnen wie besprochen den Arbeitsvertrag und das Kündigungsschreiben als Scan. Mit freundlichen Grüßen, Thomas Müller",
        empfangenAm: threeHoursAgo,
        gelesen: false,
        veraktet: true,
        akteId: akte1.id,
        anhangDokumentIds: [],
      },
      {
        richtung: EmailRichtung.AUSGEHEND,
        betreff: "Re: Erstberatung Mietrecht - Nebenkostenabrechnung",
        absender: "info@kanzlei-baumfalk.de",
        absenderName: "Kanzlei Baumfalk",
        empfaenger: ["s.weber@email.de"],
        cc: [],
        inhalt: "<p>Sehr geehrte Frau Weber,</p><p>vielen Dank für Ihre Anfrage. Gerne können wir einen Erstberatungstermin vereinbaren. Bitte bringen Sie die Nebenkostenabrechnung und den Mietvertrag mit.</p><p>Mit freundlichen Grüßen<br/>Kanzlei Baumfalk</p>",
        inhaltText: "Sehr geehrte Frau Weber, vielen Dank für Ihre Anfrage. Gerne können wir einen Erstberatungstermin vereinbaren. Bitte bringen Sie die Nebenkostenabrechnung und den Mietvertrag mit. Mit freundlichen Grüßen, Kanzlei Baumfalk",
        gesendetAm: yesterday,
        gelesen: true,
        veraktet: false,
        anhangDokumentIds: [],
      },
      {
        richtung: EmailRichtung.EINGEHEND,
        betreff: "Anfrage Erstberatung - Mietrecht",
        absender: "s.weber@email.de",
        absenderName: "Sabine Weber",
        empfaenger: ["info@kanzlei-baumfalk.de"],
        cc: [],
        inhalt: "<p>Sehr geehrte Damen und Herren,</p><p>ich habe eine Frage zu meiner Nebenkostenabrechnung. Mein Vermieter verlangt eine Nachzahlung von 1.200 EUR, die mir überhöht erscheint. Können Sie mir weiterhelfen?</p><p>Mit freundlichen Grüßen<br/>Sabine Weber</p>",
        inhaltText: "Sehr geehrte Damen und Herren, ich habe eine Frage zu meiner Nebenkostenabrechnung. Mein Vermieter verlangt eine Nachzahlung von 1.200 EUR, die mir überhöht erscheint. Können Sie mir weiterhelfen? Mit freundlichen Grüßen, Sabine Weber",
        empfangenAm: twoDaysAgo,
        gelesen: true,
        veraktet: false,
        anhangDokumentIds: [],
      },
      {
        richtung: EmailRichtung.EINGEHEND,
        betreff: "Rechtsschutzversicherung - Deckungszusage Müller",
        absender: "leistung@deu-rs.de",
        absenderName: "Deutsche Rechtsschutzversicherung AG",
        empfaenger: ["info@kanzlei-baumfalk.de"],
        cc: [],
        inhalt: "<p>Sehr geehrte Damen und Herren,</p><p>zu Ihrer Deckungsanfrage vom 10.02.2026 bezüglich Ihres Mandanten Thomas Müller erteilen wir hiermit Deckungszusage für die Kündigungsschutzklage gegen die Schmidt & Partner GmbH.</p><p>Bitte beachten Sie die Selbstbeteiligung von 300 EUR.</p><p>Mit freundlichen Grüßen<br/>Deutsche Rechtsschutzversicherung AG</p>",
        inhaltText: "Sehr geehrte Damen und Herren, zu Ihrer Deckungsanfrage vom 10.02.2026 bezüglich Ihres Mandanten Thomas Müller erteilen wir hiermit Deckungszusage für die Kündigungsschutzklage gegen die Schmidt & Partner GmbH. Bitte beachten Sie die Selbstbeteiligung von 300 EUR. Mit freundlichen Grüßen, Deutsche Rechtsschutzversicherung AG",
        empfangenAm: twoDaysAgo,
        gelesen: true,
        veraktet: true,
        akteId: akte1.id,
        anhangDokumentIds: [],
      },
      {
        richtung: EmailRichtung.EINGEHEND,
        betreff: "Seminar: Neues im Arbeitsrecht 2026",
        absender: "newsletter@dav-seminare.de",
        absenderName: "DAV Seminare",
        empfaenger: ["info@kanzlei-baumfalk.de"],
        cc: [],
        inhalt: `<p>Sehr geehrte Damen und Herren,</p><p>wir laden Sie herzlich ein zu unserem Online-Seminar "Neues im Arbeitsrecht 2026" am 10.03.2026.</p><p>Themen: Aktuelle BAG-Rechtsprechung, Änderungen im TzBfG, Whistleblowing.</p>`,
        inhaltText: `Sehr geehrte Damen und Herren, wir laden Sie herzlich ein zu unserem Online-Seminar "Neues im Arbeitsrecht 2026" am 10.03.2026. Themen: Aktuelle BAG-Rechtsprechung, Änderungen im TzBfG, Whistleblowing.`,
        empfangenAm: lastWeek,
        gelesen: true,
        veraktet: false,
        anhangDokumentIds: [],
      },
      {
        richtung: EmailRichtung.EINGEHEND,
        betreff: "Gegnervertreter - Klageerwiderung angekündigt",
        absender: "ra.hansen@hansen-rae.de",
        absenderName: "RA Dr. Hansen",
        empfaenger: ["info@kanzlei-baumfalk.de"],
        cc: ["t.mueller@email.de"],
        inhalt: "<p>Sehr geehrte Frau Dr. Schmidt,</p><p>hiermit zeige ich an, dass ich die Interessen der Schmidt & Partner GmbH vertrete. Die Klageerwiderung wird fristgerecht eingereicht.</p><p>Mit freundlichen kollegialen Grüßen<br/>RA Dr. Hansen</p>",
        inhaltText: "Sehr geehrte Frau Dr. Schmidt, hiermit zeige ich an, dass ich die Interessen der Schmidt & Partner GmbH vertrete. Die Klageerwiderung wird fristgerecht eingereicht. Mit freundlichen kollegialen Grüßen, RA Dr. Hansen",
        empfangenAm: yesterday,
        gelesen: false,
        veraktet: true,
        akteId: akte1.id,
        anhangDokumentIds: [],
      },
    ],
    skipDuplicates: true,
  });

  // ─── Audit Log ─────────────────────────────────────────────────────────────
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      aktion: "SYSTEM_SEED",
      details: { message: "Datenbank mit Beispieldaten befüllt" },
    },
  });

  console.log("Seed completed:");
  console.log(`   - 1 Kanzlei`);
  console.log(`   - 4 Users (Admin, Anwalt, Sachbearbeiterin, Helena KI)`);
  console.log(`   - 3 Kontakte (Mandant, Gegner, Gericht)`);
  console.log(`   - 1 Akte mit 3 Beteiligten`);
  console.log(`   - 2 Kalendereintraege (Frist + Termin)`);
  console.log(`   - 7 E-Mails (Beispiel-Posteingang)`);
  console.log(`\n   Login: admin@kanzlei.de / ${DEMO_PASSWORT} (nur Demo)`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
