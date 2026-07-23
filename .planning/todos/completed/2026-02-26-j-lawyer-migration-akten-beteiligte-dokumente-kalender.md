---
created: 2026-02-26T22:43:47.239Z
title: J-Lawyer Migration — Akten, Beteiligte, Dokumente, Kalender
area: api
files:
  - prisma/schema.prisma
  - src/lib/queue/processors/
  - src/app/api/
---

## Problem

Die Kanzlei betreibt aktuell J-Lawyer als Praxisverwaltungssystem. Beim Wechsel zu AI-Lawyer müssen alle bestehenden Daten vollständig übernommen werden:
- Alle Akten mit Metadaten, Aktenzeichen, Bezeichnungen, Zuständigkeiten
- Alle Beteiligte mit sämtlichen Feldern und ihren Rollen je Akte
- Alle Dokumente (Binärdaten) → von J-Lawyer-internem Speicher nach MinIO
- Alle Kalendereinträge, Fristen, Wiedervorlagen, Termine
- Zeiterfassung, Tags, Aktenhistorie

Ohne vollständige Migration ist ein produktiver Wechsel nicht möglich.

## Solution

### Datenstrategie: J-Lawyer REST API → ETL → AI-Lawyer

J-Lawyer bietet eine vollständige REST API (ab v1.12+) mit Swagger-Dokumentation:
```
http://[j-lawyer-ip]:8080/j-lawyer-io/swagger-ui/
```

Migration erfolgt einmalig per ETL-Skript (Node.js), kein Live-Sync erforderlich.

---

### Vorbereitungsschritt: Swagger-API analysieren

**Vor der Implementierung:** Swagger-UI der laufenden J-Lawyer-Instanz aufrufen und prüfen:
- Welche Felder liefern Beteiligte (Custom Fields vollständig?)
- Wie werden Dokument-Binärdaten zurückgegeben (Base64 im JSON oder separater Download-Endpoint?)
- Gibt es einen Bulk-Export-Endpoint oder nur Einzelabrufe?
- Sind historische Einträge (Aktenhistorie) exportierbar?

---

### Entity-Mapping

| J-Lawyer | AI-Lawyer Prisma | Besonderheiten |
|---|---|---|
| Akte | `Akte` | Aktenzeichen, Bezeichnung, Sachgebiet, Verantwortlicher, Status |
| Adresse (Adressbuch) | `Kontakt` | Zentrale Adressbasis — kann in mehreren Akten vorkommen; dedup by email/name |
| Beteiligter (Akte + Adresse + Charakter) | `Beteiligter` | Adresse FK + Rolle/Charakter je Akte |
| Dokument (Metadaten + Binary) | `Dokument` + MinIO | Binary: API-Download → MinIO-Upload; Metadaten in DB |
| Frist/Termin/Wiedervorlage | `Frist` / `Termin` | Typen mappen; Wiedervorlage = eigene Flag/Typ |
| Zeiterfassung | `Zeiterfassung` | Falls im Prisma-Schema vorhanden |
| Tag/Label | Tags | Direkt mappbar |
| Aktenhistorie | `AktenHistorie` | Automatische + manuelle Einträge |
| Custom Fields (Falldatenblätter) | JSONB-Feld oder strukturierte Felder | Mapping-Entscheidung ausstehend (siehe Todo Falldatenblätter) |

---

### ETL-Skript-Architektur

`scripts/migrate-jlawyer.ts` (einmalig ausführbar, idempotent):

```
1. Verbindung zur J-Lawyer API (API-Key oder Basic Auth)
2. Kontakte/Adressen exportieren → in AI-Lawyer Kontakte importieren (dedup by hash)
3. Akten exportieren → in AI-Lawyer Akten importieren
4. Beteiligte je Akte → Kontakt FK auflösen + Rolle mappen
5. Dokumente: Metadaten + Binary downloaden → MinIO hochladen → DB-Eintrag
6. Fristen/Termine exportieren → in AI-Lawyer importieren
7. Zeiterfassung exportieren (falls vorhanden)
8. Tags exportieren
9. Aktenhistorie exportieren
10. Abschlussbericht: X Akten, Y Kontakte, Z Dokumente migriert, N Fehler
```

**Idempotenz:** Jeder Datensatz bekommt `jlawyer_id` als externe Referenz-Spalte — Re-Run überschreibt statt zu duplizieren.

---

### Dokumente-Migration (kritischer Pfad)

J-Lawyer speichert Dokumente intern. Migrationspfad:
1. Dokument-Endpoint aufrufen → Binary (Base64 oder Stream)
2. In MinIO hochladen (Bucket: `akten-dokumente/[akte-id]/`)
3. MinIO-URL + Metadaten in `Dokument`-Tabelle speichern
4. Große Dateien: Streaming statt im Memory laden

---

### Beteiligte-Felder (vollständige Übernahme)

Sobald Swagger-Analyse abgeschlossen, alle verfügbaren Felder aus J-Lawyer-Adressbuch mappen:
- Name, Vorname, Firma, Anrede, Titel
- Straße, PLZ, Ort, Land
- Telefon(e), Fax, Mobil, E-Mail(s)
- IBAN, BIC, USt-IdNr.
- Notizen, Custom Fields
- Rolle je Akte (Mandant, Gegner, Gericht, Anwalt Gegenseite, etc.)

Falls J-Lawyer-Felder kein Pendant im Prisma-Schema haben → `zusatz_felder JSONB` als Auffangbecken.

---

### Migrations-UI (optional, nach ETL)

Einfache Admin-Seite `/admin/migration`:
- Status-Anzeige (laufend / abgeschlossen / Fehler)
- Fortschrittsbalken (Akten X/Y, Dokumente X/Y)
- Fehler-Log mit Download
- "Re-Run für Fehler"-Button

---

### Offene Klärungspunkte (vor Implementierung)

1. **Swagger-API prüfen**: Sind wirklich alle Felder verfügbar? (5-Minuten-Check auf laufender J-Lawyer-Instanz)
2. **Custom Fields**: Wie viele hat die Kanzlei, welche sind kritisch?
3. **Parallelphase**: Soll J-Lawyer nach Migration noch parallel laufen? → Dann kein Löschen, sondern "migriert"-Flag
4. **Dokumentenvolumen**: Wie viele GB Dokumente sind zu migrieren? Bestimmt ob Streaming/Batching nötig
5. **Authentifizierung**: Welcher Auth-Mechanismus ist bei der J-Lawyer-Instanz aktiv?
