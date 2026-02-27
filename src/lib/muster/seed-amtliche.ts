/**
 * Seed script for 6 amtliche Arbeitsrecht Formulare.
 *
 * seedAmtlicheFormulare() is idempotent — guarded by SystemSetting
 * "muster.amtliche_seed_version". If the version key already equals "v0.1",
 * the function returns early without any DB writes.
 *
 * Each amtliches Formular uses {{PLATZHALTER}} notation for variable fields.
 * Content is passed directly to insertMusterChunks() — no MinIO fetch occurs.
 *
 * Called during worker startup in Plan 02 (admin upload processor).
 */

import { prisma } from "@/lib/db";
import { getSetting, updateSetting } from "@/lib/settings/service";
import { insertMusterChunks } from "@/lib/muster/ingestion";

// ---------------------------------------------------------------------------
// Seed version — increment to force re-seed on next worker boot
// ---------------------------------------------------------------------------

const SEED_VERSION = "v0.1";
const SEED_SETTING_KEY = "muster.amtliche_seed_version";

// ---------------------------------------------------------------------------
// Type definition
// ---------------------------------------------------------------------------

export interface AmtlichesMusterDefinition {
  name: string;
  kategorie: string;
  rechtsgebiet: string;
  beschreibung: string;
  content: string;
}

// ---------------------------------------------------------------------------
// Amtliche Muster definitions (6 Arbeitsrecht Formulare)
// ---------------------------------------------------------------------------

