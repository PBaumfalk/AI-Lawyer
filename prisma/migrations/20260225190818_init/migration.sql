-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'ANWALT', 'SACHBEARBEITER', 'SEKRETARIAT');

-- CreateEnum
CREATE TYPE "KontaktTyp" AS ENUM ('NATUERLICH', 'JURISTISCH');

-- CreateEnum
CREATE TYPE "BeteiligterRolle" AS ENUM ('MANDANT', 'GEGNER', 'GEGNERVERTRETER', 'GERICHT', 'ZEUGE', 'SACHVERSTAENDIGER', 'SONSTIGER');

-- CreateEnum
CREATE TYPE "AkteStatus" AS ENUM ('OFFEN', 'RUHEND', 'ARCHIVIERT', 'GESCHLOSSEN');

-- CreateEnum
CREATE TYPE "Sachgebiet" AS ENUM ('ARBEITSRECHT', 'FAMILIENRECHT', 'VERKEHRSRECHT', 'MIETRECHT', 'STRAFRECHT', 'ERBRECHT', 'SOZIALRECHT', 'INKASSO', 'HANDELSRECHT', 'VERWALTUNGSRECHT', 'SONSTIGES');

-- CreateEnum
CREATE TYPE "KalenderTyp" AS ENUM ('TERMIN', 'FRIST', 'WIEDERVORLAGE');

-- CreateEnum
CREATE TYPE "FristPrioritaet" AS ENUM ('SEHR_NIEDRIG', 'NIEDRIG', 'NORMAL', 'HOCH', 'DRINGEND');

-- CreateEnum
CREATE TYPE "BuchungsTyp" AS ENUM ('EINNAHME', 'AUSGABE', 'FREMDGELD', 'AUSLAGE');

-- CreateEnum
CREATE TYPE "KontoTyp" AS ENUM ('GESCHAEFT', 'ANDERKONTO');

-- CreateEnum
CREATE TYPE "MahnStufe" AS ENUM ('ERINNERUNG', 'ERSTE_MAHNUNG', 'ZWEITE_MAHNUNG', 'DRITTE_MAHNUNG');

-- CreateEnum
CREATE TYPE "BuchungsperiodeStatus" AS ENUM ('OFFEN', 'GESPERRT');

-- CreateEnum
CREATE TYPE "RechnungStatus" AS ENUM ('ENTWURF', 'GESTELLT', 'BEZAHLT', 'MAHNUNG', 'STORNIERT');

-- CreateEnum
CREATE TYPE "RechnungTyp" AS ENUM ('RVG', 'STUNDENHONORAR', 'PAUSCHALE');

-- CreateEnum
CREATE TYPE "BeaNachrichtStatus" AS ENUM ('EINGANG', 'GELESEN', 'ZUGEORDNET', 'GESENDET', 'FEHLER');

-- CreateEnum
CREATE TYPE "EmailRichtung" AS ENUM ('EINGEHEND', 'AUSGEHEND');

-- CreateEnum
CREATE TYPE "EmailAuthTyp" AS ENUM ('PASSWORT', 'OAUTH2');

