# Plan: AI-Lawyer-Erkenntnisse als Contributions zu j-lawyer.org

**Status:** Entwurf (2026-07-23)
**Strategie:** Kein Fork, kein Add-on-Produkt — aktive Upstream-Mitentwicklung an `jlawyerorg/j-lawyer-org`
**Grundprinzip:** Was wandert, ist primär **validierte Fachlogik, Testfälle und Design-Wissen** — nicht Code (TypeScript ↔ Java). Jeder Beitrag muss eine dokumentierte j-lawyer-Lücke füllen.

---

## Ziele

1. j-lawyer um Funktionen ergänzen, die dort fehlen und in AI-Lawyer erprobt sind
2. Maintainer-Vertrauen aufbauen (klein anfangen, Qualität liefern)
3. Langfristig Einfluss auf j-lawyers KI-Architektur nehmen (Draft-Gate, deterministische Pipelines, RAG)

## Rahmenbedingungen j-lawyer (aus Recherche, Stand v3.5.x)

- **Stack:** Java 17, WildFly 26, MariaDB, Hibernate/Envers, Swing-Client, Maven
- **Lizenz:** AGPLv3 — alle Server-Beiträge sind quelloffen
- **Contribution-Pfade:**
  - `jlawyerorg/j-lawyer-calculations` — Calculation-Plugins (zentral gehostet, lokal ausgeführt, kein Server-Eingriff) → **geringste Hürde**
  - `jlawyerorg/j-lawyer-forms` — Groovy-Falldatenblatt-Plugins mit `FormAiMethods` (KI-Anbindung) → **geringe Hürde**
  - `jlawyerorg/j-lawyer-org` — Server/Client; große Änderungen über **OpenSpec**-Change-Proposals (`openspec/` im Repo) → **hohe Hürde, Spec zuerst**
- **Ansprechpartner:** Jens Kutschke / Office 42 GmbH; Dev-Setup via `j-lawyer-developer-quickstart`

---

## Phase 0: Onboarding (Woche 1–2)

**Ziel:** Entwicklungsumgebung steht, erster Kontakt zur Community, Prozess verstanden.

| # | Aufgabe | Ergebnis |
|---|---------|----------|
| 0.1 | `j-lawyer-developer-quickstart` klonen, Build + Server + Client lokal zum Laufen bringen (Docker-Variante) | Laufende Dev-Instanz |
| 0.2 | Swagger-UI (`/j-lawyer-io/swagger-ui/`) und Doku durchgearbeitet; Abgleich mit eigener ETL-Erfahrung (`src/lib/jlawyer/client.ts`) | Aktualisiertes API-Bild |
| 0.3 | Contribution-Guidelines, OpenSpec-Format und CLAUDE.md im Repo lesen; Issue-Tracker nach offenen Punkten in unseren Themenfeldern durchsuchen (Fristen, 2FA, DSGVO, RVG 2025) | Liste existierender Issues, um Doppelarbeit zu vermeiden |
| 0.4 | Kurze Vorstellung beim Maintainer (Issue/Diskussion): Werdegang AI-Lawyer, Absicht langfristiger Contributions, erstes Thema Fristenrechner | Kontakt hergestellt |

**Abbruchkriterium/Prüfpunkt:** Reagiert der Maintainer positiv auf den Fristenrechner-Vorschlag? Wenn nein → Thema wechseln (z. B. vorhandenes Issue übernehmen).

---

## Phase 1: Quick Win — BGB-Fristenrechner (Woche 2–5)

**Lücke in j-lawyer:** Nur Werktag-Verschiebung, kein echter Fristenrechner (§§ 187 ff. BGB).
**Asset aus AI-Lawyer:** `src/lib/fristen/rechner.ts`, `feiertage.ts`, `vorfrist.ts` + **50+ Testfälle** (Jahreswechsel, Schaltjahre, Feiertagsketten, Bundesländer).

| # | Aufgabe | Deliverable |
|---|---------|-------------|
| 1.1 | Sprachneutrale Spezifikation aus dem TS-Code extrahieren: Fristbeginn (§ 187), Fristende (§ 188), Feiertags-/Wochenendregel (§ 193), Notfristen, Monats-/Wochenfristen | `SPEC-FRISTENRECHNER.md` |
| 1.2 | Testfall-Katalog exportieren (Eingabe → erwartetes Ergebnis, alle Edge Cases) — sprachunabhängig als Tabelle/JSON | `fristen-testfaelle.json` |
| 1.3 | Feiertagsdaten-Strategie klären: AI-Lawyer nutzt `feiertagejs`; Java-Äquivalent suchen (z. B. `de.focus-shift:holiday` / jollyday) oder Daten statisch generieren | Entscheidung dokumentiert |
| 1.4 | Implementierung als Calculation-Plugin (Groovy/Java) im `j-lawyer-calculations`-Format | Plugin + JUnit-Tests (Portierung der 50+ Fälle) |
| 1.5 | PR einreichen, Review-Iterationszyklen | Gemergtes Plugin |