export const AMTLICHE_MUSTER: AmtlichesMusterDefinition[] = [
  // ──────────────────────────────────────────────────────────────────────────
  // 1. Klageschrift Kündigungsschutzklage
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: "Klageschrift Kündigungsschutzklage",
    kategorie: "Klage",
    rechtsgebiet: "Arbeitsrecht",
    beschreibung:
      "Klageschrift zur Kündigungsschutzklage nach § 1 KSchG mit RUBRUM, ANTRÄGEN und BEGRÜNDUNG.",
    content: `AN DAS ARBEITSGERICHT {{GERICHT}}

Klageschrift

In dem Rechtsstreit

{{KLAEGER_NAME}}, {{KLAEGER_ADRESSE}},
— Kläger —

Prozessbevollmächtigter: Rechtsanwalt {{RA_NAME}}, {{RA_KANZLEI}}, {{RA_ADRESSE}}

gegen

{{BEKLAGTE_FIRMA}}, vertreten durch {{BEKLAGTE_VERTRETER}}, {{BEKLAGTE_ADRESSE}},
— Beklagte —

wegen: Kündigungsschutz

RUBRUM

Der Kläger ist seit dem {{EINTRITTSDATUM}} als {{BERUFSBEZEICHNUNG}} bei der Beklagten
beschäftigt. Das Arbeitsverhältnis besteht zuletzt auf Grundlage des Arbeitsvertrages
vom {{VERTRAGSDATUM}}.

Der Kläger bezieht eine monatliche Bruttovergütung in Höhe von {{BRUTTOGEHALT}} EUR.

Die Beklagte beschäftigt regelmäßig mehr als 10 Arbeitnehmer (§ 23 Abs. 1 KSchG).

ANTRÄGE

Es wird beantragt,

1. festzustellen, dass das Arbeitsverhältnis der Parteien durch die Kündigung der
   Beklagten vom {{KUENDIGUNGSDATUM}} nicht aufgelöst worden ist;

2. im Falle des Obsiegens mit dem Antrag zu 1), die Beklagte zu verurteilen, den
   Kläger bis zum rechtskräftigen Abschluss des Verfahrens als {{BERUFSBEZEICHNUNG}}
   zu unveränderten Bedingungen weiterzubeschäftigen;

3. die Kosten des Verfahrens der Beklagten aufzuerlegen.

BEGRÜNDUNG

I. Die Parteien

Der Kläger, {{KLAEGER_NAME}}, ist seit dem {{EINTRITTSDATUM}} bei der Beklagten,
der {{BEKLAGTE_FIRMA}}, als {{BERUFSBEZEICHNUNG}} tätig. Das Arbeitsverhältnis
unterliegt dem Kündigungsschutzgesetz, da der Kläger länger als 6 Monate im
Betrieb beschäftigt ist (§ 1 Abs. 1 KSchG) und die Beklagte mehr als 10
Arbeitnehmer beschäftigt (§ 23 Abs. 1 KSchG).

II. Die Kündigung

Mit Schreiben vom {{KUENDIGUNGSDATUM}}, dem Kläger zugegangen am {{ZUGANG_DATUM}},
sprach die Beklagte eine ordentliche Kündigung des Arbeitsverhältnisses zum
{{KUENDIGUNGSFRIST_DATUM}} aus.

Beweis: Kündigungsschreiben vom {{KUENDIGUNGSDATUM}} (Anlage K 1)

III. Unwirksamkeit der Kündigung

Die ausgesprochene Kündigung ist sozial ungerechtfertigt im Sinne des § 1 Abs. 2
KSchG und daher unwirksam.

1. Fehlender Kündigungsgrund

Die Beklagte hat keinen der in § 1 Abs. 2 KSchG genannten Kündigungsgründe
(personenbedingt, verhaltensbedingt oder betriebsbedingt) dargelegt.

{{BEGRUENDUNG_KUENDIGUNGSGRUND}}

2. Ordnungsgemäße Betriebsratsanhörung

Die Anhörung des Betriebsrats gemäß § 102 BetrVG ist {{BETRIEBSRAT_ANHOERUNG}}.

3. Wahrung der Klagefrist

Die Klagefrist des § 4 KSchG (3 Wochen ab Zugang der Kündigung) ist gewahrt.
Die Kündigung ist dem Kläger am {{ZUGANG_DATUM}} zugegangen; die Klage wird
fristgerecht erhoben.

Ort, den {{DATUM}}

{{RA_NAME}}
Rechtsanwalt`,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Abmahnungsschreiben
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: "Abmahnungsschreiben",
    kategorie: "Schreiben",
    rechtsgebiet: "Arbeitsrecht",
    beschreibung:
      "Formelles Abmahnungsschreiben des Arbeitgebers mit Sachverhaltsdarstellung, Rüge und Kündigungsandrohung.",
    content: `{{ARBEITGEBER_NAME}}
{{ARBEITGEBER_ADRESSE}}

An
{{ARBEITNEHMER_NAME}}
{{ARBEITNEHMER_ADRESSE}}

{{DATUM}}

Abmahnung

Sehr geehrte(r) {{ARBEITNEHMER_ANREDE}} {{ARBEITNEHMER_NACHNAME}},

wir nehmen Bezug auf das nachfolgend geschilderte Verhalten und mahnen Sie hiermit
förmlich ab.

I. Sachverhaltsdarstellung

Am {{VORFALL_DATUM}} haben Sie {{SACHVERHALT_BESCHREIBUNG}}.

Dieses Verhalten stellt eine erhebliche Verletzung Ihrer arbeitsvertraglichen
Pflichten dar.

Beweis: {{BEWEISMITTEL}}

II. Rüge des pflichtwidrigen Verhaltens

Ihr vorstehend geschildertes Verhalten verstößt gegen {{VERLETZTE_PFLICHT}} aus
Ihrem Arbeitsvertrag vom {{VERTRAGSDATUM}} sowie gegen {{GESETZLICHE_GRUNDLAGE}}.

Wir rügen dieses Verhalten hiermit ausdrücklich als pflichtwidrig und unzulässig.

III. Aufforderung zur Verhaltensänderung

Wir fordern Sie auf, Ihr Verhalten unverzüglich zu ändern und die beschriebenen
Pflichtverletzungen künftig zu unterlassen.

IV. Androhung der Kündigung

Wir weisen Sie ausdrücklich darauf hin, dass wir im Wiederholungsfall oder bei
Fortsetzung des pflichtwidrigen Verhaltens gezwungen sein werden, das
Arbeitsverhältnis zu kündigen — gegebenenfalls fristlos.

V. Ihre Gegenäußerung

Sie haben das Recht, innerhalb von {{FRIST_TAGE}} Tagen eine Gegendarstellung
zu verfassen, die wir zu Ihrer Personalakte nehmen werden.

Diese Abmahnung wird zu Ihrer Personalakte genommen.

Mit freundlichen Grüßen

{{UNTERZEICHNER_NAME}}
{{UNTERZEICHNER_FUNKTION}}
{{ARBEITGEBER_NAME}}

Empfangsbestätigung (Bitte zurücksenden):

Ich habe die Abmahnung vom {{DATUM}} erhalten.

Ort, Datum: _______________________

Unterschrift: _______________________`,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Aufhebungsvertrag
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: "Aufhebungsvertrag",
    kategorie: "Vertrag",
    rechtsgebiet: "Arbeitsrecht",
    beschreibung:
      "Einvernehmlicher Aufhebungsvertrag mit Beendigungsdatum, Abfindungsregelung und Freistellungsklausel.",
    content: `AUFHEBUNGSVERTRAG

zwischen

{{ARBEITGEBER_NAME}}, {{ARBEITGEBER_ADRESSE}},
nachfolgend „Arbeitgeber" genannt,

und

{{ARBEITNEHMER_NAME}}, wohnhaft {{ARBEITNEHMER_ADRESSE}},
nachfolgend „Arbeitnehmer" genannt,

— gemeinsam „die Parteien" genannt —

Präambel

Die Parteien sind sich darüber einig, das bestehende Arbeitsverhältnis einvernehmlich
zu beenden. Das Arbeitsverhältnis des Arbeitnehmers besteht seit dem {{EINTRITTSDATUM}}
auf Grundlage des Arbeitsvertrages vom {{VERTRAGSDATUM}}.

§ 1 — Beendigung des Arbeitsverhältnisses

Das Arbeitsverhältnis wird im gegenseitigen Einvernehmen mit Ablauf des
{{BEENDIGUNGSDATUM}} aufgehoben.

§ 2 — Freistellung

Der Arbeitnehmer wird ab dem {{FREISTELLUNGSDATUM}} von der Pflicht zur
Arbeitsleistung unwiderruflich freigestellt. Die Vergütung wird bis zum
Beendigungsdatum weitergezahlt. Etwaige noch offene Urlaubs- und
Freizeitausgleichsansprüche werden durch die Freistellung abgegolten.

§ 3 — Abfindung

Der Arbeitgeber zahlt dem Arbeitnehmer als Ausgleich für den Verlust des
Arbeitsplatzes eine einmalige Abfindung in Höhe von {{ABFINDUNGSBETRAG}} EUR brutto.

Die Abfindung ist fällig am {{ABFINDUNG_FAELLIGKEITSDATUM}}. Sie wird auf das
folgende Konto überwiesen: IBAN {{IBAN_ARBEITNEHMER}}.

§ 4 — Zeugnis

Der Arbeitgeber verpflichtet sich, dem Arbeitnehmer auf Verlangen ein {{ZEUGNIS_ART}}
Zeugnis zu erteilen, das {{ZEUGNIS_BEWERTUNG}}.

§ 5 — Rückgabe von Arbeitsmitteln

Der Arbeitnehmer gibt bis zum {{RUECKGABE_DATUM}} alle überlassenen Arbeitsmittel
(Laptop, Mobiltelefon, Fahrzeug, Schlüssel, Ausweiskarten etc.) an den Arbeitgeber
zurück.

§ 6 — Geheimhaltung

Der Arbeitnehmer verpflichtet sich, über Betriebs- und Geschäftsgeheimnisse des
Arbeitgebers dauerhaft Stillschweigen zu bewahren.

§ 7 — Wettbewerbsverbot

{{WETTBEWERBSVERBOT_REGELUNG}}

§ 8 — Ausgleichsklausel

Mit Erfüllung dieses Aufhebungsvertrages sind sämtliche wechselseitigen Ansprüche
der Parteien aus dem Arbeitsverhältnis und seiner Beendigung abgegolten und erledigt,
soweit gesetzlich zulässig.

§ 9 — Salvatorische Klausel

Sollten einzelne Bestimmungen dieses Vertrages unwirksam sein, bleibt die Wirksamkeit
der übrigen Bestimmungen unberührt.

§ 10 — Schriftformerfordernis

Änderungen und Ergänzungen dieses Vertrages bedürfen der Schriftform.

Ort, den {{DATUM}}

_______________________          _______________________
{{ARBEITGEBER_VERTRETER}}        {{ARBEITNEHMER_NAME}}
{{ARBEITGEBER_NAME}}`,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Antrag auf einstweilige Verfügung (Weiterbeschäftigung)
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: "Antrag auf einstweilige Verfügung (Weiterbeschäftigung)",
    kategorie: "Antrag",
    rechtsgebiet: "Arbeitsrecht",
    beschreibung:
      "Einstweilige Verfügung auf vorläufige Weiterbeschäftigung während des laufenden Kündigungsschutzverfahrens.",
    content: `AN DAS ARBEITSGERICHT {{GERICHT}}

Antrag auf Erlass einer einstweiligen Verfügung

In dem Verfahren

{{ANTRAGSTELLER_NAME}}, {{ANTRAGSTELLER_ADRESSE}},
— Antragsteller —

Prozessbevollmächtigter: Rechtsanwalt {{RA_NAME}}, {{RA_KANZLEI}}, {{RA_ADRESSE}}

gegen

{{ANTRAGSGEGNER_FIRMA}}, {{ANTRAGSGEGNER_ADRESSE}},
— Antragsgegner —

beantragen wir namens und in Vollmacht des Antragstellers den Erlass folgender
einstweiliger Verfügung:

ANTRÄGE

Der Antragsgegner wird im Wege der einstweiligen Verfügung verpflichtet,

den Antragsteller bis zur rechtskräftigen Beendigung des anhängigen
Kündigungsschutzverfahrens (Az. {{AZ_KUENDIGUNGSSCHUTZ}}) als {{BERUFSBEZEICHNUNG}}
zu den bisherigen arbeitsvertraglichen Bedingungen weiterzubeschäftigen.

BEGRÜNDUNG

I. Verfügungsanspruch

Der Antragsteller ist seit dem {{EINTRITTSDATUM}} bei dem Antragsgegner als
{{BERUFSBEZEICHNUNG}} beschäftigt. Der Antragsgegner hat das Arbeitsverhältnis
mit Schreiben vom {{KUENDIGUNGSDATUM}} gekündigt.

Gegen diese Kündigung hat der Antragsteller am {{KLAGEEINREICHUNGSDATUM}}
Kündigungsschutzklage beim Arbeitsgericht {{GERICHT}} erhoben (Az. {{AZ_KUENDIGUNGSSCHUTZ}}).

Der Antragsteller hat einen vorläufigen Weiterbeschäftigungsanspruch aus § 611 BGB
i.V.m. dem allgemeinen Persönlichkeitsrecht (Art. 2 Abs. 1 GG) gemäß der
Rechtsprechung des Großen Senats des BAG (BAG GS 27.02.1985 — GS 1/84).

II. Verfügungsgrund / Dringlichkeit

Der Antragsteller ist auf eine Beschäftigung angewiesen, um {{BEGRUENDUNG_DRINGLICHKEIT}}.

Eine erhebliche Beeinträchtigung der beruflichen Qualifikation droht, da die
Branche {{QUALIFIKATIONSVERLUST_BESCHREIBUNG}}.

Die Angelegenheit ist eilbedürftig, weil {{EILBEDUERFIGKEIT_BEGRUENDUNG}}.

III. Glaubhaftmachung

Anlage EVf 1: Arbeitsvertrag vom {{VERTRAGSDATUM}}
Anlage EVf 2: Kündigungsschreiben vom {{KUENDIGUNGSDATUM}}
Anlage EVf 3: Klageeinreichungsbestätigung (Az. {{AZ_KUENDIGUNGSSCHUTZ}})
Anlage EVf 4: Eidesstattliche Versicherung des Antragstellers

Ort, den {{DATUM}}

{{RA_NAME}}
Rechtsanwalt`,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Klage auf Zeugniserteilung
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: "Klage auf Zeugniserteilung",
    kategorie: "Klage",
    rechtsgebiet: "Arbeitsrecht",
    beschreibung:
      "Klage auf Erteilung eines qualifizierten Arbeitszeugnisses gemäß § 109 GewO.",
    content: `AN DAS ARBEITSGERICHT {{GERICHT}}

Klageschrift

In dem Rechtsstreit

{{KLAEGER_NAME}}, {{KLAEGER_ADRESSE}},
— Kläger —

Prozessbevollmächtigter: Rechtsanwalt {{RA_NAME}}, {{RA_KANZLEI}}, {{RA_ADRESSE}}

gegen

{{BEKLAGTE_FIRMA}}, vertreten durch {{BEKLAGTE_VERTRETER}}, {{BEKLAGTE_ADRESSE}},
— Beklagte —

wegen: Zeugniserteilung

ANTRAG

Es wird beantragt,

die Beklagte zu verurteilen, dem Kläger ein qualifiziertes Arbeitszeugnis gemäß
§ 109 Abs. 1 Satz 3 GewO über die Tätigkeit als {{BERUFSBEZEICHNUNG}} für den
Zeitraum vom {{BESCHAEFTIGUNGSBEGINN}} bis zum {{BESCHAEFTIGUNGSENDE}} zu erteilen,
das sich auf {{ZEUGNIS_INHALTE}} erstreckt und mit einer Bewertung von {{ZEUGNIS_GESAMTNOTE}}
abschließt.

Hilfsweise:

Die Beklagte zu verurteilen, ein einfaches Arbeitszeugnis gemäß § 109 Abs. 1 Satz 1
GewO zu erteilen.

BEGRÜNDUNG

I. Das Arbeitsverhältnis

Der Kläger war vom {{BESCHAEFTIGUNGSBEGINN}} bis zum {{BESCHAEFTIGUNGSENDE}} bei der
Beklagten als {{BERUFSBEZEICHNUNG}} beschäftigt. Das Arbeitsverhältnis endete durch
{{BEENDIGUNGSGRUND}}.

Beweis: Arbeitsvertrag vom {{VERTRAGSDATUM}} (Anlage K 1)
        Beendigungsnachweis vom {{BEENDIGUNGSDATUM}} (Anlage K 2)

II. Der Zeugnisanspruch

Gemäß § 109 Abs. 1 GewO hat der Arbeitnehmer bei Beendigung eines
Arbeitsverhältnisses Anspruch auf ein schriftliches Zeugnis. Das Zeugnis muss
mindestens Angaben über Art und Dauer der Tätigkeit enthalten. Auf Verlangen des
Arbeitnehmers ist auch die Führung und Leistung in das Zeugnis aufzunehmen
(qualifiziertes Zeugnis).

Der Kläger hat mit Schreiben vom {{AUFFORDERUNGSDATUM}} die Erteilung eines
qualifizierten Zeugnisses verlangt.

Beweis: Aufforderungsschreiben vom {{AUFFORDERUNGSDATUM}} (Anlage K 3)

III. Nichterfüllung

Die Beklagte hat trotz der Aufforderung bis heute kein Zeugnis erteilt.
Ein Zurückbehaltungsrecht besteht für die Beklagte nicht.

IV. Inhalt des Zeugnisses

Das Zeugnis muss wahrheitsgemäß und wohlwollend abgefasst sein. Es darf keine
verschlüsselten negativen Bewertungen enthalten (Gebot der Zeugnisklarheit).

Der Kläger war während seiner gesamten Beschäftigungszeit {{LEISTUNGSBEURTEILUNG}}
und hat {{VERHALTENSBEURTEILUNG}} gehandelt.

Ort, den {{DATUM}}

{{RA_NAME}}
Rechtsanwalt`,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Widerspruch gegen Abmahnung
  // ──────────────────────────────────────────────────────────────────────────
  {
    name: "Widerspruch gegen Abmahnung",
    kategorie: "Schreiben",
    rechtsgebiet: "Arbeitsrecht",
    beschreibung:
      "Formeller Widerspruch des Arbeitnehmers gegen eine erteilte Abmahnung mit Gegendarstellung.",
    content: `{{ARBEITNEHMER_NAME}}
{{ARBEITNEHMER_ADRESSE}}

An
{{ARBEITGEBER_NAME}}
{{ARBEITGEBER_ADRESSE}}

{{DATUM}}

Widerspruch gegen die Abmahnung vom {{ABMAHNUNGSDATUM}}

Sehr geehrte Damen und Herren,

hiermit erhebe ich durch meinen Prozessbevollmächtigten Widerspruch gegen die mir
am {{ZUGANG_ABMAHNUNG}} zugegangene Abmahnung vom {{ABMAHNUNGSDATUM}}.

Prozessbevollmächtigter: Rechtsanwalt {{RA_NAME}}, {{RA_KANZLEI}}, {{RA_ADRESSE}}

I. Sachverhalt

In der Abmahnung vom {{ABMAHNUNGSDATUM}} wird mir vorgeworfen, dass ich
{{VORWURF_AUS_ABMAHNUNG}}.

Dieser Vorwurf ist unrichtig.

II. Gegendarstellung

Der tatsächliche Sachverhalt stellt sich wie folgt dar:

{{GEGENDARSTELLUNG_SACHVERHALT}}

Beweis: {{BEWEISMITTEL_WIDERSPRUCH}}

III. Rechtliche Würdigung

Mein Verhalten stellt keine schuldhafte Verletzung arbeitsvertraglicher Pflichten
dar, weil {{RECHTLICHE_BEGRUENDUNG}}.

{{ZUSAETZLICHE_RECHTSARGUMENTE}}

IV. Forderung

Ich fordere Sie auf,

1. die Abmahnung vom {{ABMAHNUNGSDATUM}} aus meiner Personalakte zu entfernen;

2. diese Gegendarstellung zu meiner Personalakte zu nehmen (§ 83 Abs. 2 BetrVG).

Sollten Sie dieser Aufforderung nicht bis zum {{FRIST_WIDERSPRUCH}} nachkommen,
behalten wir uns vor, gerichtliche Schritte einzuleiten — insbesondere auf
Entfernung der Abmahnung aus der Personalakte zu klagen.

Mit freundlichen Grüßen

{{RA_NAME}}
Rechtsanwalt

im Auftrag von {{ARBEITNEHMER_NAME}}`,
  },
];

