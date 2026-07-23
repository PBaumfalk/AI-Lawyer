---
created: 2026-02-26T22:12:27.161Z
title: Arbeitswissen-RAG für Helena — Formulare, Muster, Kosten, ERV
area: api
files:
  - src/lib/embedding/embedder.ts
  - src/lib/embedding/chunker.ts
  - src/lib/embedding/vector-store.ts
  - src/app/api/ki-chat/route.ts
  - src/lib/queue/processors/
  - prisma/schema.prisma
  - src/app/(app)/akten/[id]/
---

## Problem

Helena kennt Gesetze (todo) und Urteile (todo), hat aber kein "Handwerkswissen": keine Verfahrenslogik, keine Kostenregeln, keine ausfüllbaren Schriftsatzmuster, keine ERV/beA-Formvorschriften. Das bedeutet, sie kann Recht benennen, aber keine praxistauglichen Schriftsatzentwürfe produzieren.

Drei Lücken im Konkreten:
1. **Keine Formulare/Muster** — Helena kann keinen Klage-Baukasten für KSchG-Klage, Mahnantrag oder einstweilige Verfügung ausgeben
2. **Kein Kostenwissen** — GKG-Streitwert, RVG-Gebühren, PKH/VKH-Logik sind nicht als Rechenregeln verfügbar
3. **Keine ERV/beA-Regeln** — Ausgaben können falsche Formate oder Übermittlungswege suggerieren

## Solution

### Vier separate Wissensquellen mit eigener Ingestion-Logik

---

### 1. Formulare & amtliche Vordrucke

**Quellen (kostenlos, rechtssicher):**
- BMJ Formulare & Muster (bundesweite Vordrucke)
- Justizportal Bund/Länder (Mahn-, Vollstreckungssachen, GV-Formulare)
- NRW-Justiz Formularübersichten (Zivilsachen, Kostenfestsetzung)
- Arbeitsgerichte: LAG BW, ArbG Dresden, ArbG Brandenburg, ArbG Herford (viele als DOCX verfügbar)

**Aufbereitung:**
- PDF/DOCX → Markdown-Konvertierung mit Platzhalter-Normierung: `{{Kläger_Name}}`, `{{Kündigungsdatum}}`, `{{Anlage_K1}}`
- Chunking nach Schriftsatz-Bausteinen: Rubrum, Sachverhalt, Anträge, Begründung, Beweisangebot, Anlagen, Kostenantrag, Zuständigkeit
- Eigene DB-Tabelle `muster_chunks`

**Metadaten je Chunk:**
```
rechtsgebiet, verfahrensart, gerichtszweig, instanz,
stadium, typische_varianten, erforderliche_anlagen,
frist_trigger, quelle, stand, lizenz
```

**Lizenzkritisch:** Kommerzielle Formularbibliotheken (juris Formulare etc.) nur mit expliziter Lizenzprüfung — kein Bulk-Ingesting ohne Genehmigung.

---

### 2. Kanzlei-eigene Muster (größter Hebel)

Wenn bestehende Schriftsatzsammlungen vorhanden:
- **Pflicht vor Ingestion**: konsequente Anonymisierung (Mandanten, Gegner, AZ, Arbeitgeber, Orte) — manuell oder via PII-Filter (aus Urteile-RAG wiederverwendbar)
- Versionierung: Stand, Autor, Qualitätsfreigabe-Flag
- Gleiche Platzhalter-Konvention wie amtliche Formulare

Kanzlei-Muster erhalten höchste Retrieval-Priorität (Boosting), da sie den "Kanzlei-Stil" widerspiegeln.

---

### 3. Kostenwissen (GKG, RVG, PKH/VKH)

Kein klassisches RAG — besser als **strukturiertes Regelwerk**:
- GKG-Streitwertlogiken als JSON-Regeltabellen (nach Verfahrensart)
- RVG-Gebührenberechnung als ausführbare Logik (Grundgebühr, Verfahrensgebühr, Terminsgebühr, Einigung)
- PKH/VKH-Prüfungsschema als Checkliste + Rechenregeln
- Kostenfestsetzungsantrag-Bausteine als Muster

→ Eigene `kosten_rules`-Tabelle oder direkt als strukturiertes JSON in Settings/Config. Kein Vektor-Embedding nötig — deterministisch abrufbar via Regel-Engine oder Function-Calling.

---

### 4. ERV/beA-Formvorschriften als Validierungsregeln

Nicht als RAG-Index, sondern als **Ausgabe-Validator**:
- PDF/A-Konformität (Versionen, Fonts, Embedded)
- Dateigröße-Limits je Gericht
- Signatur-Anforderungen (qualifizierte vs. einfache elektronische Signatur)
- Übermittlungsweg-Logik (beA → EGVP, Fax-Fallback, etc.)

→ Als Regel-JSON im Code, Helena prüft Ausgaben dagegen und gibt Warnungen aus.

---

### Priorisierung (Verfahrensarten)

1. **Arbeitsrecht** (höchste Prio): KSchG-Klage, Weiterbeschäftigungsantrag, Lohnklage, Abmahnung/Unterlassung — alle frei verfügbaren Klagevordrucke der Arbeitsgerichte + kanzlei-eigene Muster
2. **Zivilprozess/Inkasso**: Mahnverfahren (Portal + Vollstreckungsformulare), Kostenfestsetzung
3. **ERV/beA-Validierung**: Technische Ausgaberegeln
4. **Einstweiliger Rechtsschutz**: Antrag auf EV/Arrest, Schutzschrift, Vollstreckungsabwehr

---

### Helena-Integration

Bei Anfrage "Erstelle KSchG-Klage":
1. `muster_chunks` → passende Bausteine retrieven (Rubrum + Anträge + Begründungsschema)
2. `law_chunks` → relevante §§ KSchG, ArbGG laden
3. `urteil_chunks` → aktuelle BAG-Rechtsprechung zu Kündigungsschutz
4. `kosten_rules` → Streitwert + Gebühren berechnen
5. ERV-Validator → Ausgabe-Format prüfen
6. Zusammensetzen + Platzhalter befüllen aus Akten-Kontext

→ Eigene `muster_chunks`-Tabelle, gleicher Hybrid-Search-Ansatz wie Gesetze/Urteile.