**Erfolgskriterium:** Plugin gemergt oder im Calculation-Repo verfügbar; Maintainer-Beziehung etabliert.
**Aufwand:** S — die Fachlogik existiert getestet, nur Portierung + Plugin-Hülle.

---

## Phase 2: RVG/GKG KostBRÄG 2025 (Woche 4–6, parallel zu Phase 1 möglich)

**Asset:** `src/lib/finance/rvg/` (fee-table, gkg-table, anrechnung, pkh, vv-catalog) mit **157 Tests**.

| # | Aufgabe | Deliverable |
|---|---------|-------------|
| 2.1 | Prüfen, ob j-lawyers RVG-Plugins auf KostBRÄG-2025-Stand sind (Code + Tests im Repo lesen) | Gap-Analyse |
| 2.2 | Falls veraltet/fehlerhaft: Tabellen + Berechnungslogik als PR (oder neues Calculation-Plugin); Testfälle portieren | PR / Plugin |
| 2.3 | Falls aktuell: eigene Testfälle als zusätzliche Absicherung anbieten | Test-PR |

**Aufwand:** XS–S. **Hinweis:** Erst Gap-Analyse, dann Maintainer fragen — nichts „reparieren", was nicht kaputt ist.

---

## Phase 3: TOTP-2FA als erster Server-PR (Woche 6–12)

**Lücke in j-lawyer:** Keine Zwei-Faktor-Authentifizierung — sicherheitsrelevant für Anwaltssoftware.
**Asset aus AI-Lawyer:** Durchgespieltes Design (`src/lib/totp.ts`, Login-Flow `/login/totp`, `/2fa-setup-required`): QR-Setup, Backup-Codes, **rollenbasierte Pflicht**, Recovery-Pfad, Admin-Override.

| # | Aufgabe | Deliverable |
|---|---------|-------------|
| 3.1 | OpenSpec-Change-Proposal schreiben: Ziele, UX-Flows (Setup, Challenge, Recovery), Datenmodell (TOTP-Secret am Nutzer, verschlüsselt), Rollenpflicht-Konzept, Abwärtskompatibilität | `openspec/changes/add-totp-2fa/proposal.md` |
| 3.2 | Diskussion mit Maintainer abwarten, Design anpassen (ggf. externe Auth-Systeme beachten — j-lawyer unterstützt die) | Abgenommene Spec |
| 3.3 | Implementierung Server (EJB, Flyway-Migration, Java-TOTP-Lib) + Swing-Client-UI (Setup-Dialog, Login-Challenge) | PR |
| 3.4 | Tests + Doku-Kapitel | Vollständiger PR |

**Erfolgskriterium:** Spec akzeptiert (Implementierung kann auch in Zusammenarbeit erfolgen).
**Aufwand:** M — erster echter Server-Eingriff, hier zahlt sich Phase-1-Vertrauen aus.

---

## Phase 4: Weitere Server-Beiträge (nach Priorität, Quartal 2)

Reihenfolge nach Verhältnis Lücke × Aufwand × Akzeptanzwahrscheinlichkeit:

| # | Thema | j-lawyer-Lücke | AI-Lawyer-Asset | Aufwand | Form |
|---|-------|----------------|-----------------|---------|------|
| 4.1 | **Webhook-Payloads anreichern** | 14 Events, aber flache Payloads (nur IDs) | ETL-Erfahrung: welche Felder Konsumenten wirklich brauchen (`src/lib/jlawyer/etl-*.ts`) | XS | Kleiner PR (optionaler `payload=full`-Parameter) |
| 4.2 | **Proaktive Akten-Checks** | Nur passive Reports, keine Alerts | Scanner-Pattern (`src/lib/scanner/`): Frist-nah, inaktiv, Anomalie; Ergebnis als Sofortnachricht/WV | M | OpenSpec + Server-PR |
| 4.3 | **DSGVO-Werkzeuge** | Löschen ja, Anonymisierung/Auskunft nein | Regelwerk aus `src/lib/dsgvo/` (welche Entitäten, wie Bezüge brechen) | M | OpenSpec + Server-PR |
| 4.4 | **DATEV-Export** | Nicht vorhanden | `src/lib/finance/export/datev.ts` Format-Wissen | S–M | PR ans Report/Export-Modul |
| 4.5 | **CalDAV generisch** | Nur Nextcloud, nur offene Einträge | Sync-Architektur (`src/lib/caldav/`): Mapping-Tabelle, Idempotenz, Konfliktstrategie | M–L | OpenSpec (evtl. Verbesserung `j-lawyer-cloud`) |
| 4.6 | **KI-Falldaten-Extraktion** | KI-Befüllung nur 3 Sachgebiete | Extractor-Erfahrung: Prompts, Felder-Zuverlässigkeit, Halluzinations-Fallen | S | `j-lawyer-forms` Plugins |