-- CreateEnum
CREATE TYPE "EmailSpezialTyp" AS ENUM ('INBOX', 'SENT', 'DRAFTS', 'TRASH', 'JUNK', 'ARCHIVE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "EmailSendeStatus" AS ENUM ('ENTWURF', 'GEPLANT', 'WIRD_GESENDET', 'GESENDET', 'FEHLGESCHLAGEN');

-- CreateEnum
CREATE TYPE "EmailPrioritaet" AS ENUM ('NIEDRIG', 'NORMAL', 'HOCH');

-- CreateEnum
CREATE TYPE "EmailInitialSync" AS ENUM ('NUR_NEUE', 'DREISSIG_TAGE', 'ALLES');

-- CreateEnum
CREATE TYPE "EmailSyncStatus" AS ENUM ('VERBUNDEN', 'SYNCHRONISIERT', 'FEHLER', 'GETRENNT');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OFFEN', 'IN_BEARBEITUNG', 'ERLEDIGT');

-- CreateEnum
CREATE TYPE "TicketPrioritaet" AS ENUM ('NIEDRIG', 'NORMAL', 'HOCH', 'KRITISCH');

-- CreateEnum
CREATE TYPE "DokumentStatus" AS ENUM ('ENTWURF', 'ZUR_PRUEFUNG', 'FREIGEGEBEN', 'VERSENDET');

-- CreateEnum
CREATE TYPE "OcrStatus" AS ENUM ('AUSSTEHEND', 'IN_BEARBEITUNG', 'ABGESCHLOSSEN', 'FEHLGESCHLAGEN', 'NICHT_NOETIG');

-- CreateEnum
CREATE TYPE "Familienstand" AS ENUM ('LEDIG', 'VERHEIRATET', 'GESCHIEDEN', 'VERWITWET', 'LEBENSPARTNERSCHAFT');

-- CreateEnum
CREATE TYPE "Registerart" AS ENUM ('HRB', 'HRA', 'VR', 'PR', 'GNR', 'SONSTIGE');

-- CreateEnum
CREATE TYPE "AdressenTyp" AS ENUM ('HAUPTANSCHRIFT', 'ZUSTELLANSCHRIFT', 'RECHNUNGSANSCHRIFT', 'SONSTIGE');

-- CreateEnum
CREATE TYPE "BevorzugteKontaktart" AS ENUM ('EMAIL', 'TELEFON', 'BRIEF', 'FAX', 'BEA');

-- CreateEnum
CREATE TYPE "KycDokumentart" AS ENUM ('PERSONALAUSWEIS', 'REISEPASS', 'FUEHRERSCHEIN', 'AUFENTHALTSTITEL', 'SONSTIGE');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('NICHT_GEPRUEFT', 'IN_PRUEFUNG', 'VERIFIZIERT', 'ABGELEHNT', 'ABGELAUFEN');

-- CreateEnum
CREATE TYPE "RisikoEinstufung" AS ENUM ('NIEDRIG', 'MITTEL', 'HOCH');

-- CreateEnum
CREATE TYPE "VollmachtTyp" AS ENUM ('EINZELVOLLMACHT', 'GENERALVOLLMACHT', 'PROZESSVOLLMACHT', 'VORSORGEVOLLMACHT', 'SONSTIGE');

-- CreateEnum
CREATE TYPE "KontaktDokumentKategorie" AS ENUM ('IDENTITAET', 'VERTRAG', 'VOLLMACHT', 'KYC', 'HR_AUSZUG', 'SONSTIGE');

-- CreateEnum
CREATE TYPE "BeziehungTyp" AS ENUM ('EHEPARTNER', 'KIND', 'ELTERNTEIL', 'GESETZLICHER_VERTRETER', 'BETREUER', 'ARBEITGEBER', 'ARBEITNEHMER', 'GESCHAEFTSFUEHRER', 'GESELLSCHAFTER', 'SONSTIGE');

-- CreateEnum
CREATE TYPE "MandatsKategorie" AS ENUM ('A_KUNDE', 'DAUERAUFTRAGGEBER', 'GELEGENHEITSMANDANT', 'PRO_BONO', 'SONSTIGE');

-- CreateEnum
CREATE TYPE "VorlageKategorie" AS ENUM ('SCHRIFTSATZ', 'KLAGE', 'MANDATSVOLLMACHT', 'MAHNUNG', 'VERTRAG', 'BRIEF', 'BESCHEID', 'SONSTIGES');

-- CreateTable
CREATE TABLE "kanzleien" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "strasse" TEXT,
    "plz" TEXT,
    "ort" TEXT,
    "telefon" TEXT,
    "fax" TEXT,
    "email" TEXT,
    "website" TEXT,
    "beaId" TEXT,
    "steuernr" TEXT,
    "ustIdNr" TEXT,
    "bankName" TEXT,
    "iban" TEXT,
    "bic" TEXT,
    "logo" TEXT,
    "defaultZahlungszielTage" INTEGER NOT NULL DEFAULT 14,
    "skr" TEXT NOT NULL DEFAULT '03',
    "defaultStundensatz" DECIMAL(8,2),
    "nummernkreisPattern" TEXT NOT NULL DEFAULT 'RE-{YEAR}-{SEQ:4}',
    "stornoPattern" TEXT NOT NULL DEFAULT 'GS-{YEAR}-{SEQ:4}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kanzleien_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'SACHBEARBEITER',
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "telefon" TEXT,
    "position" TEXT,
    "avatarUrl" TEXT,
    "kanzleiId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "vertreterId" TEXT,
    "vertretungAktiv" BOOLEAN NOT NULL DEFAULT false,
    "vertretungVon" TIMESTAMP(3),
    "vertretungBis" TIMESTAMP(3),
    "emailVerified" TIMESTAMP(3),
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "canSeeKanzleiFinanzen" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "urlaub_zeitraeume" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "von" TIMESTAMP(3) NOT NULL,
    "bis" TIMESTAMP(3) NOT NULL,
    "notiz" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "urlaub_zeitraeume_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "kontakte" (
    "id" TEXT NOT NULL,
    "typ" "KontaktTyp" NOT NULL,
    "anrede" TEXT,
    "titel" TEXT,
    "vorname" TEXT,
    "nachname" TEXT,
    "geburtsdatum" TIMESTAMP(3),
    "geburtsname" TEXT,
    "geburtsort" TEXT,
    "geburtsland" TEXT,
    "staatsangehoerigkeiten" TEXT[],
    "familienstand" "Familienstand",
    "beruf" TEXT,
    "branche" TEXT,
    "firma" TEXT,
    "rechtsform" TEXT,
    "kurzname" TEXT,
    "registerart" "Registerart",
    "registernummer" TEXT,
    "registergericht" TEXT,
    "gruendungsdatum" TIMESTAMP(3),
    "geschaeftszweck" TEXT,
    "wirtschaftlichBerechtigte" JSONB,
    "strasse" TEXT,
    "plz" TEXT,
    "ort" TEXT,
    "land" TEXT DEFAULT 'Deutschland',
    "telefon" TEXT,
    "telefon2" TEXT,
    "mobil" TEXT,
    "fax" TEXT,
    "email" TEXT,
    "email2" TEXT,
    "website" TEXT,
    "bevorzugteKontaktart" "BevorzugteKontaktart",
    "kontaktzeiten" TEXT,
    "korrespondenzSprachen" TEXT[],
    "beaSafeId" TEXT,
    "aktenzeichen" TEXT,
    "steuernr" TEXT,
    "finanzamt" TEXT,
    "ustIdNr" TEXT,
    "iban" TEXT,
    "bic" TEXT,
    "kontoinhaber" TEXT,
    "zahlungsmodalitaeten" TEXT,
    "bonitaetseinschaetzung" TEXT,
    "minderjaehrig" BOOLEAN NOT NULL DEFAULT false,
    "unterBetreuung" BOOLEAN NOT NULL DEFAULT false,
    "geschaeftsunfaehig" BOOLEAN NOT NULL DEFAULT false,
    "mandantennummer" TEXT,
    "mandatsKategorie" "MandatsKategorie",
    "akquisekanal" TEXT,
    "einwilligungEmail" BOOLEAN NOT NULL DEFAULT false,
    "einwilligungNewsletter" BOOLEAN NOT NULL DEFAULT false,
    "einwilligungAi" BOOLEAN NOT NULL DEFAULT false,
    "notizen" TEXT,
    "tags" TEXT[],
    "customFields" JSONB,
    "anonymisiertAm" TIMESTAMP(3),
    "anonymisiertVon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kontakte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kontakt_feld_definitionen" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "typ" TEXT NOT NULL,
    "optionen" JSONB,
    "pflicht" BOOLEAN NOT NULL DEFAULT false,
    "sortierung" INTEGER NOT NULL DEFAULT 0,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kontakt_feld_definitionen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adressen" (
    "id" TEXT NOT NULL,
    "kontaktId" TEXT NOT NULL,
    "typ" "AdressenTyp" NOT NULL DEFAULT 'HAUPTANSCHRIFT',
    "bezeichnung" TEXT,
    "strasse" TEXT,
    "hausnummer" TEXT,
    "plz" TEXT,
    "ort" TEXT,
    "land" TEXT DEFAULT 'Deutschland',
    "istHaupt" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adressen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identitaets_pruefungen" (
    "id" TEXT NOT NULL,
    "kontaktId" TEXT NOT NULL,
    "dokumentart" "KycDokumentart" NOT NULL,
    "ausweisnummer" TEXT,
    "behoerde" TEXT,
    "datum" TIMESTAMP(3),
    "gueltigBis" TIMESTAMP(3),
    "pruefmethode" TEXT,
    "status" "KycStatus" NOT NULL DEFAULT 'NICHT_GEPRUEFT',
    "risikoEinstufung" "RisikoEinstufung",
    "notizen" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "identitaets_pruefungen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vollmachten" (
    "id" TEXT NOT NULL,
    "geberId" TEXT NOT NULL,
    "nehmerId" TEXT NOT NULL,
    "typ" "VollmachtTyp" NOT NULL,
    "umfang" TEXT,
    "erteilungsdatum" TIMESTAMP(3),
    "beginn" TIMESTAMP(3),
    "ende" TIMESTAMP(3),
    "beschraenkungen" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vollmachten_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kontakt_dokumente" (
    "id" TEXT NOT NULL,
    "kontaktId" TEXT NOT NULL,
    "kategorie" "KontaktDokumentKategorie" NOT NULL DEFAULT 'SONSTIGE',
    "name" TEXT NOT NULL,
    "dateipfad" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "groesse" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kontakt_dokumente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kontakt_beziehungen" (
    "id" TEXT NOT NULL,
    "vonKontaktId" TEXT NOT NULL,
    "zuKontaktId" TEXT NOT NULL,
    "typ" "BeziehungTyp" NOT NULL,
    "beschreibung" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kontakt_beziehungen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "akten" (
    "id" TEXT NOT NULL,
    "aktenzeichen" TEXT NOT NULL,
    "kurzrubrum" TEXT NOT NULL,
    "wegen" TEXT,
    "sachgebiet" "Sachgebiet" NOT NULL DEFAULT 'SONSTIGES',
    "status" "AkteStatus" NOT NULL DEFAULT 'OFFEN',
    "gegenstandswert" DECIMAL(12,2),
    "falldaten" JSONB,
    "notizen" TEXT,
    "anwaltId" TEXT,
    "sachbearbeiterId" TEXT,
    "kanzleiId" TEXT,
    "angelegt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "geaendert" TIMESTAMP(3) NOT NULL,
    "archiviert" TIMESTAMP(3),

    CONSTRAINT "akten_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dezernate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "beschreibung" TEXT,
    "kanzleiId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dezernate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_overrides" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "akteId" TEXT NOT NULL,
    "grund" TEXT NOT NULL,
    "gueltigBis" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beteiligte" (
    "id" TEXT NOT NULL,
    "akteId" TEXT NOT NULL,
    "kontaktId" TEXT NOT NULL,
    "rolle" "BeteiligterRolle" NOT NULL,
    "notizen" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beteiligte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dokument_vorlagen" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "beschreibung" TEXT,
    "kategorie" "VorlageKategorie" NOT NULL DEFAULT 'SONSTIGES',
    "dateipfad" TEXT NOT NULL,
    "dateiname" TEXT NOT NULL,
    "groesse" INTEGER NOT NULL,
    "platzhalter" TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "tags" TEXT[],
    "freigegeben" BOOLEAN NOT NULL DEFAULT false,
    "freigegebenVonId" TEXT,
    "freigegebenAm" TIMESTAMP(3),
    "customFelder" JSONB,
    "favoritenVon" TEXT[],
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dokument_vorlagen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vorlage_versionen" (
    "id" TEXT NOT NULL,
    "vorlageId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "dateipfad" TEXT NOT NULL,
    "groesse" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vorlage_versionen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "briefkoepfe" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dateipfad" TEXT,
    "logoUrl" TEXT,
    "kanzleiName" TEXT,
    "adresse" TEXT,
    "telefon" TEXT,
    "fax" TEXT,
    "email" TEXT,
    "website" TEXT,
    "steuernr" TEXT,
    "ustIdNr" TEXT,
    "iban" TEXT,
    "bic" TEXT,
    "bankName" TEXT,
    "braoInfo" TEXT,
    "istStandard" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "briefkoepfe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordner_schemata" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sachgebiet" "Sachgebiet",
    "ordner" TEXT[],
    "istStandard" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ordner_schemata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dokumente" (
    "id" TEXT NOT NULL,
    "akteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dateipfad" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "groesse" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "ocrText" TEXT,
    "tags" TEXT[],
    "ordner" TEXT,
    "status" "DokumentStatus" NOT NULL DEFAULT 'ENTWURF',
    "erstelltDurch" TEXT,
    "freigegebenDurchId" TEXT,
    "freigegebenAm" TIMESTAMP(3),
    "ocrStatus" "OcrStatus" NOT NULL DEFAULT 'AUSSTEHEND',
    "ocrFehler" TEXT,
    "ocrVersuche" INTEGER NOT NULL DEFAULT 0,
    "ocrAbgeschlossen" TIMESTAMP(3),
    "previewPfad" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dokumente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dokument_versionen" (
    "id" TEXT NOT NULL,
    "dokumentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "dateipfad" TEXT NOT NULL,
    "groesse" INTEGER NOT NULL,
    "name" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dokument_versionen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_chunks" (
    "id" TEXT NOT NULL,
    "dokumentId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1024),
    "modelVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dokument_tag_kategorien" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "farbe" TEXT NOT NULL,
    "sortierung" INTEGER NOT NULL DEFAULT 0,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dokument_tag_kategorien_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kalender_eintraege" (
    "id" TEXT NOT NULL,
    "akteId" TEXT,
    "typ" "KalenderTyp" NOT NULL,
    "titel" TEXT NOT NULL,
    "beschreibung" TEXT,
    "datum" TIMESTAMP(3) NOT NULL,
    "datumBis" TIMESTAMP(3),
    "ganztaegig" BOOLEAN NOT NULL DEFAULT false,
    "erledigt" BOOLEAN NOT NULL DEFAULT false,
    "erledigtAm" TIMESTAMP(3),
    "verantwortlichId" TEXT NOT NULL,
    "fristablauf" TIMESTAMP(3),
    "vorfrist" TIMESTAMP(3),
    "prioritaet" "FristPrioritaet" NOT NULL DEFAULT 'NORMAL',
    "fristArt" TEXT,
    "bundesland" TEXT,
    "istNotfrist" BOOLEAN NOT NULL DEFAULT false,
    "quittiert" BOOLEAN NOT NULL DEFAULT false,
    "quittiertAm" TIMESTAMP(3),
    "quittiertVonId" TEXT,
    "erledigungsgrund" TEXT,
    "vorfristen" TIMESTAMP(3)[],
    "halbfrist" TIMESTAMP(3),
    "hauptfristId" TEXT,
    "sachbearbeiterId" TEXT,
    "serienId" TEXT,
    "serienRegel" TEXT,
    "dokumentIds" TEXT[],
    "sonderfall" TEXT,
    "fristHistorie" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kalender_eintraege_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "frist_presets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fristArt" TEXT NOT NULL,
    "dauerWochen" INTEGER,
    "dauerMonate" INTEGER,
    "dauerTage" INTEGER,
    "istNotfrist" BOOLEAN NOT NULL DEFAULT false,
    "defaultVorfristen" INTEGER[],
    "kategorie" TEXT NOT NULL,
    "beschreibung" TEXT,
    "rechtsgrundlage" TEXT,
    "sortierung" INTEGER NOT NULL DEFAULT 0,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "frist_presets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zeiterfassungen" (
    "id" TEXT NOT NULL,
    "akteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "datum" TIMESTAMP(3) NOT NULL,
    "dauer" INTEGER NOT NULL,
    "beschreibung" TEXT NOT NULL,
    "stundensatz" DECIMAL(8,2),
    "abrechenbar" BOOLEAN NOT NULL DEFAULT true,
    "startzeit" TIMESTAMP(3),
    "endzeit" TIMESTAMP(3),
    "isRunning" BOOLEAN NOT NULL DEFAULT false,
    "kategorie" TEXT,
    "abgerechnet" BOOLEAN NOT NULL DEFAULT false,
    "rechnungId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zeiterfassungen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rechnungen" (
    "id" TEXT NOT NULL,
    "akteId" TEXT NOT NULL,
    "rechnungsnummer" TEXT NOT NULL,
    "typ" "RechnungTyp" NOT NULL DEFAULT 'RVG',
    "status" "RechnungStatus" NOT NULL DEFAULT 'ENTWURF',
    "betragNetto" DECIMAL(12,2) NOT NULL,
    "mwstSatz" DECIMAL(5,2) NOT NULL DEFAULT 19,
    "betragBrutto" DECIMAL(12,2) NOT NULL,
    "rechnungsdatum" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "faelligAm" TIMESTAMP(3),
    "bezahltAm" TIMESTAMP(3),
    "positionen" JSONB NOT NULL,
    "notizen" TEXT,
    "empfaengerId" TEXT,
    "ustSummary" JSONB,
    "zahlungszielTage" INTEGER NOT NULL DEFAULT 14,
    "stornoVon" TEXT,
    "korrekturVon" TEXT,
    "dokumentId" TEXT,
    "mahnStufe" "MahnStufe",
    "mahnDatum" TIMESTAMP(3),
    "zustellart" TEXT DEFAULT 'EMAIL',
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "isPkh" BOOLEAN NOT NULL DEFAULT false,
    "rvgBerechnungId" TEXT,
    "restBetrag" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rechnungen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "akten_konto_buchungen" (
    "id" TEXT NOT NULL,
    "akteId" TEXT NOT NULL,
    "buchungstyp" "BuchungsTyp" NOT NULL,
    "betrag" DECIMAL(12,2) NOT NULL,
    "verwendungszweck" TEXT NOT NULL,
    "buchungsdatum" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "belegnummer" TEXT,
    "gebuchtVon" TEXT,
    "stornoVon" TEXT,
    "stornoGrund" TEXT,
    "rechnungId" TEXT,
    "bankTransaktionId" TEXT,
    "dokumentId" TEXT,
    "kostenstelle" TEXT,
    "konto" "KontoTyp" NOT NULL DEFAULT 'GESCHAEFT',
    "fremdgeldFrist" TIMESTAMP(3),
    "periodeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "akten_konto_buchungen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nummernkreise" (
    "id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "nummernkreise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teilzahlungen" (
    "id" TEXT NOT NULL,
    "rechnungId" TEXT NOT NULL,
    "betrag" DECIMAL(12,2) NOT NULL,
    "zahlungsdatum" TIMESTAMP(3) NOT NULL,
    "verwendungszweck" TEXT,
    "bankTransaktionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teilzahlungen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mahnungen" (
    "id" TEXT NOT NULL,
    "rechnungId" TEXT NOT NULL,
    "stufe" "MahnStufe" NOT NULL,
    "datum" TIMESTAMP(3) NOT NULL,
    "dokumentId" TEXT,
    "gesendetAm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mahnungen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_konten" (
    "id" TEXT NOT NULL,
    "kanzleiId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "iban" TEXT NOT NULL,
    "bic" TEXT,
    "typ" "KontoTyp" NOT NULL DEFAULT 'GESCHAEFT',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_konten_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_transaktionen" (
    "id" TEXT NOT NULL,
    "bankKontoId" TEXT NOT NULL,
    "buchungsdatum" TIMESTAMP(3) NOT NULL,
    "wertstellung" TIMESTAMP(3),
    "betrag" DECIMAL(12,2) NOT NULL,
    "verwendungszweck" TEXT NOT NULL,
    "absenderEmpfaenger" TEXT,
    "saldo" DECIMAL(12,2),
    "importHash" TEXT NOT NULL,
    "zugeordnet" BOOLEAN NOT NULL DEFAULT false,
    "rechnungId" TEXT,
    "akteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_transaktionen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rvg_berechnungen" (
    "id" TEXT NOT NULL,
    "akteId" TEXT,
    "userId" TEXT NOT NULL,
    "streitwert" DECIMAL(12,2) NOT NULL,
    "positionen" JSONB NOT NULL,
    "ergebnis" JSONB NOT NULL,
    "auftragseingang" TIMESTAMP(3),
    "tabelleVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rvg_berechnungen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buchungsperioden" (
    "id" TEXT NOT NULL,
    "kanzleiId" TEXT NOT NULL,
    "jahr" INTEGER NOT NULL,
    "monat" INTEGER NOT NULL,
    "status" "BuchungsperiodeStatus" NOT NULL DEFAULT 'OFFEN',
    "gesperrtVon" TEXT,
    "gesperrtAm" TIMESTAMP(3),

    CONSTRAINT "buchungsperioden_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kostenstellen" (
    "id" TEXT NOT NULL,
    "kanzleiId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "beschreibung" TEXT,
    "sachkonto" TEXT,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "kostenstellen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taetigkeitskategorien" (
    "id" TEXT NOT NULL,
    "kanzleiId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abrechenbar" BOOLEAN NOT NULL DEFAULT true,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "taetigkeitskategorien_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_invoice_templates" (
    "id" TEXT NOT NULL,
    "akteId" TEXT NOT NULL,
    "mandantId" TEXT,
    "empfaengerId" TEXT,
    "positionen" JSONB NOT NULL,
    "intervallMonate" INTEGER NOT NULL DEFAULT 1,
    "naechsteFaelligkeit" TIMESTAMP(3) NOT NULL,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_invoice_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finanz_einstellungen" (
    "id" TEXT NOT NULL,
    "kanzleiId" TEXT NOT NULL,
    "schluessel" TEXT NOT NULL,
    "wert" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finanz_einstellungen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bea_nachrichten" (
    "id" TEXT NOT NULL,
    "akteId" TEXT,
    "nachrichtenId" TEXT,
    "betreff" TEXT NOT NULL,
    "absender" TEXT NOT NULL,
    "empfaenger" TEXT NOT NULL,
    "inhalt" TEXT,
    "status" "BeaNachrichtStatus" NOT NULL DEFAULT 'EINGANG',
    "pruefprotokoll" JSONB,
    "anhaenge" JSONB,
    "gesendetAm" TIMESTAMP(3),
    "empfangenAm" TIMESTAMP(3),
    "eebStatus" TEXT,
    "eebDatum" TIMESTAMP(3),
    "xjustizData" JSONB,
    "safeIdAbsender" TEXT,
    "safeIdEmpfaenger" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bea_nachrichten_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_nachrichten" (
    "id" TEXT NOT NULL,
    "akteId" TEXT NOT NULL,
    "userId" TEXT,
    "nachricht" TEXT NOT NULL,
    "bezugDokumentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_nachrichten_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL,
    "akteId" TEXT,
    "userId" TEXT NOT NULL,
    "titel" TEXT,
    "messages" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_messages" (
    "id" TEXT NOT NULL,
    "messageId" TEXT,
    "akteId" TEXT,
    "beteiligterId" TEXT,
    "richtung" "EmailRichtung" NOT NULL DEFAULT 'EINGEHEND',
    "betreff" TEXT NOT NULL,
    "absender" TEXT NOT NULL,
    "absenderName" TEXT,
    "empfaenger" TEXT[],
    "cc" TEXT[],
    "inhalt" TEXT,
    "inhaltText" TEXT,
    "empfangenAm" TIMESTAMP(3),
    "gesendetAm" TIMESTAMP(3),
    "gelesen" BOOLEAN NOT NULL DEFAULT false,
    "veraktet" BOOLEAN NOT NULL DEFAULT false,
    "ticketId" TEXT,
    "anhangDokumentIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_konten" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emailAdresse" TEXT NOT NULL,
    "benutzername" TEXT NOT NULL,
    "passwortEnc" TEXT,
    "oauthTokens" JSONB,
    "authTyp" "EmailAuthTyp" NOT NULL DEFAULT 'PASSWORT',
    "imapHost" TEXT NOT NULL,
    "imapPort" INTEGER NOT NULL DEFAULT 993,
    "imapSecure" BOOLEAN NOT NULL DEFAULT true,
    "smtpHost" TEXT NOT NULL,
    "smtpPort" INTEGER NOT NULL DEFAULT 587,
    "smtpSecure" BOOLEAN NOT NULL DEFAULT false,
    "istKanzlei" BOOLEAN NOT NULL DEFAULT false,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "initialSync" "EmailInitialSync" NOT NULL DEFAULT 'DREISSIG_TAGE',
    "syncStatus" "EmailSyncStatus" NOT NULL DEFAULT 'GETRENNT',
    "letzterSync" TIMESTAMP(3),
    "fehlerLog" JSONB,
    "softDeleteTage" INTEGER NOT NULL DEFAULT 30,
    "signaturVorlage" TEXT,
    "signaturPlaceholders" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_konten_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_konto_zuweisungen" (
    "id" TEXT NOT NULL,
    "kontoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_konto_zuweisungen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_ordner" (
    "id" TEXT NOT NULL,
    "kontoId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pfad" TEXT NOT NULL,
    "spezialTyp" "EmailSpezialTyp" NOT NULL DEFAULT 'CUSTOM',
    "ungeleseneAnzahl" INTEGER NOT NULL DEFAULT 0,
    "gesamtAnzahl" INTEGER NOT NULL DEFAULT 0,
    "sortierung" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_ordner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_nachrichten" (
    "id" TEXT NOT NULL,
    "emailKontoId" TEXT NOT NULL,
    "emailOrdnerId" TEXT,
    "imapUid" INTEGER,
    "imapFolder" TEXT,
    "messageId" TEXT,
    "inReplyTo" TEXT,
    "references" TEXT[],
    "threadId" TEXT,
    "richtung" "EmailRichtung" NOT NULL DEFAULT 'EINGEHEND',
    "betreff" TEXT NOT NULL,
    "absender" TEXT NOT NULL,
    "absenderName" TEXT,
    "empfaenger" TEXT[],
    "cc" TEXT[],
    "bcc" TEXT[],
    "inhalt" TEXT,
    "inhaltText" TEXT,
    "empfangenAm" TIMESTAMP(3),
    "gesendetAm" TIMESTAMP(3),
    "gelesen" BOOLEAN NOT NULL DEFAULT false,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "prioritaet" "EmailPrioritaet" NOT NULL DEFAULT 'NORMAL',
    "groesse" INTEGER,
    "veraktet" BOOLEAN NOT NULL DEFAULT false,
    "verantwortlichId" TEXT,
    "geloescht" BOOLEAN NOT NULL DEFAULT false,
    "geloeschtAm" TIMESTAMP(3),
    "sendeStatus" "EmailSendeStatus",
    "geplanterVersand" TIMESTAMP(3),
    "sendeFehler" TEXT,
    "ticketId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_nachrichten_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_anhaenge" (
    "id" TEXT NOT NULL,
    "emailNachrichtId" TEXT NOT NULL,
    "dateiname" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "groesse" INTEGER NOT NULL,
    "speicherPfad" TEXT NOT NULL,
    "contentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_anhaenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_veraktungen" (
    "id" TEXT NOT NULL,
    "emailNachrichtId" TEXT NOT NULL,
    "akteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notiz" TEXT,
    "anhaengeKopiert" BOOLEAN NOT NULL DEFAULT false,
    "dmsOrdner" TEXT,
    "aufgehoben" BOOLEAN NOT NULL DEFAULT false,
    "aufgehobenAm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_veraktungen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "akteId" TEXT,
    "titel" TEXT NOT NULL,
    "beschreibung" TEXT,
    "status" "TicketStatus" NOT NULL DEFAULT 'OFFEN',
    "prioritaet" "TicketPrioritaet" NOT NULL DEFAULT 'NORMAL',
    "faelligAm" TIMESTAMP(3),
    "verantwortlichId" TEXT,
    "tags" TEXT[],
    "erledigtAm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "aiLockedAt" TIMESTAMP(3),
    "aiLockedBy" TEXT,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "akteId" TEXT,
    "aktion" TEXT NOT NULL,
    "details" JSONB,
    "ipAdresse" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "soundType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'string',
    "category" TEXT NOT NULL DEFAULT 'general',
    "label" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_usages" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "akteId" TEXT,
    "funktion" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "tokensIn" INTEGER NOT NULL,
    "tokensOut" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "helena_suggestions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "akteId" TEXT,
    "dokumentId" TEXT,
    "emailId" TEXT,
    "typ" TEXT NOT NULL,
    "titel" TEXT NOT NULL,
    "inhalt" TEXT NOT NULL,
    "quellen" JSONB,
    "status" TEXT NOT NULL DEFAULT 'NEU',
    "feedback" TEXT,
    "linkedId" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "errorMsg" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "helena_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_DezernatAkten" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_DezernatMitglieder" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "urlaub_zeitraeume_userId_idx" ON "urlaub_zeitraeume"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE INDEX "kontakte_nachname_vorname_idx" ON "kontakte"("nachname", "vorname");

-- CreateIndex
CREATE INDEX "kontakte_firma_idx" ON "kontakte"("firma");

-- CreateIndex
CREATE INDEX "kontakte_mandantennummer_idx" ON "kontakte"("mandantennummer");

-- CreateIndex
CREATE INDEX "kontakte_ustIdNr_idx" ON "kontakte"("ustIdNr");

-- CreateIndex
CREATE UNIQUE INDEX "kontakt_feld_definitionen_key_key" ON "kontakt_feld_definitionen"("key");

-- CreateIndex
CREATE INDEX "adressen_kontaktId_idx" ON "adressen"("kontaktId");

-- CreateIndex
CREATE INDEX "identitaets_pruefungen_kontaktId_idx" ON "identitaets_pruefungen"("kontaktId");

-- CreateIndex
CREATE INDEX "vollmachten_geberId_idx" ON "vollmachten"("geberId");

-- CreateIndex
CREATE INDEX "vollmachten_nehmerId_idx" ON "vollmachten"("nehmerId");

-- CreateIndex
CREATE INDEX "kontakt_dokumente_kontaktId_idx" ON "kontakt_dokumente"("kontaktId");

-- CreateIndex
CREATE INDEX "kontakt_beziehungen_vonKontaktId_idx" ON "kontakt_beziehungen"("vonKontaktId");

-- CreateIndex
CREATE INDEX "kontakt_beziehungen_zuKontaktId_idx" ON "kontakt_beziehungen"("zuKontaktId");

-- CreateIndex
CREATE UNIQUE INDEX "kontakt_beziehungen_vonKontaktId_zuKontaktId_typ_key" ON "kontakt_beziehungen"("vonKontaktId", "zuKontaktId", "typ");

-- CreateIndex
CREATE UNIQUE INDEX "akten_aktenzeichen_key" ON "akten"("aktenzeichen");

-- CreateIndex
CREATE INDEX "akten_status_idx" ON "akten"("status");

-- CreateIndex
CREATE INDEX "akten_anwaltId_idx" ON "akten"("anwaltId");

-- CreateIndex
CREATE INDEX "akten_sachgebiet_idx" ON "akten"("sachgebiet");

-- CreateIndex
CREATE INDEX "admin_overrides_akteId_idx" ON "admin_overrides"("akteId");

-- CreateIndex
CREATE UNIQUE INDEX "admin_overrides_adminId_akteId_key" ON "admin_overrides"("adminId", "akteId");

-- CreateIndex
CREATE UNIQUE INDEX "beteiligte_akteId_kontaktId_rolle_key" ON "beteiligte"("akteId", "kontaktId", "rolle");

-- CreateIndex
CREATE INDEX "dokument_vorlagen_kategorie_idx" ON "dokument_vorlagen"("kategorie");

-- CreateIndex
CREATE INDEX "dokument_vorlagen_freigegeben_idx" ON "dokument_vorlagen"("freigegeben");

-- CreateIndex
CREATE INDEX "vorlage_versionen_vorlageId_idx" ON "vorlage_versionen"("vorlageId");

-- CreateIndex
CREATE UNIQUE INDEX "vorlage_versionen_vorlageId_version_key" ON "vorlage_versionen"("vorlageId", "version");

-- CreateIndex
CREATE INDEX "dokumente_akteId_idx" ON "dokumente"("akteId");

-- CreateIndex
CREATE INDEX "dokumente_name_idx" ON "dokumente"("name");

-- CreateIndex
CREATE INDEX "dokumente_status_idx" ON "dokumente"("status");

-- CreateIndex
CREATE INDEX "dokumente_ocrStatus_idx" ON "dokumente"("ocrStatus");

-- CreateIndex
CREATE INDEX "dokument_versionen_dokumentId_idx" ON "dokument_versionen"("dokumentId");

-- CreateIndex
CREATE UNIQUE INDEX "dokument_versionen_dokumentId_version_key" ON "dokument_versionen"("dokumentId", "version");

-- CreateIndex
CREATE INDEX "document_chunks_dokumentId_idx" ON "document_chunks"("dokumentId");

-- CreateIndex
CREATE UNIQUE INDEX "document_chunks_dokumentId_chunkIndex_key" ON "document_chunks"("dokumentId", "chunkIndex");

-- CreateIndex
CREATE UNIQUE INDEX "dokument_tag_kategorien_name_key" ON "dokument_tag_kategorien"("name");

-- CreateIndex
CREATE INDEX "kalender_eintraege_datum_idx" ON "kalender_eintraege"("datum");

-- CreateIndex
CREATE INDEX "kalender_eintraege_verantwortlichId_idx" ON "kalender_eintraege"("verantwortlichId");

-- CreateIndex
CREATE INDEX "kalender_eintraege_sachbearbeiterId_idx" ON "kalender_eintraege"("sachbearbeiterId");

-- CreateIndex
CREATE INDEX "kalender_eintraege_erledigt_idx" ON "kalender_eintraege"("erledigt");

-- CreateIndex
CREATE INDEX "kalender_eintraege_prioritaet_idx" ON "kalender_eintraege"("prioritaet");

-- CreateIndex
CREATE INDEX "kalender_eintraege_istNotfrist_idx" ON "kalender_eintraege"("istNotfrist");

-- CreateIndex
CREATE INDEX "kalender_eintraege_hauptfristId_idx" ON "kalender_eintraege"("hauptfristId");

-- CreateIndex
CREATE INDEX "frist_presets_kategorie_idx" ON "frist_presets"("kategorie");

-- CreateIndex
CREATE INDEX "frist_presets_aktiv_idx" ON "frist_presets"("aktiv");

-- CreateIndex
CREATE INDEX "zeiterfassungen_akteId_idx" ON "zeiterfassungen"("akteId");

-- CreateIndex
CREATE INDEX "zeiterfassungen_userId_idx" ON "zeiterfassungen"("userId");

-- CreateIndex
CREATE INDEX "zeiterfassungen_isRunning_idx" ON "zeiterfassungen"("isRunning");

-- CreateIndex
CREATE UNIQUE INDEX "rechnungen_rechnungsnummer_key" ON "rechnungen"("rechnungsnummer");

-- CreateIndex
CREATE INDEX "rechnungen_akteId_idx" ON "rechnungen"("akteId");

-- CreateIndex
CREATE INDEX "rechnungen_status_idx" ON "rechnungen"("status");

-- CreateIndex
CREATE INDEX "rechnungen_empfaengerId_idx" ON "rechnungen"("empfaengerId");

-- CreateIndex
CREATE INDEX "akten_konto_buchungen_akteId_idx" ON "akten_konto_buchungen"("akteId");

-- CreateIndex
CREATE INDEX "akten_konto_buchungen_buchungsdatum_idx" ON "akten_konto_buchungen"("buchungsdatum");

-- CreateIndex
CREATE INDEX "akten_konto_buchungen_rechnungId_idx" ON "akten_konto_buchungen"("rechnungId");

-- CreateIndex
CREATE UNIQUE INDEX "nummernkreise_prefix_year_key" ON "nummernkreise"("prefix", "year");

-- CreateIndex
CREATE INDEX "teilzahlungen_rechnungId_idx" ON "teilzahlungen"("rechnungId");

-- CreateIndex
CREATE INDEX "mahnungen_rechnungId_idx" ON "mahnungen"("rechnungId");

-- CreateIndex
CREATE UNIQUE INDEX "bank_konten_iban_key" ON "bank_konten"("iban");

-- CreateIndex
CREATE UNIQUE INDEX "bank_transaktionen_importHash_key" ON "bank_transaktionen"("importHash");

-- CreateIndex
CREATE INDEX "bank_transaktionen_bankKontoId_idx" ON "bank_transaktionen"("bankKontoId");

-- CreateIndex
CREATE INDEX "bank_transaktionen_buchungsdatum_idx" ON "bank_transaktionen"("buchungsdatum");

-- CreateIndex
CREATE INDEX "rvg_berechnungen_akteId_idx" ON "rvg_berechnungen"("akteId");

-- CreateIndex
CREATE INDEX "rvg_berechnungen_userId_idx" ON "rvg_berechnungen"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "buchungsperioden_kanzleiId_jahr_monat_key" ON "buchungsperioden"("kanzleiId", "jahr", "monat");

-- CreateIndex
CREATE UNIQUE INDEX "finanz_einstellungen_kanzleiId_schluessel_key" ON "finanz_einstellungen"("kanzleiId", "schluessel");

-- CreateIndex
CREATE UNIQUE INDEX "bea_nachrichten_nachrichtenId_key" ON "bea_nachrichten"("nachrichtenId");

-- CreateIndex
CREATE INDEX "bea_nachrichten_akteId_idx" ON "bea_nachrichten"("akteId");

-- CreateIndex
CREATE INDEX "bea_nachrichten_safeIdAbsender_idx" ON "bea_nachrichten"("safeIdAbsender");

-- CreateIndex
CREATE INDEX "chat_nachrichten_akteId_idx" ON "chat_nachrichten"("akteId");

-- CreateIndex
CREATE INDEX "ai_conversations_akteId_idx" ON "ai_conversations"("akteId");

-- CreateIndex
CREATE INDEX "ai_conversations_userId_idx" ON "ai_conversations"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "email_messages_messageId_key" ON "email_messages"("messageId");

-- CreateIndex
CREATE INDEX "email_messages_akteId_idx" ON "email_messages"("akteId");

-- CreateIndex
CREATE INDEX "email_messages_empfangenAm_idx" ON "email_messages"("empfangenAm");

-- CreateIndex
CREATE INDEX "email_messages_veraktet_idx" ON "email_messages"("veraktet");

-- CreateIndex
CREATE INDEX "email_messages_gelesen_idx" ON "email_messages"("gelesen");

-- CreateIndex
CREATE INDEX "email_konten_aktiv_idx" ON "email_konten"("aktiv");

-- CreateIndex
CREATE INDEX "email_konten_emailAdresse_idx" ON "email_konten"("emailAdresse");

-- CreateIndex
CREATE INDEX "email_konto_zuweisungen_userId_idx" ON "email_konto_zuweisungen"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "email_konto_zuweisungen_kontoId_userId_key" ON "email_konto_zuweisungen"("kontoId", "userId");

-- CreateIndex
CREATE INDEX "email_ordner_kontoId_idx" ON "email_ordner"("kontoId");

-- CreateIndex
CREATE UNIQUE INDEX "email_ordner_kontoId_pfad_key" ON "email_ordner"("kontoId", "pfad");

-- CreateIndex
CREATE UNIQUE INDEX "email_nachrichten_messageId_key" ON "email_nachrichten"("messageId");

-- CreateIndex
CREATE INDEX "email_nachrichten_emailKontoId_idx" ON "email_nachrichten"("emailKontoId");

-- CreateIndex
CREATE INDEX "email_nachrichten_emailOrdnerId_idx" ON "email_nachrichten"("emailOrdnerId");

-- CreateIndex
CREATE INDEX "email_nachrichten_threadId_idx" ON "email_nachrichten"("threadId");

-- CreateIndex
CREATE INDEX "email_nachrichten_empfangenAm_idx" ON "email_nachrichten"("empfangenAm");

-- CreateIndex
CREATE INDEX "email_nachrichten_gelesen_idx" ON "email_nachrichten"("gelesen");

-- CreateIndex
CREATE INDEX "email_nachrichten_veraktet_idx" ON "email_nachrichten"("veraktet");

-- CreateIndex
CREATE INDEX "email_nachrichten_geloescht_idx" ON "email_nachrichten"("geloescht");

-- CreateIndex
CREATE INDEX "email_nachrichten_verantwortlichId_idx" ON "email_nachrichten"("verantwortlichId");

-- CreateIndex
CREATE INDEX "email_nachrichten_sendeStatus_idx" ON "email_nachrichten"("sendeStatus");

-- CreateIndex
CREATE INDEX "email_nachrichten_absender_idx" ON "email_nachrichten"("absender");

-- CreateIndex
CREATE INDEX "email_anhaenge_emailNachrichtId_idx" ON "email_anhaenge"("emailNachrichtId");

-- CreateIndex
CREATE INDEX "email_veraktungen_emailNachrichtId_idx" ON "email_veraktungen"("emailNachrichtId");

-- CreateIndex
CREATE INDEX "email_veraktungen_akteId_idx" ON "email_veraktungen"("akteId");

-- CreateIndex
CREATE INDEX "email_veraktungen_userId_idx" ON "email_veraktungen"("userId");

-- CreateIndex
CREATE INDEX "tickets_akteId_idx" ON "tickets"("akteId");

-- CreateIndex
CREATE INDEX "tickets_verantwortlichId_idx" ON "tickets"("verantwortlichId");

-- CreateIndex
CREATE INDEX "tickets_status_idx" ON "tickets"("status");

-- CreateIndex
CREATE INDEX "tickets_faelligAm_idx" ON "tickets"("faelligAm");

-- CreateIndex
CREATE INDEX "audit_logs_akteId_idx" ON "audit_logs"("akteId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_read_idx" ON "notifications"("userId", "read");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- CreateIndex
CREATE INDEX "system_settings_category_idx" ON "system_settings"("category");

-- CreateIndex
CREATE INDEX "token_usages_userId_createdAt_idx" ON "token_usages"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "token_usages_createdAt_idx" ON "token_usages"("createdAt");

-- CreateIndex
CREATE INDEX "helena_suggestions_userId_status_createdAt_idx" ON "helena_suggestions"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "helena_suggestions_akteId_typ_createdAt_idx" ON "helena_suggestions"("akteId", "typ", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "_DezernatAkten_AB_unique" ON "_DezernatAkten"("A", "B");

-- CreateIndex
CREATE INDEX "_DezernatAkten_B_index" ON "_DezernatAkten"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_DezernatMitglieder_AB_unique" ON "_DezernatMitglieder"("A", "B");

-- CreateIndex
CREATE INDEX "_DezernatMitglieder_B_index" ON "_DezernatMitglieder"("B");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_kanzleiId_fkey" FOREIGN KEY ("kanzleiId") REFERENCES "kanzleien"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_vertreterId_fkey" FOREIGN KEY ("vertreterId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "urlaub_zeitraeume" ADD CONSTRAINT "urlaub_zeitraeume_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adressen" ADD CONSTRAINT "adressen_kontaktId_fkey" FOREIGN KEY ("kontaktId") REFERENCES "kontakte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identitaets_pruefungen" ADD CONSTRAINT "identitaets_pruefungen_kontaktId_fkey" FOREIGN KEY ("kontaktId") REFERENCES "kontakte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vollmachten" ADD CONSTRAINT "vollmachten_geberId_fkey" FOREIGN KEY ("geberId") REFERENCES "kontakte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vollmachten" ADD CONSTRAINT "vollmachten_nehmerId_fkey" FOREIGN KEY ("nehmerId") REFERENCES "kontakte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kontakt_dokumente" ADD CONSTRAINT "kontakt_dokumente_kontaktId_fkey" FOREIGN KEY ("kontaktId") REFERENCES "kontakte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kontakt_beziehungen" ADD CONSTRAINT "kontakt_beziehungen_vonKontaktId_fkey" FOREIGN KEY ("vonKontaktId") REFERENCES "kontakte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kontakt_beziehungen" ADD CONSTRAINT "kontakt_beziehungen_zuKontaktId_fkey" FOREIGN KEY ("zuKontaktId") REFERENCES "kontakte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "akten" ADD CONSTRAINT "akten_anwaltId_fkey" FOREIGN KEY ("anwaltId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "akten" ADD CONSTRAINT "akten_sachbearbeiterId_fkey" FOREIGN KEY ("sachbearbeiterId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "akten" ADD CONSTRAINT "akten_kanzleiId_fkey" FOREIGN KEY ("kanzleiId") REFERENCES "kanzleien"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dezernate" ADD CONSTRAINT "dezernate_kanzleiId_fkey" FOREIGN KEY ("kanzleiId") REFERENCES "kanzleien"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_overrides" ADD CONSTRAINT "admin_overrides_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_overrides" ADD CONSTRAINT "admin_overrides_akteId_fkey" FOREIGN KEY ("akteId") REFERENCES "akten"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beteiligte" ADD CONSTRAINT "beteiligte_akteId_fkey" FOREIGN KEY ("akteId") REFERENCES "akten"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beteiligte" ADD CONSTRAINT "beteiligte_kontaktId_fkey" FOREIGN KEY ("kontaktId") REFERENCES "kontakte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dokument_vorlagen" ADD CONSTRAINT "dokument_vorlagen_freigegebenVonId_fkey" FOREIGN KEY ("freigegebenVonId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dokument_vorlagen" ADD CONSTRAINT "dokument_vorlagen_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vorlage_versionen" ADD CONSTRAINT "vorlage_versionen_vorlageId_fkey" FOREIGN KEY ("vorlageId") REFERENCES "dokument_vorlagen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vorlage_versionen" ADD CONSTRAINT "vorlage_versionen_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dokumente" ADD CONSTRAINT "dokumente_akteId_fkey" FOREIGN KEY ("akteId") REFERENCES "akten"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dokumente" ADD CONSTRAINT "dokumente_freigegebenDurchId_fkey" FOREIGN KEY ("freigegebenDurchId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dokumente" ADD CONSTRAINT "dokumente_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dokument_versionen" ADD CONSTRAINT "dokument_versionen_dokumentId_fkey" FOREIGN KEY ("dokumentId") REFERENCES "dokumente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dokument_versionen" ADD CONSTRAINT "dokument_versionen_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_dokumentId_fkey" FOREIGN KEY ("dokumentId") REFERENCES "dokumente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kalender_eintraege" ADD CONSTRAINT "kalender_eintraege_akteId_fkey" FOREIGN KEY ("akteId") REFERENCES "akten"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kalender_eintraege" ADD CONSTRAINT "kalender_eintraege_verantwortlichId_fkey" FOREIGN KEY ("verantwortlichId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kalender_eintraege" ADD CONSTRAINT "kalender_eintraege_quittiertVonId_fkey" FOREIGN KEY ("quittiertVonId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kalender_eintraege" ADD CONSTRAINT "kalender_eintraege_hauptfristId_fkey" FOREIGN KEY ("hauptfristId") REFERENCES "kalender_eintraege"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kalender_eintraege" ADD CONSTRAINT "kalender_eintraege_sachbearbeiterId_fkey" FOREIGN KEY ("sachbearbeiterId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zeiterfassungen" ADD CONSTRAINT "zeiterfassungen_akteId_fkey" FOREIGN KEY ("akteId") REFERENCES "akten"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zeiterfassungen" ADD CONSTRAINT "zeiterfassungen_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rechnungen" ADD CONSTRAINT "rechnungen_akteId_fkey" FOREIGN KEY ("akteId") REFERENCES "akten"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "akten_konto_buchungen" ADD CONSTRAINT "akten_konto_buchungen_akteId_fkey" FOREIGN KEY ("akteId") REFERENCES "akten"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teilzahlungen" ADD CONSTRAINT "teilzahlungen_rechnungId_fkey" FOREIGN KEY ("rechnungId") REFERENCES "rechnungen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mahnungen" ADD CONSTRAINT "mahnungen_rechnungId_fkey" FOREIGN KEY ("rechnungId") REFERENCES "rechnungen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_konten" ADD CONSTRAINT "bank_konten_kanzleiId_fkey" FOREIGN KEY ("kanzleiId") REFERENCES "kanzleien"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transaktionen" ADD CONSTRAINT "bank_transaktionen_bankKontoId_fkey" FOREIGN KEY ("bankKontoId") REFERENCES "bank_konten"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buchungsperioden" ADD CONSTRAINT "buchungsperioden_kanzleiId_fkey" FOREIGN KEY ("kanzleiId") REFERENCES "kanzleien"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kostenstellen" ADD CONSTRAINT "kostenstellen_kanzleiId_fkey" FOREIGN KEY ("kanzleiId") REFERENCES "kanzleien"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taetigkeitskategorien" ADD CONSTRAINT "taetigkeitskategorien_kanzleiId_fkey" FOREIGN KEY ("kanzleiId") REFERENCES "kanzleien"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finanz_einstellungen" ADD CONSTRAINT "finanz_einstellungen_kanzleiId_fkey" FOREIGN KEY ("kanzleiId") REFERENCES "kanzleien"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bea_nachrichten" ADD CONSTRAINT "bea_nachrichten_akteId_fkey" FOREIGN KEY ("akteId") REFERENCES "akten"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_nachrichten" ADD CONSTRAINT "chat_nachrichten_akteId_fkey" FOREIGN KEY ("akteId") REFERENCES "akten"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_nachrichten" ADD CONSTRAINT "chat_nachrichten_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_nachrichten" ADD CONSTRAINT "chat_nachrichten_bezugDokumentId_fkey" FOREIGN KEY ("bezugDokumentId") REFERENCES "dokumente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_akteId_fkey" FOREIGN KEY ("akteId") REFERENCES "akten"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_akteId_fkey" FOREIGN KEY ("akteId") REFERENCES "akten"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_beteiligterId_fkey" FOREIGN KEY ("beteiligterId") REFERENCES "beteiligte"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_konto_zuweisungen" ADD CONSTRAINT "email_konto_zuweisungen_kontoId_fkey" FOREIGN KEY ("kontoId") REFERENCES "email_konten"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_konto_zuweisungen" ADD CONSTRAINT "email_konto_zuweisungen_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_ordner" ADD CONSTRAINT "email_ordner_kontoId_fkey" FOREIGN KEY ("kontoId") REFERENCES "email_konten"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_nachrichten" ADD CONSTRAINT "email_nachrichten_emailKontoId_fkey" FOREIGN KEY ("emailKontoId") REFERENCES "email_konten"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_nachrichten" ADD CONSTRAINT "email_nachrichten_emailOrdnerId_fkey" FOREIGN KEY ("emailOrdnerId") REFERENCES "email_ordner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_nachrichten" ADD CONSTRAINT "email_nachrichten_verantwortlichId_fkey" FOREIGN KEY ("verantwortlichId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_nachrichten" ADD CONSTRAINT "email_nachrichten_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_anhaenge" ADD CONSTRAINT "email_anhaenge_emailNachrichtId_fkey" FOREIGN KEY ("emailNachrichtId") REFERENCES "email_nachrichten"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_veraktungen" ADD CONSTRAINT "email_veraktungen_emailNachrichtId_fkey" FOREIGN KEY ("emailNachrichtId") REFERENCES "email_nachrichten"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_veraktungen" ADD CONSTRAINT "email_veraktungen_akteId_fkey" FOREIGN KEY ("akteId") REFERENCES "akten"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_veraktungen" ADD CONSTRAINT "email_veraktungen_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_akteId_fkey" FOREIGN KEY ("akteId") REFERENCES "akten"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_verantwortlichId_fkey" FOREIGN KEY ("verantwortlichId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_akteId_fkey" FOREIGN KEY ("akteId") REFERENCES "akten"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_usages" ADD CONSTRAINT "token_usages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_usages" ADD CONSTRAINT "token_usages_akteId_fkey" FOREIGN KEY ("akteId") REFERENCES "akten"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "helena_suggestions" ADD CONSTRAINT "helena_suggestions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "helena_suggestions" ADD CONSTRAINT "helena_suggestions_akteId_fkey" FOREIGN KEY ("akteId") REFERENCES "akten"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DezernatAkten" ADD CONSTRAINT "_DezernatAkten_A_fkey" FOREIGN KEY ("A") REFERENCES "akten"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DezernatAkten" ADD CONSTRAINT "_DezernatAkten_B_fkey" FOREIGN KEY ("B") REFERENCES "dezernate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DezernatMitglieder" ADD CONSTRAINT "_DezernatMitglieder_A_fkey" FOREIGN KEY ("A") REFERENCES "dezernate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DezernatMitglieder" ADD CONSTRAINT "_DezernatMitglieder_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