// ---------------------------------------------------------------------------
// Seed function
// ---------------------------------------------------------------------------

/**
 * Seed the 6 amtliche Arbeitsrecht Formulare into the muster_chunks table.
 *
 * Idempotency: guarded by SystemSetting "muster.amtliche_seed_version".
 * If the setting already equals SEED_VERSION ("v0.1"), returns early.
 *
 * For each amtliches Muster:
 * 1. Creates a synthetic Muster row with isKanzleiEigen=false, nerStatus=INDEXED
 * 2. Calls insertMusterChunks(id, content) — passes content directly to avoid MinIO
 * 3. After all seeds succeed, writes the version key to prevent re-seeding
 *
 * @throws When no ADMIN user exists in the database
 */
export async function seedAmtlicheFormulare(): Promise<void> {
  // Idempotency guard
  const currentVersion = await getSetting(SEED_SETTING_KEY);
  if (currentVersion === SEED_VERSION) {
    console.log(
      `[muster-seed] Amtliche Formulare already seeded (version ${SEED_VERSION}) — skipping`
    );
    return;
  }

  // Find the first ADMIN user to use as uploadedById
  const adminUser = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });

  if (!adminUser) {
    throw new Error(
      "seedAmtlicheFormulare: no ADMIN user found — create an admin user first"
    );
  }

  console.log(
    `[muster-seed] Seeding ${AMTLICHE_MUSTER.length} amtliche Formulare...`
  );

  for (const amtliches of AMTLICHE_MUSTER) {
    // Create synthetic Muster row
    const muster = await prisma.muster.create({
      data: {
        name: amtliches.name,
        kategorie: amtliches.kategorie,
        beschreibung: amtliches.beschreibung,
        minioKey: "seed/placeholder",
        mimeType: "text/plain",
        nerStatus: "INDEXED",
        isKanzleiEigen: false,
        uploadedById: adminUser.id,
      },
    });

    // Insert chunks with hardcoded content — no MinIO fetch
    const { inserted } = await insertMusterChunks(muster.id, amtliches.content);

    console.log(
      `[muster-seed] Seeded "${amtliches.name}" — ${inserted} chunks inserted`
    );
  }

  // Mark version as complete to prevent re-seeding
  await updateSetting(SEED_SETTING_KEY, SEED_VERSION);

  console.log(
    `[muster-seed] All amtliche Formulare seeded successfully (version ${SEED_VERSION})`
  );
}