---

## Phase 5: Strategische KI-Beiträge (langfristig, ab Quartal 3)

Hier geht es weniger um Code als um **Architektur-Einfluss** — j-lawyers Ingo-Backend ist proprietär, aber Client-Tool-Registry und OpenSpec-Prozess sind offen.

| # | Thema | Kernbotschaft aus AI-Lawyer | Format |
|---|-------|------------------------------|--------|
| 5.1 | **Draft-Gate-Governance** | KI-Write-Tools erzeugen ausschließlich Entwürfe; Versand/Freigabe nur durch Menschen (`versand-gate.ts`, Helena-Write-Tools) | OpenSpec-Diskussion / ADR-Vorschlag |
| 5.2 | **Deterministische Dokument-Pipelines** | Template + validierte Slots + Multi-Turn-Rückfragen schlägt LLM-Freitext bei Rechtsdokumenten (`helena/schriftsatz/`) | OpenSpec-Proposal, Referenz auf AI-Lawyer als Proof-of-Concept |
| 5.3 | **Hybride Suche / RAG** | Volltext + Vektor + RRF + Reranker; paragraph-bewusstes Chunking deutscher Rechtstexte (`src/lib/embedding/`) | Architektur-Diskussion; ggf. Spike als externer Dienst an REST-API |
| 5.4 | **Rechtsdaten-Ingestion** | Gesetze (bundestag/gesetze) + BMJ-Urteils-RSS als tägliche Pipeline (`src/lib/gesetze/`, `src/lib/urteile/`) | Proposal (Lizenzfragen klären!) |

**Wichtig:** Diese Themen früh ankündigen, aber erst nach Phase 1–3 aktiv pushen — als Contributor mit Track Record (und einer 141k-LOC-Referenzimplementierung) hat man ein anderes Gewicht.

---

## Bewusst ausgenommen

| Thema | Grund |
|-------|-------|
| Gamification | Passt nicht zum j-lawyer-Nutzerbild, Ablehnung wahrscheinlich |
| Mandantenportal / Web-Client als PR | Konkurriert mit Office-42-Geschäftsmodell (Cloud/Hosting); höchstens als Diskussionsbeitrag — REST-API v1–v8 könnte einen Web-Client tragen, AI-Lawyer ist der Beweis |
| BI-Dashboard | Report-System etabliert; nur einzelne KPI-Report-Definitionen sinnvoll |
| beA, E-Mail, Finanzen-Kern | j-lawyer bereits (teilweise reifer) vorhanden |

## Risiken & Gegenmaßnahmen

| Risiko | Maßnahme |
|--------|----------|
| Maintainer lehnt große Vorschläge ab | Klein anfangen (Phase 1–2), Specs vor Code, auf Feedback eingehen |
| OpenSpec-Prozess bremst | Als Feature, nicht Bug sehen — Specs zwingen zu sauberem Design |
| Java/Swing-Umlernaufwand | Phase 0 ernst nehmen; erste PRs bewusst klein; ggf. Pairing mit bestehenden Contributorn suchen |
| Zeitkonflikt mit AI-Lawyer-Roadmap (v0.8/v0.9 läuft) | Phasen 1–2 sind klein (S); große Themen (Phase 3+) bewusst terminieren |
| AGPL: eigener Code muss offen sein | Entspricht der Strategie — kein Risiko, aber keine proprietären Assets in PRs kopieren |

## Nächster konkreter Schritt

**Phase 0.1 + 1.1:** j-lawyer Dev-Setup aufsetzen und parallel die Fristenrechner-Spezifikation aus `src/lib/fristen/rechner.ts` extrahieren (inkl. Testfall-Export).
