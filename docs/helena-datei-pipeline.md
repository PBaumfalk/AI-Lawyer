# Helena Datei-Pipeline mit anymize

Stand: 19.11.2026. Grundlage sind die öffentliche Dokumentation von anymize (https://anymize.ai/dokumentation, https://anymize.ai/api-docs?locale=de), die AGB, die Datenschutzerklärung und die Übersicht der Unterauftragsverarbeiter, alle am 19.11.2026 abgerufen. Der Live-Test gegen anymize lief am 19.11.2026 erfolgreich (siehe Abschnitt 5).

## 1. Was die Pipeline macht

Helena nimmt Dateien entgegen und verarbeitet sie wie in Claude Cowork bis zum fertigen Entwurf. Die KI sieht dabei nur pseudonymisierten Text.

| Schritt | Wo | Was passiert |
|---|---|---|
| 1. Einlesen | lokal | Größe (25 MB je Datei, höchstens 10 Dateien) und Format werden geprüft. Das Format wird an den ersten Bytes der Datei erkannt, nicht an der Endung. Dateinamen werden nie weitergegeben. |
| 2. Konvertieren | lokal, nur im Arbeitsspeicher | DOCX und ODT (inklusive Kopf- und Fußzeilen, Fußnoten und Kommentaren), PDF mit Textebene, HTML, RTF, EML (ohne Anhänge), CSV, TXT und MD werden zu Markdown. Scans und Bilder gehen nur an einen lokalen OCR-Dienst (Stirling-PDF im eigenen Docker-Netz). |
| 3. Anonymisieren | anymize (Kiel, Hosting Hetzner Deutschland) | Auftrag und Dokumente werden in einem Job anonymisiert, dann ist die Platzhalter-Zuordnung über alle Dateien einheitlich. Die Zuordnungstabelle (Hash-Paare) wird abgeholt. **Unmittelbar danach wird der Job bei anymize gelöscht** (`DELETE /api/v1/jobs/:id`), also noch vor dem KI-Aufruf. |
| 4. Ausgangs-Check | lokal | Der Check prüft den exakten Text, der an die KI gehen soll. Er arbeitet unabhängig von anymize und stoppt bei jedem Fund (fail closed). |
| 5. Verarbeiten | Standard: anymize-eigenes Modell in Deutschland oder lokales Ollama | Die KI erhält nur Text mit Platzhaltern. Anbieter in Drittländern sind gesperrt, solange sie nicht ausdrücklich freigegeben werden. |
| 6. Rückführung | lokal | Die Platzhalter werden anhand der lokal gehaltenen Zuordnung durch die echten Namen ersetzt. Dafür wird nichts erneut versendet. Auch Platzhalter, die die KI verstümmelt hat (`[Person-…]`, ohne Klammern, in Kleinbuchstaben), werden erkannt. |
| 7. Aufräumen | lokal und anymize | Rohdaten-Buffer werden mit Nullen überschrieben. Eine Job-Löschung, die vorher gescheitert ist, wird wiederholt. Ein Protokoll ohne Inhalte wird geschrieben. |

Code: `src/lib/helena/datei-pipeline/`, API: `POST /api/helena/datei-verarbeitung`, Kommandozeile: `scripts/helena-datei.ts`.

## 2. Machbarkeit: was geht, was nicht

**Das geht:**

- Anonymisieren, Verarbeiten und lokale Rückführung über die dokumentierte API.
- Löschen der Jobs inklusive Hash-Paaren über die API.
- Ein Ausgangs-Check auf eigener Seite, der unabhängig von anymize arbeitet.
- Alle gängigen Kanzleiformate, lokal konvertiert.

**Das geht nicht oder nur eingeschränkt:**

1. **anymize sieht die Rohdaten.** „Anonymisierung vor der Verarbeitung“ heißt nicht, dass niemand außer der Kanzlei den Klartext sieht: anymize anonymisiert auf eigenen Servern. anymize ist damit selbst Auftragsverarbeiter und Dienstleister im Sinne des § 43e BRAO (siehe Abschnitt 3). Ohne lokale Anonymisierung lässt sich das nicht vermeiden.
2. **anymize spricht selbst von Pseudonymisierung, nicht von Anonymisierung** (Datenschutzerklärung § 8.2): Die Zuordnung ist umkehrbar. Für die Kanzlei bleiben die Daten personenbezogen.
3. **Die Erkennung ist nicht vollständig.** anymize nennt eine „Zielerkennungsrate von >95 %“ und lehnt eine Gewähr ab (AGB § 10.1, Datenschutz § 7.3). Deshalb gibt es den Ausgangs-Check. Er hat aber eine nachgewiesene Grenze: Einen Namen, den anymize übersieht, der in der Akte nicht als Beteiligter steht und den die lokale Namenserkennung (Ollama) nicht findet, erkennt er nicht. Diese Grenze ist im Test „RESTRISIKO dokumentiert“ festgehalten. In Produktion muss die lokale Namensprüfung deshalb eingeschaltet sein (`helena.datei.nerPruefung`, Standard: an).
4. **Welche Entitäten anymize anonymisiert, lässt sich per API nicht steuern.** Das persönliche Wörterbuch („Immer“ und „Nie anonymisieren“) gibt es nur in der App. Ob es auch für API-Anfragen gilt, ist nicht dokumentiert.
5. **Datumsangaben (live geprüft):** anymize ersetzt nur das Geburtsdatum (`date_of_birth`). Sachverhaltsdaten wie Beschäftigungsbeginn, Kündigungsdatum oder Kündigungstermin bleiben stehen. Die KI kann also mit Fristen arbeiten. Fristberechnungen prüft trotzdem ein Mensch.
5a. **Eine Person, mehrere Platzhalter (live beobachtet):** Der volle Name („Sabine Krüger-Wendt“) und der Nachname allein („Frau Krüger-Wendt“) bekommen verschiedene Platzhalter. Die KI kann daher nicht sicher erkennen, dass beide dieselbe Person meinen. Die Rückführung stimmt trotzdem, der Entwurf muss aber inhaltlich geprüft werden.
6. **Zero Data Retention (ZDR) und lokale Rückführung schließen sich aus.** Bei aktivem ZDR liefert anymize keine Hash-Paare. Das Ergebnis bleibt dann mit Platzhaltern, die Pipeline weist darauf hin. Empfehlung: ZDR aus, Aufbewahrung der Hash-Paare auf 24 Stunden. Die Pipeline löscht jeden Job ohnehin sofort selbst.
7. **Rückführung ins Originalformat:** Das Ergebnis ist Markdown. Eine DOCX- oder ODT-Datei mit dem ursprünglichen Layout entsteht nicht. Die Ablage als Helena-Entwurf in der Akte ist noch nicht angebunden.
8. **Bilder in DOCX/ODT und E-Mail-Anhänge** werden nicht ausgewertet. Die Pipeline nennt das im Protokoll.
9. **Widersprüche in der anymize-Doku** werden defensiv behandelt:
   - drei verschiedene Platzhalterformate, deshalb gilt die Zuordnung aus den Hash-Paaren und nicht ein bestimmtes Format;
   - `Retry-After` einmal in Sekunden, einmal als Unix-Zeitstempel, deshalb wird beides akzeptiert;
   - ein Feld `original_text` in der Statusantwort, das ignoriert und nie gespeichert wird.
10. **Grenzen auf anymize-Seite:** 60 Anonymisierungen pro Minute und 2.000 pro Tag je Schlüssel. Ein Größenlimit für `/api/anonymize` ist nicht dokumentiert. Lange Texte werden deshalb an Absatz-, Satz- oder Wortgrenzen geteilt (Standard 100.000 Zeichen je Job), nie mitten im Wort.

## 2b. Modelle je Aufgabe

Die Pipeline wählt das Modell nach der Aufgabe (`aufgabe` in der API). Erlaubt sind nur Modelle der Positivliste in `src/lib/helena/datei-pipeline/modelle.ts`. Neue anymize-Modelle sind gesperrt, bis sie dort per Code-Review aufgenommen werden.

| Aufgabe | bevorzugt | Ersatz ohne Einwilligung in Fremdmodelle |
|---|---|---|
| `extrahieren` (Daten, Fristen, Beteiligte) | `waterfall-2.0` | `waterfall-2.0` |
| `zusammenfassen` (Sachstand) | `waterfall-2.0` | `waterfall-2.0` |
| `mandantenbrief` (Brief, Vermerk) | `waterfall-2.0` | `waterfall-2.0` |
| `schriftsatz` | `anthropic/claude-opus-5.5` | `waterfall-2.0` |
| `wuerdigung` (Erfolgsaussichten) | `anthropic/claude-opus-5.5` | `waterfall-2.0` |
| `allgemein` | `waterfall-2.0` | `waterfall-2.0` |

**Gesperrt:**
- `auto`: Wohin anymize die Anfrage leitet, ist nicht steuerbar.
- `zai/*`: Anbieter in China.
- `x-ai/*`.
- `perplexity/*`: macht Websuche.
- `claude-fable-5.1`: Anthropic speichert hier laut anymize 30 Tage.
- `*-us`-Varianten und Preview-Modelle.

Admins können die Zuordnung in der Einstellung `helena.datei.modellRouting` überschreiben (JSON, z. B. `{"zusammenfassen": {"modell": "anthropic/claude-sonnet-5.5", "ersatz": "waterfall-2.0"}}`). Einträge mit Modellen außerhalb der Positivliste oder mit nicht-deutschem Ersatz werden verworfen.

**Einwilligung der Mandantschaft:** Die Einwilligung wird je Akte vermerkt (`PUT /api/akten/[id]/ki-einwilligung`). Das dürfen nur Anwältinnen, Anwälte und Admins, und jede Änderung landet im Audit-Log.

- `KEINE`: keine Verarbeitung (`EINWILLIGUNG_FEHLT`).
- `DE_MODELLE`: anymize-Anonymisierung und die deutschen anymize-Modelle.
- `FREMDMODELLE`: zusätzlich Foundation-Modelle über anymize.

Hintergrund ist § 43e Abs. 5 BRAO in unserem Verständnis: Dient eine Dienstleistung unmittelbar einem einzelnen Mandat, braucht es die Einwilligung der Mandantschaft. Das ist **vor dem Produktivbetrieb am Normtext zu prüfen.** Die Pflicht lässt sich nach dieser Prüfung mit `helena.datei.einwilligungErforderlich` abschalten. Dann gelten ohne Vermerk die deutschen Modelle.

**Qualitätsvergleich:** `ANYMIZE_API_KEY=… npx tsx scripts/helena-modellvergleich.ts` schickt fünf Kanzleiaufgaben auf fiktiven Daten an fünf Modelle. Das Skript schreibt einen blinden Bericht (Modelle A–E) nach `docs/modellvergleich/<Datum>/`.

## 2c. Datenschutz-Schleuse unter ganz Helena

Seit dem 19.11.2026 läuft **jedes externe Modell**, das Helena benutzt, durch die Datenschutz-Schleuse. Externe Modelle sind alle außer Ollama. Die Schleuse ist eine AI-SDK-Middleware (`src/lib/ai/datenschutz-schleuse.ts`), eingehängt an den beiden Stellen, an denen Helena Modelle erzeugt: `getModel()` und `createModelForName()`. Sie deckt damit alle Aufrufer ab: Agent mit Werkzeugen, Schriftsatz-Ablauf, Chat, Scanner und Extraktoren.

**Vor jedem Aufruf**
- Neue Texte (System-Prompt, Nutzertext, Werkzeugergebnisse) werden über anymize pseudonymisiert. Derselbe Text wird je Lauf nur einmal anonymisiert.
- Was das Modell selbst zuvor geschrieben hat, wird lokal wieder auf Platzhalter gesetzt.
- Bilder und Dateien werden gesperrt (`NICHT_PSEUDONYMISIERBAR`).
- Danach prüft der Ausgangs-Check die gesamte Anfrage einschließlich der Werkzeugdefinitionen.

**Nach jedem Aufruf**
- Platzhalter in Text und Werkzeugargumenten werden lokal zurückgeführt. Werkzeuge arbeiten so mit echten Daten.
- Bei JSON-Ausgaben werden die Werte JSON-sicher eingesetzt.
- Beim Streaming hält die Schleuse Platzhalter zurück, die über mehrere Stream-Stücke verteilt sind, bis sie vollständig sind.

**Aktenbezug**
- Agent (`runHelenaAgent`), Schriftsatz-Ablauf und Chat setzen den Aktenkontext. Alle Modellaufrufe eines Laufs teilen sich dann eine Zuordnung und die Einwilligung dieser Akte.
- Deckt die Einwilligung das Modell nicht ab, weicht die Schleuse auf waterfall-2.0 aus.
- Fehlt jede Einwilligung, bricht sie ab, bevor etwas gesendet wird.
- Ohne Aktenbezug sind nur deutsche Modelle erlaubt.

**Anbieter**
- Neuer KI-Anbieter `anymize` in den Einstellungen; Standardmodell ist `waterfall-2.0`.
- OpenAI und Anthropic direkt gehen ebenfalls nur noch durch die Schleuse.
- **Ohne anymize-Schlüssel verweigert Helena externe Anbieter** mit einem klaren Hinweis. Ollama bleibt unberührt.

**Live geprüft (fiktive Daten, `scripts/helena-schleuse-live.ts`)**

| Betriebsart | Ergebnis |
|---|---|
| Agent mit Werkzeugen, Opus 5.5 | 1 Lauf |
| Agent mit Werkzeugen, waterfall-2.0 | 7 Läufe |
| Streaming | 1 Lauf |
| strukturierte Ausgabe | 1 Lauf, Klagefristende korrekt 24.11.2026 |

In allen Läufen gab es kein Leck, die Rückführung war vollständig, und das Werkzeug bekam den echten Namen. Einmal hat der Ausgangs-Check in einem waterfall-Lauf gesperrt. Die Ursache ließ sich in sechs Wiederholungen nicht nachstellen. Wahrscheinlich hatte anymize einen Wert im Werkzeugergebnis nicht ersetzt.

**Gesamttest mit Datenbank (19.11.2026, `scripts/helena-e2e.ts`)**

Aufbau: isolierter Test-Stack (Postgres mit pgvector, Redis, Ollama mit Embedding-Modell, keine Projekt-Volumes), fiktive Akte mit drei Beteiligten, zwei Dokumenten und einem kanzleieigenen Muster. Getestet wurde echtes anymize mit Helenas echtem Agenten und ihren Werkzeugen.

| Lauf | Ergebnis |
|---|---|
| Sachstand, Schnellmodus | vollständig, echte Namen, Klagefrist 24.11.2026 richtig |
| Kündigungsschutzklage, Hintergrundmodus | Muster genutzt, Klageentwurf und Fristentwurf in der Akte angelegt, Rückführung vollständig |
| Einwilligung nur DE-Modelle | vollständig |
| ohne Einwilligung | gestoppt, bevor etwas gesendet wurde |

Über alle Läufe: kein Personendatum in den Anfragen an die KI, kein anderes externes Ziel als anymize, alle anymize-Jobs gelöscht.

**Was erst der Gesamttest aufgedeckt hat (behoben)**
- anymize markiert „Helena“ und „Kanzlei“ als Personendaten. Dafür gibt es jetzt erlaubte Begriffe. Heißt ein Beteiligter so, entfällt die Ausnahme für diese Akte.
- Helenas Werkzeuge liefern JSON mit getrennten Feldern. Einen Vornamen allein erkennt anymize dort nicht. Bekannte Werte aus der Datenbank (Beteiligte, Mitarbeiter) werden deshalb **lokal und deterministisch** ersetzt, bevor etwas zu anymize geht.
- In JSON werden Zeilenumbrüche zu `\n`. Werte, die über eine Zeile laufen, entgingen so der lokalen Ersetzung. Werkzeugergebnisse werden jetzt lesbar mit echten Zeilenumbrüchen übergeben, die Ersetzung behandelt `\n` als Leerraum.
- Interne Datenbank-IDs sind keine Personendaten und bleiben lesbar, damit Werkzeugaufrufe funktionieren.
- Der Schnellmodus hat mit Schleuse 90 statt 30 Sekunden Zeit.

**Offen**
0. Helenas Agent wählt das Modell über die Komplexitätsstufe, nicht über das Routing je Aufgabe. Im Test lief auch die Klage über waterfall (Stufe 2). Opus greift nur bei Stufe 3. Das Routing sollte in die Stufenwahl einfließen, zum Beispiel Schriftsatz → Stufe 3.
1. Hintergrundaufgaben ohne Aktenkontext laufen pseudonymisiert und nur über deutsche Modelle, prüfen aber die Einwilligung nicht. Betroffen sind:
   - Scanner,
   - Tagesbriefing,
   - Fristen- und Beteiligten-Extraktion,
   - Falldaten,
   - Fallzusammenfassung,
   - Memory.

   Sie sollten `mitKiKontext({ akteId })` setzen.
2. Die Dokumentanalyse mit Bildern (Vision) geht mit externen Anbietern nicht mehr.
3. Der Chat schickt bei jeder Anfrage seinen großen System-Prompt (RAG-Kontext) neu an anymize. Gesetzes- und Urteilstexte könnte man über Anfragen hinweg zwischenspeichern.
4. Die lokale Namensprüfung (Ollama mit 35B-Modell) war im Gesamttest abgeschaltet, weil das Modell im Test-Stack fehlte.

## 3. Datenschutz und Berufsrecht

Dieser Abschnitt ist eine Arbeitsgrundlage für den Datenschutzbeauftragten, keine abschließende rechtliche Bewertung.

**Rollen**

- Die Kanzlei ist Verantwortliche.
- anymize ist Auftragsverarbeiter nach Art. 28 DSGVO. Ein AVV liegt vor (Version 1.6 vom 06.11.2026) und gilt mit Kontoerstellung. Eine beidseitig unterschriebene Fassung gibt es auf Anfrage.
- Der KI-Anbieter erhält nur pseudonymisierten Text.
  - anymize-eigene Modelle (fountain, waterfall): laufen nach Anlage 2 bei Hetzner und OVH in Deutschland. Hetzner und OVH sind ständige Unterauftragsverarbeiter, die laut anymize nach § 203 Abs. 4 StGB verpflichtet sind.
  - OpenAI, Anthropic, Mistral, xAI und das Gateway Requesty: Diese Anbieter sind laut anymize ausdrücklich **nicht** nach § 203 Abs. 4 StGB verpflichtet (Anlage 2 § 1). Die Pipeline sperrt sie deshalb standardmäßig (Fehlercode `ANBIETER_NICHT_FREIGEGEBEN`).

**§ 203 StGB und § 43e BRAO**

- Das Berufsgeheimnis schützt den gesamten Sachverhalt, nicht nur Namen. Ein pseudonymisierter Sachverhalt kann über Kontextwissen wieder identifizierbar sein. Deshalb gilt die Standardregel: Verarbeitung nur lokal oder bei den deutschen anymize-Modellen.
- Für anymize als Dienstleister verlangt § 43e Abs. 3 BRAO einen Vertrag in Textform. Er muss enthalten:
  - die Verschwiegenheitsverpflichtung unter Belehrung über die strafrechtlichen Folgen,
  - die Beschränkung auf das erforderliche Maß an Kenntnisnahme,
  - die Regelung zu Unterbeauftragungen.
- anymize bietet eine Verschwiegenheitsvereinbarung und eine „BRAO-Einverständniserklärung“ im Governance-Center an. **Vor dem Produktivbetrieb: beide Dokumente lesen und unterschrieben ablegen.** Ihr Wortlaut war öffentlich nicht einsehbar.
- § 43e Abs. 4 BRAO (Dienstleistungen im Ausland) spricht ebenfalls dafür, Drittlandanbieter gesperrt zu lassen.

**Pseudonymisierung**

- Für die Kanzlei sind die Daten weiterhin personenbezogen (Art. 4 Nr. 5 DSGVO, ErwGr. 26).
- Ob der KI-Anbieter, der die Zuordnung nicht kennt, personenbezogene Daten verarbeitet, richtet sich nach der relativen Betrachtung (vgl. EuGH, Urt. v. 19.10.2016, C-582/14 – Breyer). Weil anymize die Zuordnung hält, wird hier nicht unterstellt, dass die Daten für den KI-Anbieter anonym sind.

**Datenminimierung und Speicherbegrenzung**

- Die Jobs bei anymize werden unmittelbar nach der Anonymisierung gelöscht. Die Klartexte liegen dort also nur Sekunden bis Minuten.
- Auf eigener Seite entstehen keine Dateien: keine Temporärdateien, Konvertierung nur im Arbeitsspeicher. Eingangs-Buffer werden überschrieben.
- Zeichenketten in JavaScript lassen sich technisch nicht gezielt löschen. Sie verschwinden erst mit der Speicherbereinigung (Garbage Collection).

**Protokolle**

- Geloggt wird nur das Protokollobjekt: Zähler, Formate, Dauer, Fehlercodes und maskierte Funde (zum Beispiel `K***r (6 Zeichen)`).
- Nicht geloggt werden Texte, Dateinamen, Hash-Paare oder der API-Schlüssel.
- Fehlermeldungen von anymize übernimmt die Pipeline nicht, denn sie könnten Text zurückspiegeln. Ein Test prüft genau das.
- Ins Audit-Log (`HELENA_DATEI_VERARBEITET` bzw. `HELENA_DATEI_GESTOPPT`) gehen Lauf-ID, Format, Anzahl der Ersetzungen, Ergebnis des Checks und Fundkategorien.

**Weitere Pflichten**

- Eine Datenschutz-Folgenabschätzung nach Art. 35 DSGVO wird empfohlen, weil KI auf Mandatsdaten eingesetzt wird und Art.-9-Daten (Gesundheit, Strafverfahren) möglich sind.
- Die Datenschutzhinweise für Mandanten (Art. 13 DSGVO) sollten anymize als Empfänger nennen.
- Den API-Schlüssel nur unter Einstellungen → KI eintragen. Dort wird er verschlüsselt gespeichert (`enc:v1:`, AES-256-GCM).

## 4. Betrieb

**Fehlercodes**

Alle Fehler brechen den Lauf ab, ohne dass etwas an die KI geht.

| Code | Bedeutung | Maßnahme |
|---|---|---|
| `NICHT_EINGERICHTET` | kein anymize-Schlüssel | Einstellungen → KI |
| `DATEI_LEER`, `DATEI_ZU_GROSS`, `FORMAT_NICHT_UNTERSTUETZT`, `DATEI_DEFEKT`, `KEIN_TEXT` | Problem mit der Eingabe | Datei prüfen oder in PDF/DOCX umwandeln |
| `OCR_ERFORDERLICH`, `OCR_FEHLGESCHLAGEN` | Scan ohne Textebene, Stirling-PDF nicht erreichbar | Stirling-Container prüfen |
| `ANYMIZE_invalid_api_key` | Schlüssel ungültig | Schlüssel erneuern |
| `ANYMIZE_RATE_LIMIT`, `ANYMIZE_NICHT_VERFUEGBAR` | 429 oder 5xx nach mehreren Wiederholungen | später erneut versuchen |
| `ANYMIZE_JOB_FEHLGESCHLAGEN`, `ANYMIZE_ZEITUEBERSCHREITUNG` | Job fehlgeschlagen oder dauert länger als 5 Minuten | erneut versuchen, sonst anymize-Support |
| `PII_IM_AUSGANG` | Ausgangs-Check hat Personendaten im Ausgang gefunden | Fundkategorien im Protokoll ansehen. Häufig hilft es, den Wert ins Wörterbuch „Immer anonymisieren“ einzutragen oder den Beteiligten in der Akte zu erfassen. Den Check niemals umgehen. |
| `PRUEFER_FEHLER` | lokale Namensprüfung (Ollama) ausgefallen | Ollama prüfen |
| `ANBIETER_NICHT_FREIGEGEBEN` | Modell durch die Einwilligung nicht gedeckt und kein deutscher Ersatz konfiguriert | Routing prüfen |
| `EINWILLIGUNG_FEHLT` | an der Akte ist keine Einwilligung vermerkt | Einwilligung einholen und vermerken |
| `KI_FEHLER` | KI-Aufruf gescheitert | erneut versuchen |

**Nicht gelöschte Jobs:** Steht im Protokoll `anymizeJobsGeloescht: false`, enthält das Audit-Log unter `nichtGeloeschteJobs` die Job-IDs. Job-IDs enthalten keine Personendaten. So holen Sie die Löschung nach:

```bash
curl -X DELETE -H "Authorization: Bearer $ANYMIZE_API_KEY" https://app.anymize.ai/api/v1/jobs/<jobId>
```

**Verwaister Job bei Verbindungsabbruch:** Bricht die Verbindung ab, während die Anonymisierungsanfrage läuft, kann bei anymize ein Job entstehen, dessen ID die Pipeline nie erfährt. Die Anfrage wird in diesem Fall bewusst nicht wiederholt, damit keine weiteren unbekannten Jobs entstehen. Einen solchen Job kann die Pipeline nicht löschen. Er verfällt nach der im Konto eingestellten Aufbewahrungsfrist. Das ist ein Grund mehr, sie kurz zu halten (24 Stunden).

**Kein Werkzeugzugriff für die KI:** Die KI erhält in diesem Ablauf keine Werkzeuge. Eine Prompt-Injection im Dokument („Ignoriere alle Anweisungen …“) kann daher nichts auslösen und keine Daten abziehen. Die KI kennt ohnehin nur Platzhalter.

**Empfohlene Einstellungen im anymize-Konto**

- Zero Data Retention aus, sonst ist keine Rückführung möglich.
- Aufbewahrung der Hash-Paare: 24 Stunden.
- Klartextmodus für alle Nutzer sperren (Governance).
- Verschwiegenheitsvereinbarung und BRAO-Einverständniserklärung abschließen.

## 5. Tests

```bash
npx vitest run src/lib/helena/datei-pipeline           # 45 Tests, ohne Netz
ANYMIZE_API_KEY=ANYM_... npx vitest run src/lib/helena/datei-pipeline/__tests__/anymize.live.test.ts
ANYMIZE_API_KEY=ANYM_... npx tsx scripts/helena-datei.ts --trocken --auftrag "Fasse zusammen" datei.docx
```

**Beispieldateien:** `tests/fixtures/helena-dateien/`. Inhalt ist eine fiktive Kündigungsschutzakte mit erfundenen Personendaten. Sie liegt in DOCX und ODT vor (jeweils von Pandoc und von macOS textutil erzeugt), dazu als PDF, RTF, HTML, TXT, MD, EML mit Anhang, CSV und als Scan ohne Textebene. Die Referenzliste der enthaltenen Personendaten steht in `personendaten.json`.

**Der automatische Check (Akzeptanzkriterium):**

- Ein nachgebauter anymize-Dienst nach der dokumentierten API zeichnet jede Netzwerkanfrage auf, einschließlich des KI-Aufrufs über den OpenAI-kompatiblen Endpunkt.
- Für jede Beispieldatei prüft der Test: Kein Wert aus `personendaten.json` steht in irgendeiner Anfrage, außer in der Anonymisierungsanfrage selbst.
- Geprüft werden JSON-dekodierte Inhalte und Text mit zusammengefassten Zeilenumbrüchen.
- Außerdem geprüft: Logs, Fehlermeldungen und Stacktraces enthalten keine Personendaten, die Rohdaten-Buffer sind genullt, alle Jobs sind gelöscht.

**Weitere Tests:**

- anymize übersieht einen Namen, eine E-Mail, eine IBAN, eine Telefonnummer, eine Anschrift, ein Geburtsdatum oder eine Steuer-ID: Der Check stoppt, es gibt keinen KI-Aufruf.
- Fehler bei Schlüssel, Server, Rate-Limit, Job, Zeitüberschreitung, Löschung, KI und OCR.
- ZDR, verstümmelte Platzhalter, Sperre für Fremdanbieter-Modelle ohne Einwilligung.
- Restrisiko „unbekannter Name ohne Namensprüfung“ (dokumentiert).

## 6. Offen vor Produktivbetrieb

1. ~~Live-Test~~ erledigt am 19.11.2026. Ergebnis: Alle 19 Werte der Referenzliste wurden ersetzt, der Ausgangs-Check hatte keine Funde. Platzhalterformat `[[typ-HASH]]`, zum Beispiel `[[person-RG5PJD]]`, `[[iban-…]]`, `[[tax_id-…]]`. Alle 7 Formate liefen ohne Klartext an die KI. Die Jobs waren gelöscht, Hash-Paare danach nicht mehr abrufbar. Ein falscher Schlüssel wird sauber abgelehnt. Den Test bei Änderungen an anymize wiederholen.
2. Verschwiegenheitsvereinbarung und BRAO-Erklärung von anymize abschließen. Den AVV und die TOM (Anlage 1, nur auf Anfrage) prüfen.
3. Ollama-Namensprüfung im Betrieb aktiv halten und deren Erkennungsquote auf echten (internen) Akten prüfen.
4. Oberfläche: Drag & Drop im Helena-Chat (`src/components/ki/chat-input.tsx`) an die Route anbinden, das Ergebnis als Helena-Entwurf in der Akte ablegen.
5. Datenschutz-Folgenabschätzung durchführen und das Verzeichnis der Verarbeitungstätigkeiten ergänzen.
