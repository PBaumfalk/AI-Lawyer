# Modellvergleich Helena (blind)

Stand 19.11.2026, 17:33:56. Eingabe: fiktive Beispielakte (PDF + E-Mail), über die vollständige Pipeline (anymize-Anonymisierung, Ausgangs-Check, Rückführung).

Die Modelle heißen A bis E, die Zuordnung steht in `schluessel.json`. Bitte erst bewerten, dann nachsehen.

Automatische Prüfungen: **Frist** = richtiges Ende der Klagefrist (24.11.2026) genannt; **Platzh.** = alle Platzhalter zurückgeführt; **fremde Namen** = Personen nach Herr/Frau/Dr., die nicht in der Akte stehen; **§ 102** = § 102 BetrVG erwähnt; Kosten aus Tokens × veröffentlichtem anymize-Preis (für Fremdmodelle veröffentlicht anymize keine Preise je Token in der API-Doku).

## Übersicht

| Modell | Läufe ok | Frist richtig | Platzhalter offen | fremde Namen | Ø Dauer | Tokens aus | Kosten gesamt |
|---|---|---|---|---|---|---|---|
| A | 4/5 | 2/2 | 0 | 0 | 37 s | 14819 | Preis nicht veröffentlicht |
| B | 5/5 | 3/3 | 1 | 0 | 30 s | 11301 | 0.0036 € |
| C | 4/5 | 2/2 | 0 | 0 | 27 s | 17836 | 0.0113 € |
| D | 5/5 | 2/3 | 0 | 0 | 152 s | 32184 | Preis nicht veröffentlicht |
| E | 5/5 | 3/3 | 0 | 0 | 57 s | 25536 | Preis nicht veröffentlicht |

## Daten herausziehen (extrahieren)

> Auftrag: Erstelle eine Übersicht: Beteiligte mit Rolle, alle Daten mit ihrer Bedeutung, Beträge, offene Punkte.

### Modell A

*Platzh. offen 0 · 24 s · 2464 Tokens aus*

# Faktenübersicht (Entwurf zur anwaltlichen Prüfung)

## 1. Beteiligte mit Rolle

| Platzhalter / Angabe | Rolle | Quelle / Anmerkung |
|---|---|---|
| Sabine Krüger-Wendt | Mandantin, Absenderin der E-Mail | Dok. 1 und 2 |
| Frau Krüger-Wendt | Im Sachverhalt als Arbeitnehmerin (Disponentin) genannt | Dok. 1. **Unsicher:** Der Platzhalter weicht von dem der Mandantin ab. Es liegt nahe, dass dieselbe Person gemeint ist, das Dokument sagt es aber nicht ausdrücklich. |
| Rheinland Logistik\nHoffmann GmbH | Arbeitgeberin | Dok. 1 |
| Herr\nDr. Matthias Oberländer | Vorgesetzter der Mandantin, hat die Kündigung überreicht | Dok. 1 und 2 |
| Jürgen Pakulla | Vorsitzender des Betriebsrats | Dok. 1 |
| Aylin Demirtaş | Kollegin der Mandantin, mögliche Zeugin (laut Notiz kann sie bezeugen, dass die Kündigung ohne Vorwarnung erfolgte; laut E-Mail war sie bei der Übergabe dabei) | Dok. 1 und 2 |
| kanzlei@example.org | Empfängeradresse der E-Mail | Dok. 2. Die Rolle ist nicht näher bezeichnet. |

Kontaktdaten der Mandantin laut Dokument: Anschrift Lindenstraße 42, 50674\nKöln, Telefon 0221 4789123, E-Mail sabine.krueger-wendt@beispielmail.de, IBAN DE89 3704 0044\n0532 0130 00, Steuer-ID 47 036 892 815.

## 2. Daten mit Bedeutung

| Datum | Bedeutung | Quelle |
|---|---|---|
| 14.07.1983 | Geburtsdatum der Mandantin | Dok. 1 |
| 01.04.2015 | Beginn des Beschäftigungsverhältnisses | Dok. 1 |
| 03.11.2026 | Übergabe der ordentlichen Kündigung durch den Vorgesetzten. Die E-Mail der Mandantin trägt dasselbe Datum (18:12 Uhr, +0100). | Dok. 1 und 2 |
| 31.03.2027 | Beendigungstermin laut Kündigung | Dok. 1 |
| Frist nach § 4 KSchG | Klagefrist. Das Dokument nennt kein Fristende, die Berechnung ist laut Auftrag noch vorzunehmen. | Dok. 1 |

## 3. Beträge

| Betrag | Bedeutung | Quelle |
|---|---|---|
| 3.850,00 EUR | Bruttomonatsgehalt der Mandantin | Dok. 1 |

Außerdem ist angegeben: zwei unterhaltspflichtige Kinder (ohne Betragsangabe).

## 4. Offene Punkte

| Nr. | Offener Punkt | Quelle / Anmerkung |
|---|---|---|
| 1 | Klagefrist nach § 4 KSchG notieren. Das Fristende ist im Dokument nicht berechnet. | Auftrag in Dok. 1 |
| 2 | Klageentwurf vorbereiten | Auftrag in Dok. 1 |
| 3 | Anhörung des Betriebsrats: Nach Angaben der Mandantin erfolgte sie nicht. Das ist eine Angabe der Mandantin und nicht anderweitig belegt. | Dok. 1 |
| 4 | Zeugin Aylin Demirtaş: Ihre Aussage ist zur Kündigung „ohne Vorwarnung“ angegeben. Es ist nicht dokumentiert, dass sie bereits befragt wurde. | Dok. 1 und 2 |
| 5 | Identität von Frau Krüger-Wendt und Sabine Krüger-Wendt klären (siehe Tabelle 1) | Dok. 1 |

**Bewertung (1–5):** ___

### Modell B

*Platzh. offen 0 · 12 s · 898 Tokens aus*

# Übersicht – Kündigungsschutzklage (Entwurf, prüffähig)

## 1. Beteiligte mit Rolle

| Beteiligter | Rolle |
|---|---|
| Sabine Krüger-Wendt | Mandantin; Empfängerin der Kündigung (E-Mail-Absenderin) |
| Frau Krüger-Wendt | Beschäftigte als Disponentin bei der Rheinland Logistik\nHoffmann GmbH seit 01.04.2015 |
| Rheinland Logistik\nHoffmann GmbH | Arbeitgeberin (Kündigungsschuldnerin) |
| Herr\nDr. Matthias Oberländer | Vorgesetzter; überreichte die Kündigung am 03.11.2026 |
| Jürgen Pakulla | Betriebsratsvorsitzender |
| Aylin Demirtaş | Kollegin; Zeugin für „Kündigung ohne Vorwarnung"; laut E-Mail bei Übergabe anwesend |
| kanzlei@example.org | E-Mail-Empfänger (Kanzlei; Rolle nicht im Dokument benannt) – *unsicher* |

**Hinweis:** Der Zusammenhang zwischen Sabine Krüger-Wendt und Frau Krüger-Wendt ist nicht eindeutig benannt (vermutlich dieselbe Person bzw. Mandantin/Betroffene – *unklar, prüfen*).

## 2. Daten mit Bedeutung

| Datum | Bedeutung |
|---|---|
| 01.04.2015 | Beginn des Beschäftigungsverhältnisses |
| 03.11.2026 | Übergabe der ordentlichen Kündigung (auch Sendedatum der E-Mail, 18:12 Uhr) |
| 31.03.2027 | Beendigungsdatum des Arbeitsverhältnisses |
| – | Geburtsdatum: 14.07.1983 (personalbezogen) |
| – | Klagefrist § 4 KSchG: **3 Wochen ab Zugang der Kündigung** – Zugangsdatum (03.11.2026?) prüfen; Berechnung im Dokument nicht ausgeführt |

## 3. Beträge

| Betrag | Bedeutung |
|---|---|
| 3.850,00 EUR | Bruttomonatsgehalt |

## 4. Weitere Angaben

| Angabe | Bedeutung |
|---|---|
| Lindenstraße 42, 50674\nKöln | Anschrift Mandantin |
| 0221 4789123 | Telefonische Erreichbarkeit |
| sabine.krueger-wendt@beispielmail.de | E-Mail Mandantin |
| DE89 3704 0044\n0532 0130 00 | Bankverbindung |
| 47 036 892 815 | Steuer-ID |
| Zwei unterhaltspflichtige Kinder | Sozial/unterhaltsrelevant |

## 5. Offene Punkte

- Zugangsnachweis der Kündigung (Datum/Art der Übergabe) – maßgeblich für Fristberechnung § 4 KSchG.
- Betriebsratsanhörung: Nach Angaben der Mandantin nicht erfolgt (§ 102 BetrVG) – Beweis/Schriftform der Anhörung prüfen.
- Zeugin Aylin Demirtaş kontaktieren (Zeugnis „ohne Vorwarnung", Anwesenheit bei Übergabe).
- Klagefrist calendarmäßig berechnen und notieren (Auftrag im Dokument).
- Verhältnis Sabine Krüger-Wendt / Frau Krüger-Wendt klären.
- E-Mail-Empfänger kanzlei@example.org nicht identifiziert.
- Keine Angaben im Dokument zu: Kündigungsschutzanwendbarkeit (Betriebsgröße, Wartezeit geprüft ab 01.04.2015 erfüllt?), Schwerbehinderung, oder möglichen Abfindungsregelungen.

**Bewertung (1–5):** ___

### Modell C

*Platzh. offen 0 · 11 s · 1773 Tokens aus*

# Faktenübersicht

## Beteiligte und Rollen

| Platzhalter | Rolle laut Dokument | Fundstelle |
|---|---|---|
| Sabine Krüger-Wendt | Mandantin; Verfasserin der E-Mail; Kündigungsempfängerin | Gesprächsnotiz, EML |
| Frau Krüger-Wendt | Im Sachverhalt als seit 01.04.2015 bei der Arbeitgeberin beschäftigte Person bezeichnet (Verhältnis zu Sabine Krüger-Wendt im Dokument nicht ausdrücklich klargestellt) | Gesprächsnotiz |
| Rheinland Logistik\nHoffmann GmbH | Arbeitgeberin | Gesprächsnotiz |
| Herr\nDr. Matthias Oberländer | Vorgesetzter; überreichte die Kündigung | Gesprächsnotiz, EML |
| Jürgen Pakulla | Betriebsratsvorsitzender | Gesprächsnotiz |
| Aylin Demirtaş | Kollegin; Zeugin (war bei Kündigungsübergabe anwesend) | Gesprächsnotiz, EML |
| kanzlei@example.org | Empfänger der E-Mail der Mandantin (Rolle nicht bezeichnet) | EML |

## Daten und ihre Bedeutung

| Datum | Bedeutung | Fundstelle |
|---|---|---|
| 14.07.1983 | Geburtsdatum der Mandantin | Gesprächsnotiz |
| 01.04.2015 | Beschäftigungsbeginn bei der Rheinland Logistik\nHoffmann GmbH (bezogen auf Frau Krüger-Wendt) | Gesprächsnotiz |
| 03.11.2026 | Übergabe der ordentlichen Kündigung durch Herr\nDr. Matthias Oberländer | Gesprächsnotiz, EML |
| 03.11.2026, 18:12:00 +0100 | Datum/Uhrzeit der E-Mail „Kündigung erhalten“ | EML |
| 31.03.2027 | Beendigungszeitpunkt laut ordentlicher Kündigung | Gesprächsnotiz |

## Beträge

| Betrag | Bedeutung | Fundstelle |
|---|---|---|
| 3.850,00 EUR | Bruttomonatsgehalt | Gesprächsnotiz |

## Weitere Angaben (Kontakt-/Identifikationsdaten)

| Angabe | Wert | Fundstelle |
|---|---|---|
| Anschrift | Lindenstraße 42, 50674\nKöln | Gesprächsnotiz, EML |
| Telefon | 0221 4789123 | Gesprächsnotiz, EML |
| E-Mail | sabine.krueger-wendt@beispielmail.de | Gesprächsnotiz, EML |
| IBAN | DE89 3704 0044\n0532 0130 00 | Gesprächsnotiz |
| Steuer-ID | 47 036 892 815 | Gesprächsnotiz |
| Unterhaltspflicht | Zwei unterhaltspflichtige Kinder | Gesprächsnotiz |

## Offene Punkte

| Punkt | Stand im Dokument |
|---|---|
| Klagefrist nach § 4 KSchG | Vom Auftraggeber zu notieren; im Dokument keine Fristberechnung enthalten (Zugang der Kündigung: 03.11.2026) |
| Klageentwurf | Vorzubereiten (Auftrag im Dokument) |
| Identität Mandantin / beschäftigte Person | Gesprächsnotiz nennt als Mandantin Sabine Krüger-Wendt, im Sachverhalt wird Frau Krüger-Wendt als beschäftigt bezeichnet – Verhältnis nicht erläutert |
| Betriebsratsanhörung | Nach Angaben der Mandantin nicht erfolgt; Vorsitzender: Jürgen Pakulla |
| Zeugenaussage | Aylin Demirtaş kann bezeugen, dass die Kündigung ohne Vorwarnung erfolgte; war nach E-Mail bei Übergabe anwesend |
| Rolle des E-Mail-Empfängers | kanzlei@example.org – im Dokument nicht bezeichnet |

*Hinweis: Diese Übersicht ist ein Entwurf zur Prüfung durch eine Anwältin oder einen Anwalt. Die Angaben sind ausschließlich dem vorliegenden Dokument entnommen; insbesondere wurde keine Fristberechnung vorgenommen.*

**Bewertung (1–5):** ___

### Modell D

*Platzh. offen 0 · 138 s · 5400 Tokens aus*

# Faktenübersicht (Entwurf zur anwaltlichen Prüfung)

## 1. Beteiligte

| Platzhalter | Rolle | Anmerkungen |
|---|---|---|
| Sabine Krüger-Wendt | Mandantin; Arbeitnehmerin | Absenderin der E-Mail (Dokument 2) |
| Frau Krüger-Wendt | Beschäftigte bei Rheinland Logistik\nHoffmann GmbH als Disponentin | *Unsicherheit: Text legt nahe, dass dies dieselbe Person wie Sabine Krüger-Wendt ist (Mandantin = Disponentin); Platzhalter sind jedoch verschieden* |
| Rheinland Logistik\nHoffmann GmbH | Arbeitgeberin | |
| Herr\nDr. Matthias Oberländer | Vorgesetzter der Mandantin | Überreichte die Kündigung am 03.11.2026 |
| Jürgen Pakulla | Vorsitzender des Betriebsrats | |
| Aylin Demirtaş | Kollegin der Mandantin | Zeugin; war bei der Übergabe der Kündigung dabei |
| kanzlei@example.org | Empfänger der E-Mail (Dokument 2) | *Unsicherheit: Konkrete Zuordnung (z. B. Kanzlei-Adresse) nicht explizit im Text genannt* |

## 2. Daten

| Angabe | Bedeutung / Kontext |
|---|---|
| 01.04.2015 | Beginn der Beschäftigung bei Rheinland Logistik\nHoffmann GmbH |
| 03.11.2026 | Datum der Übergabe der ordentlichen Kündigung durch Herr\nDr. Matthias Oberländer |
| 03.11.2026, 18:12:00 +0100 | Zeitstempel des E-Mail-Versands (Dokument 2) |
| 31.03.2027 | Beendigungsdatum der ordentlichen Kündigung |
| 14.07.1983 | Geburtsdatum der Mandantin Sabine Krüger-Wendt |
| Lindenstraße 42, 50674\nKöln | Wohnadresse der Mandantin Sabine Krüger-Wendt |
| 0221 4789123 | Telefonnummer der Mandantin Sabine Krüger-Wendt |
| sabine.krueger-wendt@beispielmail.de | E-Mail-Adresse der Mandantin Sabine Krüger-Wendt |
| DE89 3704 0044\n0532 0130 00 | IBAN der Mandantin Sabine Krüger-Wendt |
| 47 036 892 815 | Steuer-ID der Mandantin Sabine Krüger-Wendt |
| 2 | Anzahl unterhaltspflichtiger Kinder der Mandantin |

## 3. Beträge

| Betrag | Bedeutung |
|---|---|
| 3.850,00 EUR | Bruttomonatsgehalt der Mandantin |

## 4. Offene Punkte / Zu prüfende Umstände

| Punkt | Quelle / Anmerkung |
|---|---|
| Klagefrist gemäß § 4 KSchG | Auftrag aus Dokument 1: Frist zu notieren und Klageentwurf vorzubereiten |
| Betriebsratsanhörung | Nach Angaben der Mandantin nicht erfolgt (Vorsitzender: Jürgen Pakulla) |
| Fehlende Vorwarnung | Laut Aussage der Kollegin Aylin Demirtaş erfolgte die Kündigung ohne Vorwarnung |
| Unterhaltspflichten | Zwei unterhaltspflichtige Kinder (ggf. relevant für die Sozialauswahl) |

---

*Hinweis: Dieser Entwurf wurde maschinell erstellt und dient ausschließlich der Vorbereitung durch eine Anwältin oder einen Anwalt. Alle Platzhalter wurden exakt und unverändert aus dem Ausgangstext übernommen.*

**Bewertung (1–5):** ___

### Modell E

*Platzh. offen 0 · 29 s · 2620 Tokens aus*

# Faktenübersicht: Kündigungsschutzsache Sabine Krüger-Wendt

## Beteiligte mit Rolle

| Platzhalter | Rolle | Quelle | Anmerkung |
|---|---|---|---|
| Sabine Krüger-Wendt | Mandantin; Absenderin der E-Mail vom 03.11.2026 | Dok. 1, Dok. 2 | geb. 14.07.1983, wohnhaft Lindenstraße 42, 50674\nKöln |
| Frau Krüger-Wendt | Arbeitnehmerin (Disponentin) bei Rheinland Logistik\nHoffmann GmbH, Kündigungsempfängerin | Dok. 1 | ⚠️ Vermutlich identisch mit Sabine Krüger-Wendt, denn der Sachverhalt bezieht sich durchgehend auf „ihr“ bzw. „die Mandantin“. Der Platzhalter ist aber ein anderer, daher bitte prüfen. |
| Rheinland Logistik\nHoffmann GmbH | Arbeitgeberin, kündigende Partei | Dok. 1 | |
| Herr\nDr. Matthias Oberländer | Vorgesetzter; hat die Kündigung überreicht | Dok. 1, Dok. 2 | |
| Jürgen Pakulla | Betriebsratsvorsitzender | Dok. 1 | Betriebsrat wurde laut Mandantin nicht angehört |
| Aylin Demirtaş | Kollegin, mögliche Zeugin | Dok. 1, Dok. 2 | Soll bezeugen können, dass die Kündigung ohne Vorwarnung erfolgte. Laut E-Mail war sie bei der Übergabe dabei. |
| kanzlei@example.org | Empfänger der E-Mail (vermutlich die Kanzlei) | Dok. 2 | „Sehr geehrte Damen und Herren“; die Zuordnung ist nicht ausdrücklich genannt |

## Kontakt- und Identifikationsdaten der Mandantin

| Angabe | Wert |
|---|---|
| Anschrift | Lindenstraße 42, 50674\nKöln |
| Telefon | 0221 4789123 |
| E-Mail | sabine.krueger-wendt@beispielmail.de |
| IBAN | DE89 3704 0044\n0532 0130 00 |
| Steuer-ID | 47 036 892 815 |

## Daten mit Bedeutung

| Datum | Bedeutung | Quelle |
|---|---|---|
| 14.07.1983 | Geburtsdatum der Mandantin | Dok. 1 |
| 01.04.2015 | Beginn des Arbeitsverhältnisses als Disponentin | Dok. 1 |
| 03.11.2026 | Übergabe der ordentlichen Kündigung durch Herr\nDr. Matthias Oberländer | Dok. 1; Dok. 2 („heute“) |
| 03.11.2026, 18:12 Uhr (+0100) | E-Mail der Mandantin „Kündigung erhalten“ | Dok. 2 |
| 31.03.2027 | Kündigungstermin (Ende des Arbeitsverhältnisses laut Kündigung) | Dok. 1 |

## Beträge

| Betrag | Bezeichnung | Quelle |
|---|---|---|
| 3.850,00 EUR | Bruttomonatsgehalt | Dok. 1 |

## Sonstige Fakten

| Fakt | Quelle |
|---|---|
| Art der Kündigung: ordentlich | Dok. 1 |
| Zwei unterhaltspflichtige Kinder | Dok. 1 |
| Betriebsrat laut Angaben der Mandantin nicht angehört | Dok. 1 |
| Kündigung erfolgte laut Mandantin ohne Vorwarnung | Dok. 1 |

## Offene Punkte

| Nr. | Punkt | Hinweis |
|---|---|---|
| 1 | Klagefrist nach § 4 KSchG notieren | Auftrag laut Dok. 1. Das Dokument nennt kein Fristende. Rechnerisch ergibt sich bei Zugang am 03.11.2026 und drei Wochen Frist der **24.11.2026**. ⚠️ Das ist eine eigene Berechnung und muss anwaltlich geprüft werden, insbesondere der Zugangszeitpunkt. |
| 2 | Klageentwurf vorbereiten | Auftrag laut Dok. 1 |
| 3 | Identität Frau Krüger-Wendt / Sabine Krüger-Wendt klären | Unterschiedliche Platzhalter im Sachverhalt bzw. bei der Mandantin |
| 4 | Fehlende Betriebsratsanhörung | Beruht nur auf Angaben der Mandantin; nicht weiter belegt |
| 5 | Aussageinhalt der Zeugin Aylin Demirtaş | In Dok. 1 „ohne Vorwarnung“, in Dok. 2 „war dabei“; Umfang der Wahrnehmungen noch nicht näher festgehalten |
| 6 | Kündigungsschreiben selbst | Liegt nicht vor; Inhalt und Form sind nicht dokumentiert |

*Entwurf zur Prüfung durch eine Anwältin oder einen Anwalt.*

**Bewertung (1–5):** ___

## Sachstand (zusammenfassen)

> Auftrag: Fasse den Sachstand für die Akte in höchstens acht Sätzen zusammen und nenne das Ende der Klagefrist nach § 4 KSchG. Die Kündigung wurde der Mandantin am 03.11.2026 persönlich übergeben.

### Modell A

*Frist ✓ · Platzh. offen 0 · 29 s · 2041 Tokens aus*

## Entwurf Sachstand (zur anwaltlichen Prüfung)

**Tatsachen (laut Gesprächsnotiz und E-Mail, soweit nicht anders gekennzeichnet)**
1. Die Mandantin Sabine Krüger-Wendt (in der Notiz im Sachverhalt als Frau Krüger-Wendt bezeichnet; die Identität ist nicht ausdrücklich bestätigt) ist seit dem 01.04.2015 bei der Rheinland Logistik\nHoffmann GmbH als Disponentin beschäftigt, bei einem Bruttomonatsgehalt von 3.850,00 EUR und zwei unterhaltspflichtigen Kindern.
2. Ihr Vorgesetzter Herr\ndr. Matthias Oberländer übergab ihr am 03.11.2026 persönlich die ordentliche Kündigung zum 31.03.2027.

**Behauptungen der Mandantin (nicht belegt)**
3. Der Betriebsrat (Vorsitzender: Jürgen Pakulla) sei nach ihren Angaben nicht angehört worden.
4. Die Kündigung sei „ohne Vorwarnung“ erfolgt, was die Kollegin Aylin Demirtaş bezeugen könne. Laut E-Mail war sie bei der Übergabe anwesend.

**Offen**
5. Das Kündigungsschreiben, der Kündigungsgrund, die Betriebsgröße (Anwendbarkeit des KSchG) und die Sicht der Arbeitgeberin liegen nicht vor.

**Klagefrist (§ 4 KSchG)**
6. Die Klage ist innerhalb von drei Wochen nach Zugang der Kündigung zu erheben. Bei Zugang am 03.11.2026 (Dienstag) endet die Frist nach §§ 187 Abs. 1, 188 Abs. 2 BGB am **Dienstag, 24.11.2026**, 24:00 Uhr. Ein Feiertag, der die Frist verschieben würde, ist nicht ersichtlich.
7. Die Klage muss bis dahin beim Arbeitsgericht eingegangen sein. Der Zugangstag sollte anhand des Kündigungsschreibens und der E-Mail vom 03.11.2026 bestätigt und eine Vorfrist notiert werden.

**Bewertung (1–5):** ___

### Modell B

*Frist ✓ · Platzh. offen 0 · 17 s · 409 Tokens aus*

## Sachstand

- Frau Krüger-Wendt ist seit 01.04.2015 als Disponentin bei der Rheinland Logistik\nHoffmann GmbH beschäftigt.
- Am 03.11.2026 überreichte ihr Vorgesetzter Herr\nDr. Matthias Oberländer persönlich die ordentliche Kündigung zum 31.03.2027 (Tatsache; Übermittlung am 03.11.2026 auch durch E-Mail der Mandantin vom selben Tag bestätigt).
- Bruttomonatsgehalt: 3.850,00 EUR; zwei unterhaltspflichtige Kinder.
- Nach **Angabe der Mandantin** (Behauptung) wurde der Betriebsrat (Vorsitzender: Jürgen Pakulla) nicht angehört.
- Kollegin Aylin Demirtaş soll bezeugen, dass die Kündigung ohne Vorwarnung erfolgte (Angabe der Mandantin; noch nicht geprüft).
- Auftrag: Klagefrist notieren und Klageentwurf vorbereiten.

**Klagefrist § 4 KSchG:** Die Kündigungsschutzklage muss innerhalb von **drei Wochen** nach Zugang der Kündigung erhoben werden. Bei Zugang am **03.11.2026** endet die Klagefrist somit am **Dienstag, den 24.11.2026** (Tag des Zugangs nicht mitgerechnet; Fristende lt. Berechnung: 03.11. + 3 Wochen). Die fristgerechte Erhebung der Klage ist dringend zu prüfen.

*Hinweis: Berechnung zur Prüfung; bitte verifizieren, ob es sich um einen Kleinbetrieb (§ 1 Abs. 2 KSchG) bzw. ob das Kündigungsschutzgesetz anwendbar ist.*

**Bewertung (1–5):** ___

### Modell C

*Frist ✓ · Platzh. offen 0 · 17 s · 1850 Tokens aus*

## Sachstand (Entwurf zur anwaltlichen Prüfung)

1. Die Mandantin Sabine Krüger-Wendt ist seit dem 01.04.2015 bei der Rheinland Logistik\nHoffmann GmbH als Disponentin beschäftigt; ihr Bruttomonatsgehalt beträgt 3.850,00 EUR, sie hat zwei unterhaltspflichtige Kinder.
2. Am 03.11.2026 übergab ihr Vorgesetzter Herr\nDr. Matthias Oberländer ihr persönlich eine ordentliche Kündigung zum 31.03.2027; die Übergabe ist durch die E-Mail der Mandantin vom selben Tag (18:12 Uhr) dokumentiert.
3. Nach Angaben der Mandantin – also bislang als Behauptung, nicht als erwiesene Tatsache – wurde der Betriebsrat (Vorsitzender: Jürgen Pakulla) vor Ausspruch der Kündigung nicht angehört.
4. Die Mandantin behauptet weiter, die Kündigung sei ohne Vorwarnung erfolgt, und benennt hierfür ihre Kollegin Aylin Demirtaş als Zeugin, die bei der Übergabe anwesend war.
5. Auftragsgemäß ist ein Klageentwurf vorzubereiten; die Klagefrist ist zu notieren und zu überwachen.

## Klagefrist nach § 4 KSchG

- Zugang der Kündigung: **03.11.2026** (persönliche Übergabe)
- Fristbeginn: 04.11.2026 (§ 187 Abs. 1 BGB)
- **Fristende: Dienstag, 24.11.2026, 24:00 Uhr** (§ 188 Abs. 2 BGB; drei Wochen)

Hinweis: Es handelt sich um eine Notfrist; eine Verspätung führt zur Fiktion der Wirksamkeit der Kündigung (§ 7 KSchG). Das Fristende ist nach h. M. nicht wegen § 193 BGB verschiebbar. Bitte Fristeintragung und Vorfrist (z. B. 17.11.2026) veranlassen.

*Unsicherheiten:* Das Zugangsdatum stützt sich auf die Angaben der Mandantin (Gesprächsnotiz und E-Mail stimmen überein); eine Zustellungsbestätigung liegt nicht vor. Die Angaben zum Betriebsrat und zum Ablauf der Übergabe sind derzeit ungeprüfte Behauptungen der Mandantin.

**Bewertung (1–5):** ___

### Modell D

*Frist ✗ · Platzh. offen 0 · 110 s · 4468 Tokens aus*

**Entwurf zur Prüfung durch die Anwältin/den Anwalt**

**Sachstand:**
Tatsachen: Sabine Krüger-Wendt ist seit dem 01.04.2015 bei der Rheinland Logistik\nHoffmann GmbH als Disponentin beschäftigt (Bruttomonatsgehalt: 3.850,00 EUR; zwei unterhaltspflichtige Kinder). Am 03.11.2026 wurde ihr von ihrem Vorgesetzten Herr\nDr. Matthias Oberländer eine ordentliche Kündigung zum 31.03.2027 persönlich übergeben, was die Mandantin noch am selben Tag per E-Mail bestätigte.

Behauptungen der Mandantin: Sie gibt an, dass der Betriebsrat (Vorsitzender Jürgen Pakulla) vor Ausspruch der Kündigung nicht angehört wurde und die Kündigung ohne Vorwarnung erfolgte; die Kollegin Aylin Demirtaş, die bei der Übergabe anwesend gewesen sein soll, könne dies bezeugen.

**Klagefrist nach § 4 KSchG:**
Die Klagefrist endet am **25. November 2026** (drei Wochen nach Zugang der Kündigung am 03.11.2026; beginnt am 04.11.2026). *Hinweis:* Fällt der 25.11.2026 auf einen Sonn- oder gesetzlichen Feiertag (z. B. Buß- und Bettag in Sachsen), verlängert sich die Frist auf den nächsten Werktag (dann 26.11.2026).

**Bewertung (1–5):** ___

### Modell E

*Frist ✓ · Platzh. offen 0 · 29 s · 1698 Tokens aus*

# Sachstand Kündigungsschutzsache Sabine Krüger-Wendt

## Zusammenfassung

**Tatsachen (laut Unterlagen):**
1. Die Mandantin Sabine Krüger-Wendt ist nach der Gesprächsnotiz seit dem 01.04.2015 als Disponentin bei der Rheinland Logistik\nHoffmann GmbH beschäftigt. Die Notiz nennt an dieser Stelle Frau Krüger-Wendt. Aus dem Kontext ist vermutlich die Mandantin gemeint, das ist aber nicht eindeutig belegt.
2. Am 03.11.2026 überreichte ihr Vorgesetzter Herr\nDr. Matthias Oberländer ihr persönlich die ordentliche Kündigung zum 31.03.2027. Das bestätigt auch ihre E-Mail an die Kanzlei vom selben Tag, 18:12 Uhr.
3. Die Mandantin erhält ein Bruttomonatsgehalt von 3.850,00 EUR und hat zwei unterhaltspflichtige Kinder.

**Behauptungen der Mandantin:**
4. Der Betriebsrat (Vorsitzender: Jürgen Pakulla) sei vor der Kündigung nicht angehört worden. Dies wäre ein möglicher Unwirksamkeitsgrund nach § 102 Abs. 1 BGB i. V. m. BetrVG und ist noch zu prüfen.
5. Die Kündigung sei ohne Vorwarnung erfolgt. Als Zeugin benennt sie ihre Kollegin Aylin Demirtaş, die laut E-Mail bei der Übergabe anwesend war.

**Auftrag:**
6. Die Klagefrist ist zu notieren und ein Klageentwurf vorzubereiten.

## Klagefrist nach § 4 KSchG

| Punkt | Angabe |
|---|---|
| Zugang der Kündigung | 03.11.2026 (Dienstag), persönliche Übergabe |
| Fristberechnung | 3 Wochen, §§ 187 Abs. 1, 188 Abs. 2 BGB |
| **Fristende** | **Dienstag, 24.11.2026, 24:00 Uhr** |

Das Fristende fällt auf einen Werktag, § 193 BGB greift daher nicht. **Empfehlung:** Vorfrist notieren und die Klage deutlich vor dem 24.11.2026 einreichen.

## Prüfhinweise (Entwurf, bitte anwaltlich prüfen)

- **Betriebsratsanhörung:** Die Angabe beruht allein auf der Aussage der Mandantin. Im Prozess trägt der Arbeitgeber die Darlegungslast für eine ordnungsgemäße Anhörung.
- **Kündigungsfrist:** Bei rund 11,5 Jahren Betriebszugehörigkeit gilt nach § 622 Abs. 2 Nr. 4 BGB eine Frist von 4 Monaten zum Monatsende. Der Termin 31.03.2027 erscheint damit eingehalten, vorbehaltlich eines Tarif- oder Arbeitsvertrags.
- **Schriftform (§ 623 BGB):** Das Original des Kündigungsschreibens sollte angefordert werden, um Unterschrift und Vertretungsbefugnis zu prüfen.
- **Zuordnung der Platzhalter:** Ob Frau Krüger-Wendt und Sabine Krüger-Wendt dieselbe Person bezeichnen, sollte kurz verifiziert werden.

**Bewertung (1–5):** ___

## Mandantenbrief (mandantenbrief)

> Auftrag: Schreibe der Mandantin einen kurzen Brief: was wir jetzt tun, bis wann die Klage spätestens eingereicht sein muss und welche Unterlagen sie uns schicken soll. Die Kündigung wurde der Mandantin am 03.11.2026 persönlich übergeben.

### Modell A

*Frist ✓ · Platzh. offen 0 · 37 s · 3278 Tokens aus*

# Entwurf: Brief an die Mandantin

*Zur Prüfung durch die zuständige Anwältin bzw. den zuständigen Anwalt. Unsicherheiten stehen am Ende.*

---

Sabine Krüger-Wendt
Lindenstraße 42, 50674\nKöln

Datum: [bitte ergänzen]

**Ihre Kündigung vom 03.11.2026: unsere nächsten Schritte**

Sehr geehrte Frau Sabine Krüger-Wendt,

vielen Dank für Ihre Nachricht und das Gespräch. Wir können gut nachvollziehen, dass die Kündigung ein Schock für Sie ist. Wir kümmern uns darum und sagen Ihnen hier, wie es weitergeht.

**Das Wichtigste: die Frist**

Gegen eine Kündigung können Sie sich nur innerhalb von **drei Wochen** wehren. Die Frist beginnt mit dem Tag, an dem Sie die Kündigung erhalten haben. Das war der 03.11.2026.

**Die Klage muss deshalb spätestens am Dienstag, 24.11.2026, beim Arbeitsgericht eingegangen sein.**

Wird die Frist versäumt, gilt die Kündigung in aller Regel als wirksam, selbst wenn sie Fehler hat. Wir planen deshalb mit einem deutlichen Puffer und wollen die Klage **deutlich vor dem 24.11.2026** einreichen.

**Was wir jetzt tun**

1. Wir prüfen die Kündigung, insbesondere ob der Betriebsrat vor der Kündigung ordnungsgemäß beteiligt wurde. Sie haben uns mitgeteilt, dass das nicht geschehen ist.
2. Wir bereiten die Kündigungsschutzklage vor und reichen sie fristgerecht beim Arbeitsgericht ein.
3. Wir prüfen, ob Ihre Kollegin Aylin Demirtaş als Zeugin in Betracht kommt.
4. Wir informieren Sie, sobald das Gericht einen Termin bestimmt hat.

**Was wir von Ihnen brauchen**

Bitte schicken Sie uns **bis zum [Datum ergänzen, Vorschlag: 10.11.2026]** folgende Unterlagen, gern als Scan oder gut lesbares Foto per E-Mail:

- das **Kündigungsschreiben** (bitte das Original gut aufbewahren und nicht verändern, z. B. durch Anmerkungen)
- Ihren **Arbeitsvertrag** mit allen Änderungen und Zusatzvereinbarungen
- Ihre **letzten drei Gehaltsabrechnungen**
- eventuelle **Abmahnungen** oder andere Schreiben des Arbeitgebers zu Ihrem Verhalten oder Ihrer Leistung
- Angaben zu einer **Rechtsschutzversicherung**, falls vorhanden (Versicherung und Versicherungsnummer)
- die **Kontaktdaten** Ihrer Kollegin Aylin Demirtaş, falls wir sie noch nicht haben
- eine kurze **schriftliche Schilderung**, wie die Übergabe der Kündigung am 03.11.2026 ablief (wer war dabei, was wurde gesagt)

**Das sollten Sie jetzt beachten**

- **Unterschreiben Sie nichts**, was Ihnen der Arbeitgeber vorlegt, etwa einen Aufhebungsvertrag oder eine Bestätigung, ohne sich vorher mit uns abzustimmen.
- Bitte **melden Sie sich bei der Agentur für Arbeit arbeitsuchend**. Das ist auch dann wichtig, wenn Sie gegen die Kündigung vorgehen. Die Meldung muss spätestens drei Monate vor dem Ende des Arbeitsverhältnisses erfolgen, also bis zum 31.12.2026. Wir empfehlen, sie möglichst bald zu erledigen, damit Ihnen später keine Nachteile entstehen.
- Arbeiten Sie bis zum Ende der Kündigungsfrist wie gewohnt weiter, sofern Sie nicht freigestellt werden.

Wenn Sie Fragen haben oder etwas unklar ist, rufen Sie uns jederzeit an.

Mit freundlichen Grüßen

[Name der Anwältin / des Anwalts und Kanzlei ergänzen]

---

## Hinweise an die prüfende Anwältin / den prüfenden Anwalt

- **Fristberechnung:** Zugang am 03.11.2026 (Dienstag, persönliche Übergabe). Nach § 4 KSchG i. V. m. § 187 Abs. 1, § 188 Abs. 2 BGB endet die Frist am Dienstag, 24.11.2026, 24:00 Uhr. Das ist ein Werktag, eine Verlängerung nach § 193 BGB greift nicht. Bitte prüfen. Für den Zugang habe ich allein die Angaben der Mandantin und der Gesprächsnotiz zugrunde gelegt.
- **Name der Mandantin:** In der Gesprächsnotiz erscheint im Sachverhalt der Platzhalter Frau Krüger-Wendt, in der Kopfzeile und in der E-Mail Sabine Krüger-Wendt. Ich habe Sabine Krüger-Wendt verwendet. Ob beide Platzhalter dieselbe Person meinen, geht aus dem Text nicht eindeutig hervor.
- **Wartezeit und Betriebsgröße:** Das Arbeitsverhältnis besteht seit 01.04.2015, die Wartezeit ist also erfüllt. Die Anwendbarkeit des KSchG (Betriebsgröße, § 23 KSchG) ist aus den Unterlagen nicht ersichtlich und noch zu klären.
- **Meldung bei der Agentur für Arbeit:** Die Angabe „bis 31.12.2026“ (§ 38 SGB III, drei Monate vor Beendigung zum 31.03.2027) bitte gegenprüfen. Die Empfehlung, sich früher zu melden, ist bewusst vorsichtig formuliert.
- **Interne Frist für die Unterlagen:** Der Vorschlag 10.11.2026 ist ein Platzhalter. Bitte anpassen.
- **Datenschutz:** Der Brief enthält bewusst keine Angaben zu Steuer-ID, Bankverbindung, Gehalt oder Geburtsdatum.

**Bewertung (1–5):** ___

### Modell B

*Frist ✓ · Platzh. offen 1 · 28 s · 953 Tokens aus*

# Entwurf Mandantin

Sehr geehrte Frau Sabine Krüger-Wendt (**Entwurf – bitte prüfen**),

vielen Dank für Ihr Vertrauen und die schnelle Rückmeldung nach der Übergabe der Kündigung am 03.11.2026. Wir haben Ihr Mandat übernommen und bereiten nun die Kündigungsschutzklage gegen die Rheinland Logistik\nHoffmann GmbH vor.

## Was wir jetzt tun
- Wir prüfen die Rechtmäßigkeit der Kündigung und erstellen den Klageentwurf.
- Danach legen wir die Klage beim zuständigen Arbeitsgericht ein.

## Wichtig: Die Frist
Die Klage muss spätestens **Dienstag, den 24.11.2026** beim Arbeitsgericht eingehen (drei Wochen nach Zugang der Kündigung am 03.11.2026). Verstreicht diese Frist, ist die Kündigung in der Regel unwiderruflich wirksam – selbst wenn sie falsch wäre. **Damit Ihnen keine Zeit verloren geht, werden wir die Klage rechtzeitig vorher einreichen.**

## Was wir von Ihnen benötigen
Bitte senden Sie uns bis **spätestens 18.11.2026** (bzw. so bald wie möglich) folgende Unterlagen:

1. Die **Kündigung** (Original oder Kopie des Schreibens, das Ihnen übergeben wurde)
2. Ihren **Arbeitsvertrag** sowie ggf. Änderungen oder Zusatzvereinbarungen
3. Die letzten **drei Gehaltsabrechnungen** (Lohnzettel)
4. Ggf. **Ausschöpfungsbescheinigung** der Agentur für Arbeit (falls Sie diese bereits erhalten haben – für den Abfindungsanspruch nach § 1a KSchG, den wir gerne mit Ihnen besprechen)
5. Ihre **Steuer-Identifikationsnummer** (47 036 892 815) – liegt uns bereits vor
6. Ggf. weitere **Unterlagen**, die für Ihren Fall wichtig sein könnten (z. B. Zeugnisse, E-Mails, Zeugenkontaktdaten)

## Zeugen
Ihre Kollegin Aylin Demirtaş hat die Übergabe der Kündigung mitbekommen und kann bezeugen, dass die Kündigung ohne Vorwarnung erfolgte. Bitte halten Sie sie bereit – wir melden uns ggf. mit konkreten Fragen dazu. Auch die Tatsache, dass der Betriebsrat (Vorsitzender: Jürgen Pakulla) nach Ihrer Angabe nicht angehört wurde, prüfen wir.

## Nächste Schritte
1. **Sie:** Senden Sie uns die oben genannten Unterlagen, bitte mit Angabe Ihrer telefonischen Erreichbarkeit unter 0221 4789123.
2. **Wir:** Vervollständigen die Akte und erstellen den Klageentwurf.
3. **Wir:** Reichen die Klage fristgerecht (spätestens am 24.11.2026) ein und teilen Ihnen das Aktenzeichen mit.
4. **Gericht:** Das Arbeitsgericht lädt anschließend zu einem **Gütetermin** ein – dazu erhalten Sie eine Ladung mit Datum und Ort. Bitte nehmen Sie sich Zeit dafür.

Sollten Sie Fragen haben oder Unterlagen nicht finden können, melden Sie sich gerne jederzeit.

Mit freundlichen Grüßen

[[Name Anwältin/Anwalt – bitte ergänzen]]

---

*Hinweis für die Kanzlei (nicht Teil des Briefs):*
- Fristberechnung: Zugang am 03.11.2026 → Fristablauf 24.11.2026 (Di), da der 21.11.2026 (Sa) ein Samstag ist. **Bitte verifizieren.**
- Prüfen: Betriebsrat-Anhörung (§ 102 BetrVG) könnte Einrede begründen; Zeugin Aylin Demirtaş ggf. im Gütetermin vorladen.
- Bitte Mandantin auch auf schriftliche Klageantragstellung und ggf. Prozesskostenhilfe ansprechen.

Bitte prüfen Sie den Entwurf vor Versand – insbesondere Fristen, Formulierungen und die Zuständigkeit des Arbeitsgerichts.

**Bewertung (1–5):** ___

### Modell C

*Frist ✓ · Platzh. offen 0 · 21 s · 1491 Tokens aus*

# Entwurf – Brief an die Mandantin

**Betreff: Ihre Kündigung vom 03.11.2026 – Klagefrist und nächste Schritte**

Sehr geehrte Frau Sabine Krüger-Wendt,

vielen Dank für Ihre Nachricht und das Gespräch. Wir haben den Vorgang aufgenommen und fassen hier für Sie zusammen, was jetzt passiert.

**Das Wichtigste zuerst: Es gibt eine gesetzliche Frist.**
Gegen eine Kündigung muss innerhalb von **drei Wochen** nach Erhalt Klage beim Arbeitsgericht erhoben werden. Diese Frist kann nicht verlängert werden. Da Ihnen die Kündigung am **03.11.2026** persönlich übergeben wurde, läuft die Frist am **24.11.2026** ab. Bis zu diesem Tag muss die Klage spätestens beim Arbeitsgericht eingegangen sein. Wir werden die Klage rechtzeitig vorher für Sie einreichen und Sie selbst müssen dabei nichts veranlassen. Bitte beachten Sie aber: Sollte sich der Zugangszeitpunkt wider Erwarten anders darstellen, sagen Sie uns bitte umgehend Bescheid – die Fristberechnung prüfen wir dann erneut.

**Was wir jetzt tun:**
Wir bereiten die Klage vor und reichen sie fristgerecht beim zuständigen Arbeitsgericht ein. Dabei gehen wir unter anderem dem von Ihnen geschilderten Punkt nach, dass der Betriebsrat vor der Kündigung nicht beteiligt worden sein soll. Sobald die Klage eingereicht ist, informieren wir Sie und erklären Ihnen das weitere Verfahren.

**Was wir von Ihnen brauchen – bitte möglichst zeitnah:**
1. Das **Kündigungsschreiben** selbst (Original oder gut lesbarer Scan/Foto, gern mit Umschlag, falls vorhanden).
2. Ihren **Arbeitsvertrag** sowie alle späteren Änderungen oder Zusatzvereinbarungen.
3. Ihre **letzten drei Gehaltsabrechnungen**.
4. Die **Kontaktdaten Ihrer Kollegin Aylin Demirtaş** (Telefon oder E-Mail), damit wir sie als Zeugin erreichen können.
5. Falls vorhanden: **Schriftverkehr** mit Ihrem Arbeitgeber oder dem Betriebsrat zur Kündigung.

Sie können uns die Unterlagen per E-Mail an kanzlei@example.org oder per Post an unsere Kanzlei senden. Sollten Sie einzelne Unterlagen nicht zur Hand haben, genügt zunächst ein kurzer Hinweis – wir besprechen dann das Vorgehen.

Bei Fragen erreichen Sie uns jederzeit unter den Ihnen bekannten Kontaktdaten. Wir melden uns wieder bei Ihnen, sobald die Klage eingereicht ist.

Mit freundlichen Grüßen

Helena
im Auftrag der Kanzlei

---

*Hinweis für die Anwältin/den Anwalt: Die Fristberechnung (§§ 187 Abs. 1, 188 Abs. 2 BGB i. V. m. § 4 Satz 1 KSchG) ergibt bei Zugang am 03.11.2026 einen Fristablauf am 24.11.2026 (Dienstag, Werktag). Bitte vor Versand prüfen, ob die Klage ausnahmsweise als bestimmender Schriftsatz vorab per Fax oder besonderem elektronischem Weg einzureichen ist. Die Angaben zur fehlenden Betriebsratsanhörung stützen sich bislang nur auf die Schilderung der Mandantin.*

**Bewertung (1–5):** ___

### Modell D

*Frist ✓ · Platzh. offen 0 · 82 s · 4607 Tokens aus*

Sabine Krüger-Wendt
Lindenstraße 42, 50674\nKöln

**Betreff: Ihre Kündigung vom 03.11.2026 – Wichtige Frist bis 24.11.2026 und nächste Schritte**

Sehr geehrte Frau Sabine Krüger-Wendt,

vielen Dank für Ihre Nachricht vom 03.11.2026. Wir haben zur Kenntnis genommen, dass Ihnen Herr\nDr. Matthias Oberländer von der Rheinland Logistik\nHoffmann GmbH am 03.11.2026 eine Kündigung zum 31.03.2027 persönlich überreicht hat.

**Das Wichtigste zuerst – die Frist:**
Damit wir gegen die Kündigung vorgehen können, müssen wir spätestens bis zum **24. November 2026** Klage beim Arbeitsgericht einreichen. Diese Frist beträgt drei Wochen ab dem Tag, an dem Ihnen die Kündigung übergeben wurde (03.11.2026), und kann nicht verlängert werden. Wir sorgen dafür, dass die Klage rechtzeitig eingereicht wird.

**Was wir jetzt für Sie tun:**
Wir bereiten die Klage für Sie vor. Dabei prüfen wir unter anderem, ob der Betriebsrat vor der Kündigung ordnungsgemäß angehört wurde – nach Ihren Angaben war das nicht der Fall, was die Kündigung möglicherweise unwirksam machen könnte. Außerdem bereiten wir die Aussage Ihrer Kollegin Aylin Demirtaş als Zeugin vor.

**Welche Unterlagen Sie uns bitte schicken:**
Bitte senden Sie uns folgende Unterlagen, gerne per E-Mail an kanzlei@example.org:

*   Das Kündigungsschreiben im Original
*   Ihren Arbeitsvertrag
*   Die letzten drei Gehaltsabrechnungen
*   Alle weiteren Schreiben, die Sie von der Rheinland Logistik\nHoffmann GmbH erhalten haben
*   Die Kontaktdaten von Aylin Demirtaş (vollständiger Name, Adresse, Telefonnummer), damit wir sie als Zeugin einbeziehen können

**Nächste Schritte:**
Sobald wir Ihre Unterlagen erhalten haben, melden wir uns bei Ihnen unter 0221 4789123 oder per E-Mail an sabine.krueger-wendt@beispielmail.de, um einen Termin für ein persönliches Gespräch zu vereinbaren. In diesem Gespräch besprechen wir alle Details, und Sie unterschreiben die fertige Klage.

Bei Fragen erreichen Sie uns jederzeit telefonisch oder per E-Mail.

Mit freundlichen Grüßen

Helena
[Ihre Anwaltskanzlei]

---

*Hinweis: Dies ist ein Entwurf zur Prüfung durch die zuständige Anwältin bzw. den zuständigen Anwalt. Die Fristberechnung (24.11.2026) basiert auf der persönlichen Übergabe der Kündigung am 03.11.2026 gemäß Ihren Angaben.*

**Bewertung (1–5):** ___

### Modell E

*Frist ✓ · Platzh. offen 0 · 47 s · 3546 Tokens aus*

# Entwurf: Schreiben an die Mandantin

**An:** Sabine Krüger-Wendt
Lindenstraße 42, 50674\nKöln

**Per E-Mail:** sabine.krueger-wendt@beispielmail.de

**Ihre Kündigung durch die Rheinland Logistik\nHoffmann GmbH: Wie es jetzt weitergeht**

Sehr geehrte Frau Frau Krüger-Wendt,

vielen Dank für Ihr Vertrauen und Ihre Nachricht vom 03.11.2026. Wir wissen, dass eine Kündigung nach so vielen Jahren im Betrieb belastend ist. Wir kümmern uns jetzt darum, dass Ihre Rechte gewahrt bleiben.

## Das Wichtigste vorab: die Frist

Gegen eine Kündigung kann man nur innerhalb von **drei Wochen** vor dem Arbeitsgericht klagen. Die Frist beginnt mit dem Tag, an dem Sie die Kündigung erhalten haben. Bei Ihnen war das der 03.11.2026.

**Die Klage muss deshalb spätestens am Dienstag, 24.11.2026, beim Arbeitsgericht eingegangen sein.**

Wird diese Frist versäumt, gilt die Kündigung in aller Regel als wirksam, auch wenn sie eigentlich fehlerhaft war. Wir wollen die Klage daher **deutlich vor diesem Termin** einreichen.

## Was wir jetzt für Sie tun

1. **Frist notieren:** Wir haben den 24.11.2026 fest in unserem Kalender eingetragen.
2. **Klage vorbereiten:** Wir bereiten die Klage gegen die Kündigung vor und reichen sie beim Arbeitsgericht ein.
3. **Kündigung prüfen:** Wir prüfen, ob die Kündigung Fehler hat. Sie haben uns gesagt, dass der Betriebsrat vor der Kündigung wohl nicht beteiligt wurde. Wenn das stimmt, kann die Kündigung allein schon deshalb unwirksam sein. Das klären wir.
4. **Auf dem Laufenden halten:** Sobald die Klage eingereicht ist, schicken wir Ihnen eine Kopie. Wir sagen Ihnen dann auch, wie es beim Gericht weitergeht.

## Was Sie jetzt tun sollten

**Bitte schicken Sie uns möglichst bis Freitag, 13.11.2026, folgende Unterlagen**, gern als Scan oder Handyfoto per E-Mail:

- **das Kündigungsschreiben** (alle Seiten, auch die Rückseite), und, falls vorhanden, den Umschlag
- **Ihren Arbeitsvertrag** und spätere Änderungen oder Zusatzvereinbarungen
- **Ihre letzten drei Gehaltsabrechnungen**
- **Abmahnungen** oder andere schriftliche Beschwerden Ihres Arbeitgebers, falls Sie welche erhalten haben
- **Schriftverkehr zur Kündigung**, etwa E-Mails oder Nachrichten von Herr\nDr. Matthias Oberländer oder der Personalabteilung
- falls vorhanden: **Ihre Rechtsschutzversicherung** (Name der Versicherung und Versicherungsnummer)

**Bitte beantworten Sie uns außerdem kurz diese Fragen:**

- Wie viele Personen arbeiten ungefähr bei Ihrem Arbeitgeber? Eine grobe Schätzung reicht.
- Hat jemand vom Betriebsrat mit Ihnen über die Kündigung gesprochen, zum Beispiel Jürgen Pakulla?
- Wie können wir Ihre Kollegin Aylin Demirtaş erreichen? Sie kann bestätigen, wie die Kündigung übergeben wurde. Bitte fragen Sie Ihre Kollegin vorher, ob sie mit der Weitergabe ihrer Kontaktdaten einverstanden ist.

**Zwei wichtige Hinweise:**

- **Bitte unterschreiben Sie nichts**, was Ihr Arbeitgeber Ihnen im Zusammenhang mit der Kündigung vorlegt, zum Beispiel einen Aufhebungsvertrag oder eine Erklärung, dass Sie die Kündigung annehmen. Sprechen Sie vorher mit uns.
- **Melden Sie sich bei der Agentur für Arbeit arbeitsuchend.** Das sollten Sie spätestens drei Monate vor dem Ende Ihres Arbeitsverhältnisses tun, also **bis spätestens 31.12.2026**. Am besten erledigen Sie das gleich, auch wenn wir gegen die Kündigung vorgehen. So vermeiden Sie Nachteile beim Arbeitslosengeld. Die Meldung geht auch online.

Wenn Sie Fragen haben, rufen Sie uns gern jederzeit an.

Mit freundlichen Grüßen

*[Name Rechtsanwältin / Rechtsanwalt]*

---

## Interne Hinweise zur Prüfung (nicht an die Mandantin)

- **Fristberechnung:** Zugang am Di., 03.11.2026, durch persönliche Übergabe. Laut Auftrag und E-Mail ist das eindeutig. Fristende nach § 4 KSchG i. V. m. §§ 187 Abs. 1, 188 Abs. 2 BGB ist **Di., 24.11.2026**. Kein Wochenende, kein bundeseinheitlicher Feiertag. Bitte im Fristenkalender gegenprüfen.
- **Namenszuordnung:** Ich gehe davon aus, dass Sabine Krüger-Wendt (Mandantin, voller Name) und Frau Krüger-Wendt (Sachverhalt) dieselbe Person bezeichnen. Der Kontext spricht stark dafür, eindeutig belegt ist es aber nicht. Bitte die Anrede prüfen.
- **Kündigungsfrist:** Beschäftigt seit 01.04.2015, also über 10 Jahre. Nach § 622 Abs. 2 Nr. 4 BGB gelten 4 Monate zum Monatsende. Das Kündigungsdatum 31.03.2027 erscheint plausibel. Abweichende Regelungen in Arbeits- oder Tarifvertrag sind noch zu prüfen.
- **KSchG-Anwendbarkeit:** Die Wartezeit ist erfüllt. Die Betriebsgröße (> 10 Arbeitnehmer, § 23 KSchG) ist noch offen, daher die Frage im Schreiben.
- **Betriebsratsanhörung (§ 102 BetrVG):** Die Angabe der Mandantin, der Betriebsrat sei nicht angehört worden, ist ungeprüft. Sie ist in der Klage zu rügen.
- **Arbeitsuchendmeldung (§ 38 Abs. 1 SGB III):** Der Hinweis ist als Service gedacht. Bitte prüfen, ob er im Schreiben bleiben soll.
- **Datensparsamkeit:** IBAN, Steuer-ID und Geburtsdatum habe ich bewusst nicht ins Schreiben übernommen, weil sie dafür nicht nötig sind.
- Die Frist für die Unterlagen (13.11.2026) ist ein Vorschlag und kann angepasst werden.

**Bewertung (1–5):** ___

## Kündigungsschutzklage (schriftsatz)

> Auftrag: Entwirf die Kündigungsschutzklage zum Arbeitsgericht Köln mit Anträgen und Begründung. Die Kündigung wurde der Mandantin am 03.11.2026 persönlich übergeben. Der Betrieb hat etwa 120 Arbeitnehmer.

### Modell A

*§ 102 ✓ · Platzh. offen 0 · 59 s · 7036 Tokens aus*

# Entwurf: Kündigungsschutzklage

*Entwurf zur Prüfung durch die zuständige Anwältin bzw. den zuständigen Anwalt. Unsicherheiten und fehlende Angaben sind gekennzeichnet.*

## Vorab: Frist und offene Punkte

**Klagefrist (§ 4 S. 1 KSchG):** Drei Wochen nach Zugang der schriftlichen Kündigung. Die Kündigung wurde am Dienstag, 03.11.2026, übergeben. **Die Frist endet am Dienstag, 24.11.2026 (24:00 Uhr)**, vorbehaltlich der Prüfung nach §§ 187, 188 BGB. Die Klage muss bis dahin beim Gericht eingehen. Ein Eingang bei der Rechtsantragstelle genügt ebenfalls. Bitte eine Vorfrist notieren.

**Unklarheiten und fehlende Unterlagen:**
- Das **Kündigungsschreiben** liegt nicht vor. Zu prüfen sind Schriftform und eigenhändige Unterschrift (§ 623 BGB), der Unterzeichner und seine Vertretungsberechtigung (ggf. Rüge nach § 174 BGB) sowie ein genannter Kündigungsgrund.
- Das **Gericht** ist im Auftrag nur als Platzhalter Arbeitsgericht Köln genannt. Ich gehe davon aus, dass das Arbeitsgericht gemeint ist. Bitte bestätigen und die örtliche Zuständigkeit prüfen (§ 46 Abs. 2 ArbGG i. V. m. § 48 ArbGG).
- Die **Mandantin** erscheint in der Gesprächsnotiz unter zwei Platzhaltern (Sabine Krüger-Wendt im Kopf und in der E-Mail, Frau Krüger-Wendt im Sachverhalt). Vermutlich ist dieselbe Person gemeint, das ist aber nicht belegt. Bitte klären.
- Zur **Betriebsratsanhörung** liegen nur Angaben der Mandantin vor („nach Angaben der Mandantin nicht angehört“). Ihre Wahrnehmung ist beschränkt. Bitte nachfragen, woher sie das weiß, und ob ein Betriebsrat tatsächlich besteht und wirksam gewählt ist.
- Ein **Kündigungsgrund** ist nicht bekannt (verhaltens-, personen- oder betriebsbedingt).
- **Sozialdaten** fehlen (Alter, Unterhaltspflichten sind nur teilweise genannt, Schwerbehinderung?, Vergleichsgruppe).
- **Vollmacht**, Aktenzeichen und Angaben zur Kanzlei fehlen.
- **Datenschutz:** Steuer-ID, IBAN, Geburtsdatum, Telefonnummer und E-Mail-Adresse sind für die Klage nicht erforderlich und wurden nicht übernommen.

---

## Entwurf des Schriftsatzes

**An das**
Arbeitsgericht Köln
[FEHLT: Anschrift / Bestätigung, dass es sich um das örtlich zuständige Arbeitsgericht handelt]

[FEHLT: Ort, Datum]

**Klage**

der Frau Sabine Krüger-Wendt, Lindenstraße 42, 50674\nKöln

– Klägerin –

Prozessbevollmächtigte: [FEHLT: Kanzleibezeichnung und Anschrift]

gegen

die Rheinland Logistik\nHoffmann GmbH, [FEHLT: Anschrift, Rechtsform, gesetzliche Vertretung]

– Beklagte –

wegen Kündigungsschutz (Feststellung der Unwirksamkeit einer ordentlichen Kündigung) und Weiterbeschäftigung

**Vorläufiger Streitwert:** 11.550,00 EUR (Vierteljahresverdienst, § 42 Abs. 2 GKG: 3 × 3.850,00 EUR; zuzüglich ggf. Weiterbeschäftigungsantrag, [PRÜFEN: Bewertung nach Gerichtspraxis])

Namens und in Vollmacht der Klägerin erhebe ich Klage und werde beantragen:

### Anträge

1. Es wird festgestellt, dass das Arbeitsverhältnis der Parteien durch die Kündigung der Beklagten vom 03.11.2026, der Klägerin am 03.11.2026 übergeben, nicht zum 31.03.2027 aufgelöst wird.
2. *(Optional, allgemeiner Feststellungsantrag, Prüfung der Zweckmäßigkeit)* Es wird festgestellt, dass das Arbeitsverhältnis auch nicht durch andere Beendigungstatbestände aufgelöst worden ist, sondern über den 31.03.2027 hinaus unverändert fortbesteht.
3. Für den Fall des Obsiegens mit dem Antrag zu 1.: Die Beklagte wird verurteilt, die Klägerin bis zum rechtskräftigen Abschluss des Kündigungsschutzverfahrens zu unveränderten Bedingungen als Disponentin weiterzubeschäftigen.
4. Die Beklagte trägt die Kosten des Rechtsstreits.

[FEHLT: ggf. Antrag auf Erteilung eines Zwischenzeugnisses oder Weiterbeschäftigung, falls gewünscht]

### Begründung

**I. Sachverhalt**

1. Die Klägerin ist seit dem 01.04.2015 bei der Beklagten als Disponentin beschäftigt. Ihr Bruttomonatsgehalt beträgt 3.850,00 EUR. Sie hat zwei unterhaltspflichtige Kinder. [FEHLT: Alter der Klägerin, ggf. Schwerbehinderung, Arbeitsvertrag als Anlage]
2. Die Beklagte beschäftigt in ihrem Betrieb in der Regel etwa 120 Arbeitnehmer. [FEHLT: Betriebsstätte/Ort, genaue Zahl zur Darlegung der Betriebsgröße]
3. Am 03.11.2026 übergab der Vorgesetzte der Klägerin, Herr\nDr. Matthias Oberländer, ihr persönlich eine ordentliche Kündigung zum 31.03.2027. Die Kollegin Aylin Demirtaş war bei der Übergabe zugegen.
   **Beweis:** Zeugnis Aylin Demirtaş, [FEHLT: ladungsfähige Anschrift]; Kündigungsschreiben vom 03.11.2026 als **Anlage K 1** [FEHLT: Kündigungsschreiben]
4. Die Kündigung erfolgte ohne vorherige Warnung oder Abmahnung.
   **Beweis:** wie oben, Zeugnis Aylin Demirtaş
5. Die Klägerin hat nach ihren Angaben keine Kenntnis davon, dass die Beklagte den im Betrieb bestehenden Betriebsrat (Vorsitzender: Jürgen Pakulla) vor Ausspruch der Kündigung angehört hat. [FEHLT: Grundlage der Kenntnis der Klägerin; Bestätigung, dass ein Betriebsrat besteht]
6. [FEHLT: Angaben zu Kündigungsgrund, Inhalt des Kündigungsschreibens, bisherigem Verlauf des Arbeitsverhältnisses, Abmahnungen]

**II. Rechtliche Würdigung**

**1. Zulässigkeit.** Der Rechtsweg zu den Arbeitsgerichten ist eröffnet (§ 2 Abs. 1 Nr. 3 ArbGG). Das Feststellungsinteresse ergibt sich aus § 4 S. 1 KSchG. Die Klage wahrt die Dreiwochenfrist, da sie innerhalb von drei Wochen nach Zugang der Kündigung am 03.11.2026 erhoben wird. [Voraussetzung: Eingang bis 24.11.2026]

**2. Anwendbarkeit des Kündigungsschutzgesetzes.** Das Arbeitsverhältnis besteht seit mehr als sechs Monaten (§ 1 Abs. 1 KSchG). Der Betrieb beschäftigt regelmäßig deutlich mehr als zehn Arbeitnehmer (§ 23 Abs. 1 KSchG), sodass das KSchG Anwendung findet.

**3. Fehlende soziale Rechtfertigung (§ 1 Abs. 2 KSchG).** Die Kündigung ist sozial ungerechtfertigt. Die Beklagte trägt die Darlegungs- und Beweislast für die Kündigungsgründe (§ 1 Abs. 2 S. 4 KSchG). Die Klägerin bestreitet vorsorglich, dass Gründe vorliegen, die die Kündigung bedingen. [FEHLT: Differenzierung nach dem von der Beklagten angegebenen Grund]
- *Bei verhaltensbedingter Kündigung:* Eine Abmahnung ist nicht erfolgt, die Kündigung ist unverhältnismäßig. Die Kündigung erfolgte ohne Vorwarnung.
- *Bei betriebsbedingter Kündigung:* Dringende betriebliche Erfordernisse und die Sozialauswahl (§ 1 Abs. 3 KSchG) werden bestritten. Die Klägerin ist seit über elf Jahren beschäftigt und hat zwei Unterhaltspflichten.
- *Bei personenbedingter Kündigung:* [FEHLT]

**4. Fehlerhafte Betriebsratsanhörung (§ 102 BetrVG).** Die Kündigung ist nach § 102 Abs. 1 S. 3 BetrVG unwirksam, wenn der Betriebsrat vor Ausspruch nicht ordnungsgemäß angehört wurde. Die Klägerin bestreitet, dass die Beklagte den Betriebsrat vor der Kündigung ordnungsgemäß unter Mitteilung der Kündigungsgründe angehört hat. Die Beklagte wird aufgefordert, Zeitpunkt, Inhalt und Ablauf der Anhörung darzulegen und zu beweisen. [PRÜFEN: Darlegungs- und Beweislast im Prozess, abgestufte Darlegungslast nach BAG-Rechtsprechung; konkretes Aktenzeichen bitte recherchieren]

**5. Weitere Unwirksamkeitsgründe (Vorbehalt).** Die Klägerin behält sich vor, weitere Unwirksamkeitsgründe geltend zu machen, insbesondere Formmängel (§ 623 BGB), fehlende Vertretungsmacht des Unterzeichners (§ 174 BGB), Sonderkündigungsschutz sowie Fehler bei der Sozialauswahl. Die Kündigungsfrist von vier Monaten zum Monatsende (§ 622 Abs. 2 S. 1 Nr. 4 BGB) erscheint nach Aktenlage gewahrt. [PRÜFEN: tarif- oder arbeitsvertragliche Fristen]

**6. Weiterbeschäftigung.** Die Klägerin hat einen Anspruch auf vorläufige Weiterbeschäftigung für die Dauer des Kündigungsschutzverfahrens, wenn die Kündigung unwirksam ist und überwiegende schutzwürdige Interessen der Beklagten nicht entgegenstehen. [PRÜFEN: Grundsatzentscheidung des Großen Senats des BAG zum allgemeinen Weiterbeschäftigungsanspruch, Fundstelle bitte verifizieren]

**III. Weitere Hinweise**

- Die Güteverhandlung ist nach § 54 ArbGG vorgesehen. [FEHLT: Haltung der Mandantin zu Vergleich/Abfindung]
- Die Beklagte wird ggf. gemäß § 61a ArbGG zur Klageerwiderung aufgefordert.

[FEHLT: Unterschrift der Prozessbevollmächtigten]

**Anlagen:**
- K 1: Kündigungsschreiben vom 03.11.2026 [FEHLT]
- K 2: Arbeitsvertrag [FEHLT]
- K 3: Vollmacht [FEHLT]
- K 4: Gehaltsabrechnungen der letzten drei Monate [FEHLT]

---

## Hinweise an die Bearbeitung (nicht Teil des Schriftsatzes)

1. **Mandantenhinweise:** Die Mandantin sollte unverzüglich Kontakt mit der Agentur für Arbeit aufnehmen und sich arbeitsuchend melden (§ 38 SGB III), um Sperrzeiten zu vermeiden. Ob die Meldefrist hier relevant ist, bitte prüfen.
2. **Beweisangebot:** Die Zeugin Aylin Demirtaş kann nach den Angaben nur zur Übergabe und zur fehlenden Vorwarnung aussagen, nicht zur Betriebsratsanhörung. Gegebenenfalls ist ein Beweisangebot zur Anhörung nicht ergiebig. Die Beklagte trägt hierfür ohnehin die Last der Darlegung ihrer Anhörung.
3. **Betriebsrat:** Eine Rückfrage beim Betriebsratsvorsitzenden Jürgen Pakulla (mit Einwilligung der Mandantin) könnte klären, ob eine Anhörung erfolgte.
4. **Verjährung/Ausschlussfristen:** Zahlungsansprüche (Annahmeverzug) ggf. gesondert geltend machen; Ausschlussfristen im Arbeits- oder Tarifvertrag prüfen. [PRÜFEN]

**Bewertung (1–5):** ___

### Modell B

*§ 102 ✓ · Platzh. offen 0 · 49 s · 3778 Tokens aus*

# Kündigungsschutzklage – Entwurf

> **Vorbemerkungen / Kennzeichnungen vorab:**
> - Im Dokument ist als Mandantin `Sabine Krüger-Wendt` genannt, im Sachverhalt aber `Frau Krüger-Wendt` als seit 01.04.2015 beschäftigte Disponentin. Ob dieselbe Person gemeint ist, geht aus dem Text **nicht eindeutig** hervor → im Entwurf durchgängig `[PRÜFEN]` / Platzhalter eingesetzt.
> - „`Arbeitsgericht Köln`“ (Auftrag) und „`Rheinland Logistik\nHoffmann GmbH`“ (Dokument) sind inhaltlich nicht eindeutig identifizierbar → im Rubrum beides markiert.
> - **Frist:** Die Klagefrist des § 4 KSchG beträgt **3 Wochen nach Zugang** der Kündigung (persönliche Übergabe am 03.11.2026) → mithin bis spätestens **Dienstag, den 24.11.2026**. Rechtzeitige Einreichung sicherstellen.
> - Der Entwurf bedarf der Prüfung und Ergänzung durch eine Anwältin/einen Anwalt.

---

**Arbeitsgericht** `[FEHLT: zuständiges Arbeitsgericht/Ort]`

```
Sabine Krüger-Wendt [PRÜFEN: identisch mit Frau Krüger-Wendt?]
Lindenstraße 42, 50674\nKöln
— Klägerin —
Prozessbevollmächtigte/Prozessbevollmächtigter: [FEHLT: Zustellungsanschrift ggf. Kanzlei]

Rheinland Logistik\nHoffmann GmbH [PRÜFEN: identisch mit Arbeitsgericht Köln? Anschrift fehlt]
[FEHLT: Anschrift des beklagten Betriebs]
— Beklagte —
```

**Kündigungsschutzklage**

Antrag Nr. 1: `[FEHLT: Streitwert]`
Der Streitwert wird auf [FEHLT] EUR festgesetzt. [PRÜFEN: Anhaltspunkt: Bruttomonatsgehalt 3.850,00 EUR; ein Drittel des Jahreseinkommens gemäß § 42 GKG.]

---

## I. Antrag

Die Klägerin beantragt,

**1.** festzustellen, dass das zwischen den Parteien bestehende Arbeitsverhältnis **nicht** durch die ordentliche, dem Rest der Kette zuzurechnende Kündigung der Beklagten vom **03.11.2026** mit Endtermin zum **31.03.2027** aufgelöst worden ist, sondern **unbefristet über den 31.03.2027 hinaus fortbesteht**;

**2.** hilfsweise: festzustellen, dass das Arbeitsverhältnis zwischen den Parteien nicht durch die Kündigung der Beklagten vom 03.11.2026 aufgelöst worden ist, sondern nur zu dem Rechtsnachfolger der Beklagten als dessen Rechte und Pflichten aus dem Arbeitsverhältnis vererbt übergeht; [PRÜFEN: nur beibetriebsbedingt geplanter Betriebsübergang – hier keine Anhaltspunkte]

**3.** die Beklagte zu verurteilen, die Klägerin **ab dem 31.03.2027 unverändert zu den bisherigen Bedingungen** als Disponentin weiterzubeschäftigen, bis der Rechtsstreit rechtskräftig entschieden ist (§ 102 Abs. 5 BetrVG analog bzw. § 24 SächsArbG-Klagen [PRÜFEN: weiterbeschäftigender Hilfsantrag]); [PRÜFEN: Antrag 2/3 nur hilfsweise und nach Lage des Falls]

**4.** hilfsweise unter Modifikation des Antrags zu 1.**: die Beklagte zu verurteilen, das Arbeitsverhältnis über den 31.03.2027 hinaus zum [FEHLT: Endtermin] fortzusetzen. [PRÜFEN: ggf. bei geänderten Kündigungsfristen]

**5.** die Beklagte zu verurteilen, an die Klägerin [FEHLT: Betrag] EUR nebst Zinsen von [FEHLT] zu zahlen (Auszahlung bestehender unkündbarer Rückstände / Guthaben). [FEHLT: ggf. Untervergütung, Resturlaub, – hier keine konkreten Anhaltspunkte]

**6.** die Kosten des Rechtsstreits der Beklagten aufzuerlegen.

---

## II. Tatsachenvortrag

Die Klägerin ist seit dem **01.04.2015** bei der Beklagten als **Disponentin** beschäftigt (im Folgenden: `[PRÜFEN: Identität Sabine Krüger-Wendt = Frau Krüger-Wendt]`). Ihr Vorgesetzter, `Herr\nDr. Matthias Oberländer`, übergab ihr am **03.11.2026** die ordentliche Kündigung mit Endtermin zum **31.03.2027** persönlich. Die Kündigung erfolgte **ohne jede Vorwarnung**. Dies kann `Aylin Demirtaş`, eine Kollegin der Klägerin, bezeugen.

Die Klägerin verdient ein Bruttomonatsgehalt von **3.850,00 EUR**. Sie ist Mutter **zweier unterhaltspflichtiger Kinder**.

Die Beklagte beschäftigt **ca. 120 Arbeitnehmer**, sodass die Voraussetzungen des § 1 Abs. 1 KSchG erfüllt sind; die Wartezeit nach § 1 Abs. 4 KSchG ist seit über zehn Jahren abgelaufen.

**Kündigungsgrund:** [FEHLT: Im Schriftsatz ist ein Kündigungsgrund nicht erkennbar. Kündigungsgrund, Rz. der Kündigung, ggf. Verwarnungen, Abmahnungen, Betriebsratsschreiben der Beklagten ergänzen.]

**Verwarnungen/Abmahnungen:** [FEHLT: Abmahnungen der Beklagten; hier keine Angaben vorhanden]

**Betriebsrat:** Nach Angaben der Klägerin wurde der Betriebsrat (Vorsitzender: `Jürgen Pakulla`) **vor der Kündigung nicht angehört**.

---

## III. Rechtliche Ausführungen

### 1. Klagefrist nach § 4 KSchG gewahrt

Die Kündigung wurde der Klägerin am **03.11.2026** persönlich übergeben und ging ihr an diesem Tag zu (§ 130 BGB). Die Dreiwochenfrist des § 4 KSchG lief daher bis zum **24.11.2026**. Die vorliegende Klage wurde fristgerecht [FEHLT: Datum des Gerichtseingangs] eingereicht.

### 2. Fehlende Anhörung des Betriebsrats (§ 102 BetrVG)

Die Beklagte hat den Betriebsrat vor der Kündigung **nicht angehört**. Die Kündigung ist daher bereits wegen Verstoßes gegen § 102 Abs. 1 BetrVG rechtswidrig; ein Geltungsgrund nach § 102 Abs. 2 BetrVG ist vorliegend nicht erkennbar. [PRÜFEN: Zuständigkeit/Vertretung des Betriebsrats (Vorsitzender Jürgen Pakulla); ggf. Anhörungsbeweis]

### 3. Kündigung ohne Grund – sozial ungerechtfertigt (§ 1 KSchG)

Soweit der Klägerin der Kündigungsgrund nicht bekannt ist [FEHLT: Grund der Kündigung], sei vorgetragen:

- **Betriebsbedingt:** Es sind [FEHLT: Wegfall des Arbeitsplatzes, innerbetriebliche Gründe, Sozialauswahl] nicht bekannt. Eine Sozialauswahl nach § 1 Abs. 3 KSchG scheitert mindestens an dem Aspekt, dass die Klägerin **zwei unterhaltspflichtige Kinder** hat. [PRÜFEN: Sozialauswahlvergleichsbetriebsregister, drei vergleichbare Arbeitnehmer]
- **Verhaltensbedingt:** Eine Abmahnung ist nicht ergangen; die Kündigung erfolgte **ohne Vorwarnung**. [PRÜFEN: ggf. Kündigung ohne Abmahnung § 1 Abs. 2 Nr. 2 KSchG]
- **Personenbedingt:** [FEHLT: keine Anhaltspunkte im Schriftsatz]

[PRÜFEN: Darlegungslast der Beklagten; ggf. Auskunftsanspruch über Kündigungsgründe]

### 4. Fristkontrolle § 622 BGB

Für die ordentliche Kündigung der Beklagten gilt die gesetzliche Kündigungsfrist des § 622 BGB. Bei einer Betriebszugehörigkeit seit dem 01.04.2015 (mehr als elf Jahre) beträgt die Frist gemäß § 622 Abs. 2 S. 2 Nr. 3 BGB **4 Monate zum Monatsende**; der früheste mögliche Endtermin wäre der **28.02.2027**. [PRÜFEN: arbeitsvertragliche/tarifvertragliche Kündigungsfrist kann abweichen; hier keine Vertragstexte vorliegend] Die Kündigung zum **31.03.2027** unterschreitet die Frist nicht. [PRÜFEN: § 622 Abs. 6 BGB § 623 Schriftform: ob schriftlich oder elektronisch erfolgt, wurde bereits durch persönliche Übergabe erledigt]

### 5. Fehlende Massenentlassungsanzeige

[FEHLT: keine Anhaltspunkte, ob eine Massenentlassung vorliegt (§ 17 KSchG) – vorliegend wohl Einzelfall]

---

## IV. Verfahrenshinweise

- **Kostenbeitrag:** [FEHLT: Schätzung]
- **Zuständig:** [FEHLT: zuständiges Arbeitsgericht nach § 2 Arbeitsgerichtsgesetz]
- **Fristen:** Klagefrist **24.11.2026**; ggf. Verlängerung nach § 5 KSchG nicht eingeholt [PRÜFEN]

---

## V. Anlagen

1. Kündigungsschreiben vom 03.11.2026 [FEHLT: Kopie beifügen]
2. Nachweis Betriebszugehörigkeit seit 01.04.2015 [FEHLT: Arbeitsvertrag/Lohnabrechnungen]
3. Lohnabrechnung/Bruttomonatsgehalt 3.850,00 EUR [FEHLT: Kopie beifügen]
4. Ggf. Betriebsratsanzeige [FEHLT]
5. Ggf. Zeugenerklärung `Aylin Demirtaş` [FEHLT: ggf. beifügen bzw. Zeugenvorstellung beantragen]

---

### Offene Punkte für die Prüfung durch die Anwältin/den Anwalt

| Punkt | Hinweis |
|---|---|
| Identität `Sabine Krüger-Wendt` / `Frau Krüger-Wendt` | Im Dokument nicht eindeutig; im Rubrum Platzhalter der Mandantin verwendet |
| `Arbeitsgericht Köln` vs. `Rheinland Logistik\nHoffmann GmbH` | Im Auftrag und im Dokument unterschiedliche Platzhalter – Zuspielung klären |
| Kündigungsgrund | Im Dokument nicht angegeben |
| Volltext der Kündigung | Nicht vorliegend (u.a. wichtig für Schriftform § 623 BGB) |
| Betriebliche Kündigungsfristen / Tarifvertrag | Nicht bekannt |
| Unterlagen Betriebsrat | Nie angehört nach Mandantin – Beweis sichern |
| Sperren von Arbeitslosengeld, Mitteilverhalten, Nichtannahmelohn | Falls Geltungsfähigkeit [PRÜFEN] |
| Bankverbindung, Steuer-ID, Geburtsdatum, E-Mail/Telefon | Im Klageschriftsatz grundsätzlich **nicht** aufgenommen (datenschutzrechtlich nicht erforderlich); vollständig pseudonymisiert belassen |

**Bewertung (1–5):** ___

### Modell C

*§ 102 ✗ · Platzh. offen 0 · 58 s · 12722 Tokens aus*

# Entwurf: Kündigungsschutzklage

> **Entwurf zur Prüfung durch eine Anwältin/einen Anwalt.** Alle Platzhalter sind unverändert übernommen. Fehlende Angaben sind als `[FEHLT: …]` gekennzeichnet, Prüfungsbedarf als `[PRÜFEN]`.

---

## A. Fristennotiz (vorab – bitte sofort kalendarisch sichern)

| Position | Eintrag |
|---|---|
| Zugang der Kündigung | **03.11.2026** (persönliche Übergabe durch Herr\nDr. Matthias Oberländer) |
| Klagefrist § 4 S. 1 KSchG | **24.11.2026** (3 Wochen; § 187 Abs. 1, § 188 Abs. 2 BGB) |
| Fristende | Dienstag, 24.11.2026, 24:00 Uhr – keine Verlängerung nach § 193 BGB, da kein Sonn-/Feiertag |
| Folge der Versäumung | Wirksamkeitsfiktion nach § 7 KSchG; nachträgliche Zulassung nur unter den engen Voraussetzungen des § 5 KSchG |
| Weiteres | Klagezustellung „demnächst“ i.S.d. § 167 ZPO veranlassen |

**Hinweis:** Die Dreiwochenfrist ist eine **Ausschlussfrist**. Die Klage muss innerhalb der Frist beim Arbeitsgericht eingehen; auf die Zustellung kommt es insoweit nicht an, wohl aber auf eine zeitnahe Zustellung.

---

## B. Klageentwurf

**An das**
**Arbeitsgericht Arbeitsgericht Köln**

`[FEHLT: vollständige Gerichtsanschrift]`

---

### Rubrum

**Klägerin:**
Sabine Krüger-Wendt, geb. 14.07.1983,
Lindenstraße 42, 50674\nKöln
Telefon: 0221 4789123 · E-Mail: sabine.krueger-wendt@beispielmail.de

**Prozessbevollmächtigte:**
`[FEHLT: Name und Anschrift der Kanzlei / der bevollmächtigten Anwältin oder des Anwalts]`
`[FEHLT: Aktenzeichen]`

**Beklagte:**
Rheinland Logistik\nHoffmann GmbH,
`[FEHLT: Anschrift des Betriebs/Sitzes]`
vertreten durch `[FEHLT: gesetzliche Vertreterin/gesetzlichen Vertreter, Funktion]`

**Streitgegenstand:** Kündigung vom 03.11.2026 zum 31.03.2027

---

### Anträge

Namens und in Vollmacht der Klägerin erhebe ich **Kündigungsschutzklage** und beantrage:

1. **Es wird festgestellt, dass das Arbeitsverhältnis der Parteien durch die Kündigung der Beklagten vom 03.11.2026 nicht aufgelöst worden ist.**

2. **Hilfsweise für den Fall des Obsiegens mit dem Antrag zu 1.:**
   Die Beklagte wird verurteilt, die Klägerin zu unveränderten Arbeitsbedingungen als Disponentin weiterzubeschäftigen.

3. Die Beklagte trägt die Kosten des Rechtsstreits.

---

### Begründung

#### I. Sachverhalt

1. Die Klägerin ist seit dem **01.04.2015** bei der Beklagten als **Disponentin** beschäftigt. Ihr Bruttomonatsgehalt beträgt **3.850,00 EUR**.

2. Mit Schreiben vom **03.11.2026**, das der Klägerin an diesem Tag persönlich durch ihren Vorgesetzten Herr\nDr. Matthias Oberländer übergeben wurde, kündigte die Beklagte das Arbeitsverhältnis **ordentlich zum 31.03.2027**.

3. Die Beklagte beschäftigt in ihrem Betrieb **etwa 120 Arbeitnehmer**. Bei ihr besteht ein **Betriebsrat**; dessen Vorsitzender ist Jürgen Pakulla.

4. Der Betriebsrat wurde vor Ausspruch der Kündigung **nicht angehört**. Die Klägerin hat vor der Übergabe des Kündigungsschreibens keinerlei Beteiligung des Betriebsrats wahrgenommen; eine Anhörung ist auch nicht nachgeholt worden.

5. Die Klägerin ist **zwei unterhaltspflichtigen Kindern** gegenüber zum Unterhalt verpflichtet.

*Beweis:* Zeugnis der Aylin Demirtaş, zu laden über die Beklagte, zum Zugang und zu den Umständen der Übergabe am 03.11.2026; `[PRÜFEN: Zeugnis des Jürgen Pakulla zur unterbliebenen Anhörung des Betriebsrats – Benennung als Zeuge gegen die Beklagte ist taktisch abzuwägen]`

#### II. Zulässigkeit

1. **Rechtsweg und Zuständigkeit:** Der Rechtsweg zu den Gerichten für Arbeitssachen ist nach § 2 Abs. 1 Nr. 3 ArbGG eröffnet. Die örtliche Zuständigkeit des Arbeitsgerichts Arbeitsgericht Köln wird zugrunde gelegt. `[PRÜFEN: örtliche Zuständigkeit – Sitz der Beklagten bzw. Beschäftigungsort; ggf. Verweisungsantrag der Gegenseite]`

2. **Klagefrist:** Die Klage wird innerhalb der Dreiwochenfrist des § 4 S. 1 KSchG erhoben. Die Kündigung ging der Klägerin am 03.11.2026 zu; die Frist endet mit Ablauf des **24.11.2026**.

3. **Anwendbarkeit des KSchG:** Die Klägerin ist seit mehr als sechs Monaten beschäftigt (§ 1 Abs. 1 KSchG). Der Betrieb der Beklagten weist in der Regel mehr als zehn Arbeitnehmer auf (§ 23 Abs. 1 KSchG). Das Kündigungsschutzgesetz ist daher anwendbar.

#### III. Begründetheit

**1. Die Kündigung ist wegen fehlender Anhörung des Betriebsrats unwirksam (§ 102 Abs. 1 S. 3 BetrVG).**

Besteht in einem Betrieb ein Betriebsrat, so ist dieser vor **jeder** Kündigung zu hören (§ 102 Abs. 1 S. 1 BetrVG). Eine ohne Anhörung ausgesprochene Kündigung ist **unwirksam** (§ 102 Abs. 1 S. 3 BetrVG). Die Anhörung muss **vor** Ausspruch der Kündigung abgeschlossen sein; eine Nachholung heilt den Mangel nicht.

Der Betriebsrat der Beklagten wurde nicht beteiligt. Die Darlegungs- und Beweislast für die ordnungsgemäße Anhörung – einschließlich ihres Zugangs, ihres Inhalts und ihrer Vollständigkeit – trägt die Beklagte. `[PRÜFEN: ständige Rechtsprechung des BAG zur Beweislastverteilung – Fundstelle ergänzen]`

Die Beklagte wird daher im Einzelnen darzulegen haben, wann, in welcher Form und mit welchem Inhalt der Betriebsrat unterrichtet und ob und mit welchem Ergebnis er beteiligt wurde. `[FEHLT: etwaige Angaben der Beklagten zur Betriebsratsanhörung]`

**2. Die Kündigung ist sozial ungerechtfertigt (§ 1 Abs. 2 KSchG).**

Die Kündigung ist nicht durch Gründe im Verhalten oder in der Person der Klägerin oder durch dringende betriebliche Erfordernisse bedingt.

- **Betriebsbedingte Gründe** sind nicht ersichtlich. Die Beklagte hat weder einen Wegfall des Arbeitsplatzes der Klägerin noch eine fehlende anderweitige Beschäftigungsmöglichkeit dargelegt. `[FEHLT: von der Beklagten angegebener Kündigungsgrund; ggf. Kündigungsschreiben im Wortlaut]`
- **Personen- oder verhaltensbedingte Gründe** sind nicht ersichtlich und wurden nicht mitgeteilt. `[FEHLT: etwaige Abmahnungen, Beurteilungen, Leistungsbeanstandungen]`

**3. Jedenfalls fehlt es an einer ordnungsgemäßen Sozialauswahl (§ 1 Abs. 3 KSchG).**

Sollte die Kündigung auf betriebliche Erfordernisse gestützt werden, wäre eine Sozialauswahl unter den vergleichbaren Arbeitnehmern durchzuführen gewesen. Die Klägerin ist mit einer Betriebszugehörigkeit von über elf Jahren, ihrem Lebensalter und der Unterhaltspflicht gegenüber zwei Kindern in besonderem Maße schutzbedürftig (§ 1 Abs. 3 S. 1 KSchG). Die Beklagte hat eine Sozialauswahl weder vorgenommen noch dargelegt. `[FEHLT: Angaben zur Vergleichsgruppe, zur Betriebsabteilung und zur Sozialauswahl der Beklagten]`

**4. Formelle Unwirksamkeit nach § 623 BGB.** `[PRÜFEN: Das Kündigungsschreiben liegt dem Entwurf nicht bei. Sofern das Original nicht ordnungsgemäß unterschrieben ist oder keine Urkunde, sondern nur eine Kopie/E-Mail zugegangen ist, ist die Kündigung auch nach § 623 BGB unwirksam.]`

**5. Sonderkündigungsschutz.** `[FEHLT: Prüfung, ob zum Kündigungszeitpunkt Sonderkündigungsschutz bestand (Schwangerschaft, Elternzeit, Pflegezeit, Schwerbehinderung, Betriebsratsamt, Mandatsschutz).]`

#### IV. Zum Weiterbeschäftigungsantrag

Für den Fall des Obsiegens mit dem Kündigungsschutzantrag hat die Klägerin Anspruch auf Weiterbeschäftigung zu unveränderten Arbeitsbedingungen. Der Anspruch folgt aus §§ 611a, 613 BGB in Verbindung mit Art. 2 Abs. 1, Art. 12 Abs. 1 GG. `[PRÜFEN: BAG, Großer Senat, Beschluss vom 27.02.1985 – GS 1/84 – Fundstelle und Zitierweise ergänzen]`

#### V. Streitwert

Der Streitwert wird vorläufig mit **11.550,00 EUR** angegeben (drei Bruttomonatsgehälter zu je 3.850,00 EUR; § 42 Abs. 2 GKG). `[PRÜFEN: Bewertung des hilfsweisen Weiterbeschäftigungsantrags – nach verbreiteter Auffassung ein weiteres Bruttomonatsgehalt]`

---

### Anlagenverzeichnis

| Anlage | Inhalt | Status |
|---|---|---|
| K 1 | Kündigungsschreiben der Beklagten vom 03.11.2026 | `[FEHLT: Original/Kopie beifügen]` |
| K 2 | Arbeitsvertrag vom `[FEHLT: Datum]` | `[FEHLT]` |
| K 3 | `[FEHLT: ggf. Gehaltsabrechnungen, Betriebsratsunterlagen, Schriftwechsel]` | `[FEHLT]` |

---

## C. Offene Punkte / Rückfragen an die Mandantin

1. `[FEHLT: Kündigungsschreiben im Original – Wortlaut, Datum, Unterschrift, Begründung]`
2. `[FEHLT: Anschrift und gesetzliche Vertretung der Beklagten]`
3. `[FEHLT: Name, Anschrift und Kontaktdaten der Prozessbevollmächtigten]`
4. `[FEHLT: Angaben zum Kündigungsgrund seitens der Beklagten]`
5. `[FEHLT: Bestehen von Sonderkündigungsschutz (Schwangerschaft, Elternzeit, Schwerbehinderung, Betriebsratsamt)]`
6. `[FEHLT: Angaben zur Vergleichsgruppe/Abteilung für die Sozialauswahl]`
7. `[FEHLT: Wurde die Klägerin nach dem 03.11.2026 tatsächlich weiterbeschäftigt oder freigestellt?]`
8. `[FEHLT: Liegen weitere Kündigungen oder Änderungsverträge vor?]`

---

## D. Prüfungsvermerk zur Aktenführung

- **Namensplatzhalter:** In der Gesprächsnotiz wird die Mandantin im Sachverhalt als Frau Krüger-Wendt bezeichnet, im Rubrum und in der E-Mail demgegenüber als Sabine Krüger-Wendt. Nach dem Kontext (Disponentin, Vorgesetzter Herr\nDr. Matthias Oberländer, Übergabe am 03.11.2026, Adresse Lindenstraße 42, 50674\nKöln) ist von **derselben Person** auszugehen. `[PRÜFEN: Abgleich mit der Handakte vor Versand – die Platzhalter sind im Entwurf bewusst unverändert übernommen.]`
- **Kündigungsfrist:** Bei Zugang am 03.11.2026 und einer Beschäftigungsdauer von mehr als zehn Jahren (§ 622 Abs. 2 BGB) erscheint die Kündigung zum 31.03.2027 **fristgerecht**. Angriffspunkte sind daher in erster Linie die **fehlende Betriebsratsanhörung** und die **fehlende soziale Rechtfertigung**, nicht die Fristberechnung. `[PRÜFEN: tarifvertragliche oder vertragliche Kündigungsfristen; § 622 Abs. 2 S. 2 BGB ist nach EuGH-Rechtsprechung nicht anzuwenden]`
- **Beweislast:** Die Darlegungs- und Beweislast für die ordnungsgemäße Betriebsratsanhörung liegt bei der Beklagten. Die Klägerin muss die Nichtanhörung daher nicht positiv beweisen, sondern nur bestreiten. `[PRÜFEN: Fundstelle ergänzen]`
- **Zustellung:** Klage nach Freigabe unverzüglich einreichen und Zustellung überwachen (§ 167 ZPO).

---

*Dieser Entwurf ist ein Arbeitsergebnis zur anwaltlichen Prüfung und noch nicht zur Einreichung bestimmt.*

**Bewertung (1–5):** ___

### Modell D

*§ 102 ✗ · Platzh. offen 0 · 183 s · 8742 Tokens aus*

**Entwurf – Kündigungsschutzklage**
*(Zur Prüfung durch die zuständige Anwältin / den zuständigen Anwalt)*

---

### Rubrum

An das
**Arbeitsgericht [FEHLT: Ort]**
[Adresse des Gerichts: FEHLT]

– **Klägerin** –
**Sabine Krüger-Wendt**
geboren am 14.07.1983
wohnhaft: Lindenstraße 42, 50674\nKöln
Telefon: 0221 4789123
E-Mail: sabine.krueger-wendt@beispielmail.de

– **Prozessbevollmächtigte** –
[FEHLT: Name, Kanzlei, Anschrift, beA-Adresse der vertretenden Rechtsanwältin / des vertretenden Rechtsanwalts]
Prozessvollmacht: [FEHLT: liegt bei / wird nachgereicht]

gegen

– **Beklagte** –
**Arbeitsgericht Köln**
vertreten durch [FEHLT: gesetzlicher Vertreter, z. B. Geschäftsführer/Vorstand]
[Adresse der Beklagten: FEHLT]

**Streitwert:** 11.550,00 EUR (3 Monatsgehälter à 3.850,00 EUR gemäß § 61 Abs. 2 ArbGG) [PRÜFEN]

---

### Anträge

Es wird beantragt,

1. festzustellen, dass das zwischen der Klägerin und der Beklagten bestehende Arbeitsverhältnis durch die ordentliche Kündigung der Beklagten vom 03.11.2026 zum 31.03.2027 nicht aufgelöst worden ist;

2. die Beklagte zu verurteilen, die Kosten des Rechtsstreits zu tragen.

---

### Begründung

#### I. Sachverhalt

Die Klägerin ist seit dem 01.04.2015 bei der Rheinland Logistik\nHoffmann GmbH (Beklagte: Arbeitsgericht Köln) [PRÜFEN: Ob Rheinland Logistik\nHoffmann GmbH und Arbeitsgericht Köln denselben Rechtsträger bezeichnen] als Disponentin beschäftigt. Ihr Bruttomonatsgehalt beträgt 3.850,00 EUR.

Der Betrieb der Beklagten beschäftigt etwa 120 Arbeitnehmer.

Am 03.11.2026 überreichte ihr der Vorgesetzte Herr\nDr. Matthias Oberländer die ordentliche Kündigung zum 31.03.2027. Die Kündigung ging der Klägerin an diesem Tag persönlich zu. [PRÜFEN: Liegt die Kündigung in Schriftform i. S. d. § 623 BGB vor? Kopie der Kündigung: FEHLT]

Ein Betriebsrat besteht (Vorsitzender: Jürgen Pakulla). Dieser wurde nach Angaben der Klägerin vor Ausspruch der Kündigung nicht angehört.

Die Kollegin Aylin Demirtaş war bei der Übergabe der Kündigung anwesend und kann bezeugen, dass die Kündigung ohne vorherige Warnung erfolgte.

#### II. Rechtliche Würdigung

**1. Zulässigkeit der Klage**

Die Klage ist zulässig.

Die Klagefrist des § 4 Satz 1 KSchG ist gewahrt. Die schriftliche Kündigung ging der Klägerin am 03.11.2026 zu. Die Klage wird innerhalb von drei Wochen nach Zugang der Kündigung beim Arbeitsgericht erhoben. [PRÜFEN: Fristablauf am 24.11.2026; rechtzeitiger Eingang beim Gericht]

Das angerufene Arbeitsgericht ist gemäß § 2 Abs. 1 Nr. 3 lit. a) ArbGG sachlich und gemäß § 48 ArbGG örtlich zuständig. [FEHLT: Genaue Bezeichnung des Gerichts]

**2. Begründetheit der Klage**

Das Kündigungsschutzgesetz ist anwendbar. Die Beklagte beschäftigt mehr als zehn Arbeitnehmer (§ 1 Abs. 1 Satz 1 KSchG; hier: ca. 120 Arbeitnehmer). Die Klägerin ist seit dem 01.04.2015, mithin länger als sechs Monate, im Betrieb der Beklagten beschäftigt (§ 1 Abs. 1 Satz 1 KSchG).

Die Kündigung ist unwirksam.

**a) Formelle Unwirksamkeit wegen fehlender Betriebsratsanhörung**

Gemäß § 102 Abs. 1 Satz 1 BetrVG ist der Betriebsrat vor jeder Kündigung anzuhören. Die ordnungsgemäße Anhörung ist Wirksamkeitsvoraussetzung der Kündigung. Wurde der Betriebsrat nicht angehört, ist die Kündigung unwirksam (§ 102 Abs. 1 Satz 3 BetrVG).

Nach den Angaben der Klägerin wurde der Betriebsrat (Vorsitzender: Jürgen Pakulla) nicht angehört. [PRÜFEN: Tatsächliche Durchführung der Anhörung; Beweislast liegt beim Arbeitgeber]

**b) Materielle Unwirksamkeit**

Unabhängig von der formellen Wirksamkeit ist die Kündigung auch materiell rechtswidrig, da sie sozial nicht gerechtfertigt ist (§ 1 Abs. 2 KSchG). [FEHLT: Angaben zu den Kündigungsgründen (betriebsbedingt, personenbedingt oder verhaltensbedingt) sowie ggf. zur durchgeführten Sozialauswahl gemäß § 1 Abs. 3 KSchG]

#### III. Beweismittel

[FEHLT: Konkrete Beweismittel, z. B.:
- Kündigungsschreiben vom 03.11.2026 (als Anlage)
- Gehaltsabrechnungen der letzten 12 Monate
- Zeugnis der Kollegin Aylin Demirtaş
- Schreiben zur Betriebsratsanhörung (falls vorhanden) bzw. Negativzeugnis des Betriebsrats]

---

[Ort], den [FEHLT: Datum]

_________________________
[FEHLT: Unterschrift der Prozessbevollmächtigten]

---

### Hinweise für die anwaltliche Prüfung

- [PRÜFEN: Ob Arbeitsgericht Köln und Rheinland Logistik\nHoffmann GmbH identisch sind und welche Bezeichnung im Rubrum zu führen ist]
- [PRÜFEN: Fristberechnung nach § 4 KSchG – Zugang am 03.11.2026, Fristablauf voraussichtlich am 24.11.2026; rechtzeitiger Eingang beim Gericht erforderlich]
- [FEHLT: Vollständige Anschrift der Beklagten und deren gesetzlicher Vertreter]
- [FEHLT: Prozessvollmacht der Klägerin]
- [FEHLT: Kopie der Kündigung (Schriftformerfordernis § 623 BGB)]
- [FEHLT: Kündigungsgründe und Unterlagen zur Sozialauswahl]
- [PRÜFEN: Ob ergänzende Anträge (z. B. auf vorläufige Weiterbeschäftigung, Lohnzahlung für die Zeit nach dem 31.03.2027) gestellt werden sollen]
- [PRÜFEN: Ggf. Anwendbarkeit von Sonderkündigungsschutz (z. B. Elternzeit, Schwerbehinderung) – hier: zwei unterhaltspflichtige Kinder, aber kein Hinweis auf besondere Schutzbedürftigkeit]

**Bewertung (1–5):** ___

### Modell E

*§ 102 ✓ · Platzh. offen 0 · 75 s · 7215 Tokens aus*

# Entwurf: Kündigungsschutzklage

> **Interne Vorbemerkungen (nicht Teil des Schriftsatzes)**
>
> **1. Klagefrist (§ 4 Satz 1 KSchG)**
> - Zugang der Kündigung: persönliche Übergabe am **Dienstag, 03.11.2026**.
> - Fristberechnung nach §§ 187 Abs. 1, 188 Abs. 2 BGB: Ablauf am **Dienstag, 24.11.2026, 24:00 Uhr**.
> - **Bitte Frist und Vorfrist sofort notieren.** Wird die Frist versäumt, gilt die Kündigung als von Anfang an rechtswirksam (§ 7 KSchG). Die nachträgliche Zulassung nach § 5 KSchG kommt nur ausnahmsweise in Betracht.
>
> **2. Kündigungsfrist (§ 622 Abs. 2 BGB)**
> - Bei Zugang bestand das Arbeitsverhältnis seit über 11 Jahren (seit 01.04.2015).
> - Daraus folgt eine Frist von 4 Monaten zum Monatsende (§ 622 Abs. 2 Satz 1 Nr. 4 BGB).
> - Der Termin 31.03.2027 erscheint daher gesetzlich zutreffend.
> - **Zu prüfen:** längere Fristen aus Arbeitsvertrag oder Tarifvertrag [FEHLT: Arbeitsvertrag / anwendbarer Tarifvertrag].
>
> **3. Personenzuordnung (Unsicherheit)**
> - In der Gesprächsnotiz wird die Beschäftigte als Frau Krüger-Wendt bezeichnet.
> - Der Kontext legt nahe, dass dies die Mandantin Sabine Krüger-Wendt ist, etwa in abgekürzter Namensform. Eindeutig belegt ist das aber nicht.
> - Im Entwurf wird durchgängig Sabine Krüger-Wendt verwendet. **Bitte verifizieren.**
>
> **4. Datensparsamkeit**
> - Folgende Angaben gehören nicht in die Klageschrift und wurden bewusst weggelassen: Steuer-ID, IBAN, Telefonnummer, E-Mail-Adresse.
> - Das Geburtsdatum wird nur angegeben, soweit es für die Sozialdaten erforderlich ist.
>
> **5. Zurückweisung nach § 174 BGB**
> - Die Kündigung wurde vom Vorgesetzten Herr\nDr. Matthias Oberländer überreicht.
> - **Zu klären:**
>   - Wer hat das Kündigungsschreiben unterzeichnet?
>   - Lag eine Originalvollmacht bei?
> - Eine Zurückweisung muss *unverzüglich* erfolgen. Dafür wird in der Rechtsprechung häufig ein Zeitraum von etwa einer Woche als Richtwert angesehen [PRÜFEN]. Gegebenenfalls ist **sofort** separat zurückzuweisen.
>
> **6. Schriftform (§ 623 BGB)**
> - Bitte das Original des Kündigungsschreibens anfordern und die eigenhändige Unterschrift prüfen.

---

**An das**
**Arbeitsgericht Köln**
[FEHLT: Anschrift des Gerichts]

**Klage**

In dem Rechtsstreit

**Sabine Krüger-Wendt**, Lindenstraße 42, 50674\nKöln,

– Klägerin –

Prozessbevollmächtigte: [FEHLT: Kanzleibezeichnung, Anschrift, Aktenzeichen]

gegen

**Rheinland Logistik\nHoffmann GmbH** [FEHLT: Rechtsform], vertreten durch [FEHLT: gesetzliche Vertreter, z. B. Geschäftsführer/in], [FEHLT: Anschrift der Beklagten],

– Beklagte –

wegen: Kündigungsschutz

**Vorläufiger Streitwert:** 11.550,00 EUR (drei Bruttomonatsgehälter à 3.850,00 EUR, § 42 Abs. 2 Satz 1 GKG)

erheben wir namens und in Vollmacht der Klägerin Klage und werden beantragen:

1. **festzustellen**, dass das Arbeitsverhältnis der Parteien durch die ordentliche Kündigung der Beklagten vom [FEHLT: Datum des Kündigungsschreibens], der Klägerin zugegangen am 03.11.2026, nicht aufgelöst wird;

2. **festzustellen**, dass das Arbeitsverhältnis der Parteien auch nicht durch andere Beendigungstatbestände endet, sondern zu unveränderten Bedingungen über den 31.03.2027 hinaus fortbesteht;

3. **die Beklagte zu verurteilen**, die Klägerin im Falle des Obsiegens mit den Anträgen zu 1. und/oder 2. bis zum rechtskräftigen Abschluss des Verfahrens zu unveränderten arbeitsvertraglichen Bedingungen als Disponentin weiterzubeschäftigen.

> *Interner Hinweis zum Antrag zu 3.:* Ob der Weiterbeschäftigungsantrag schon jetzt oder erst später gestellt wird, ist eine taktische Entscheidung. Bei Streitwert- und Kostenfragen kann er auch als uneigentlicher Hilfsantrag formuliert werden [PRÜFEN].

---

## Begründung

### I. Sachverhalt

**1. Arbeitsverhältnis**

Die Klägerin ist seit dem 01.04.2015 bei der Beklagten als Disponentin beschäftigt. Ihr Bruttomonatsgehalt beträgt zuletzt 3.850,00 EUR.

*Beweis:* Arbeitsvertrag vom [FEHLT: Datum] – Anlage K1 [FEHLT]; Gehaltsabrechnungen [FEHLT: Monate] – Anlage K2 [FEHLT]

**2. Sozialdaten**

Die Klägerin ist am 14.07.1983 geboren. Sie ist zwei Kindern gegenüber zum Unterhalt verpflichtet.
[FEHLT: Familienstand; Angaben zu einer etwaigen Schwerbehinderung oder Gleichstellung]

**3. Betrieb und Betriebsrat**

- Die Beklagte beschäftigt in ihrem Betrieb regelmäßig ca. 120 Arbeitnehmer, ausschließlich der Auszubildenden. [Hinweis: Zahl beruht auf Angaben der Mandantin; ggf. präzisieren.]
- Im Betrieb ist ein Betriebsrat gebildet. Dessen Vorsitzender ist Jürgen Pakulla.

**4. Kündigung**

- Mit Schreiben vom [FEHLT: Datum] kündigte die Beklagte das Arbeitsverhältnis ordentlich zum 31.03.2027.
- Das Schreiben wurde der Klägerin am 03.11.2026 von ihrem Vorgesetzten Herr\nDr. Matthias Oberländer persönlich übergeben.
- Bei der Übergabe war die Kollegin Aylin Demirtaş anwesend.
- Kündigungsgründe wurden der Klägerin nicht mitgeteilt.
- Die Kündigung erfolgte ohne jede vorherige Ankündigung. Insbesondere ging ihr keine Abmahnung voraus.

*Beweis:*
- Kündigungsschreiben vom [FEHLT: Datum] – Anlage K3 [FEHLT]
- Zeugnis der Aylin Demirtaş, zu laden über die Beklagte [FEHLT: ladungsfähige Anschrift der Zeugin oder Ladung über die Beklagte – bitte klären]

> *Interner Hinweis:* Bitte bei der Mandantin klären, ob es Abmahnungen, Personalgespräche oder Hinweise auf Umstrukturierungen gab. Das Fehlen einer „Vorwarnung“ ist vor allem bei einer verhaltensbedingten Kündigung relevant.

---

### II. Rechtliche Würdigung

**1. Zulässigkeit**

- Das angerufene Gericht ist sachlich zuständig nach § 2 Abs. 1 Nr. 3 lit. b ArbGG.
- Die örtliche Zuständigkeit ergibt sich aus dem Sitz der Beklagten bzw. dem gewöhnlichen Arbeitsort (§ 46 Abs. 2 ArbGG i. V. m. §§ 12, 17 ZPO; § 48 Abs. 1a ArbGG). [FEHLT: Arbeitsort/Sitz – Zuständigkeit des Arbeitsgericht Köln bitte verifizieren]
- Die Klage ist innerhalb der Dreiwochenfrist des § 4 Satz 1 KSchG erhoben.

**2. Anwendbarkeit des Kündigungsschutzgesetzes**

- Das Kündigungsschutzgesetz ist anwendbar.
- Das Arbeitsverhältnis besteht seit mehr als sechs Monaten (§ 1 Abs. 1 KSchG).
- Die Beklagte beschäftigt regelmäßig deutlich mehr als zehn Arbeitnehmer (§ 23 Abs. 1 KSchG).

**3. Unwirksamkeit wegen fehlender Anhörung des Betriebsrats (§ 102 Abs. 1 BetrVG)**

- Nach § 102 Abs. 1 Satz 1 BetrVG ist der Betriebsrat vor jeder Kündigung zu hören.
- Eine ohne Anhörung ausgesprochene Kündigung ist nach § 102 Abs. 1 Satz 3 BetrVG unwirksam.
- Nach Kenntnis der Klägerin wurde der Betriebsrat vor Ausspruch der Kündigung nicht angehört.
- Die Klägerin bestreitet daher mit Nichtwissen (§ 138 Abs. 4 ZPO), dass der Betriebsrat ordnungsgemäß angehört wurde. Das gilt insbesondere für:
  - die vollständige Mitteilung der Kündigungsgründe,
  - die Mitteilung der Sozialdaten,
  - die Einhaltung der Äußerungsfrist.
- Die Darlegungs- und Beweislast für die ordnungsgemäße Anhörung trägt die Beklagte [PRÜFEN: st. Rspr. des BAG zur abgestuften Darlegungslast bei § 102 BetrVG].

**4. Fehlende soziale Rechtfertigung (§ 1 Abs. 2 KSchG)**

- Die Kündigung ist zudem sozial ungerechtfertigt.
- Gründe in der Person oder im Verhalten der Klägerin oder dringende betriebliche Erfordernisse sind weder mitgeteilt noch ersichtlich.
- Die Beweislast für die Tatsachen, die die Kündigung bedingen, trägt die Beklagte (§ 1 Abs. 2 Satz 4 KSchG).
- Vorsorglich rügt die Klägerin für den Fall einer betriebsbedingten Kündigung die Sozialauswahl (§ 1 Abs. 3 KSchG). Zu berücksichtigen sind die über elfjährige Betriebszugehörigkeit, das Lebensalter und die Unterhaltspflichten gegenüber zwei Kindern.
- Die Klägerin fordert die Beklagte auf, die Gründe mitzuteilen, die zu der getroffenen Sozialauswahl geführt haben (§ 1 Abs. 3 Satz 1 Halbsatz 2 KSchG).
- Für den Fall einer verhaltensbedingten Kündigung fehlt es an der erforderlichen vorherigen Abmahnung.
- Die Klägerin behält sich weiteren Vortrag vor, sobald die Beklagte die Kündigungsgründe dargelegt hat.

**5. Weitere Unwirksamkeitsgründe**

- Die Klägerin bestreitet vorsorglich mit Nichtwissen, dass das Kündigungsschreiben der Schriftform des § 623 BGB genügt, insbesondere die eigenhändige Unterschrift eines Kündigungsberechtigten trägt.
- Ebenso bestreitet sie die Vertretungsmacht des Unterzeichners. [Hinweis: Nach Sichtung des Originals konkretisieren oder streichen.]
- Die Klägerin behält sich vor, sich gemäß § 6 KSchG bis zum Schluss der mündlichen Verhandlung erster Instanz auf weitere Unwirksamkeitsgründe zu berufen.

**6. Zum Antrag zu 2. (allgemeiner Feststellungsantrag)**

- Der Antrag zu 2. ist ein selbständiger allgemeiner Feststellungsantrag nach § 256 Abs. 1 ZPO.
- Das Feststellungsinteresse ergibt sich aus der Gefahr weiterer Beendigungstatbestände, etwa Folgekündigungen, die die Beklagte im Laufe des Verfahrens aussprechen könnte.
- Der Antrag ist zulässig [PRÜFEN: BAG, Urt. v. 13.03.1997 – 2 AZR 512/96].
- Zur Konkretisierung des Feststellungsinteresses wird bei Bedarf weiter vorgetragen. [Hinweis: Das BAG verlangt hierzu konkreten Vortrag; derzeit sind keine weiteren Beendigungstatbestände bekannt.]

**7. Zum Antrag zu 3. (Weiterbeschäftigung)**

- Der allgemeine Weiterbeschäftigungsanspruch folgt aus §§ 611a, 613 BGB i. V. m. § 242 BGB, Art. 1 und 2 GG.
- Er besteht, wenn die Kündigung unwirksam ist und keine überwiegenden schutzwürdigen Interessen des Arbeitgebers entgegenstehen [PRÜFEN: BAG, Großer Senat, Beschl. v. 27.02.1985 – GS 1/84].
- Solche Interessen sind nicht ersichtlich.

---

**Güteverhandlung:** Die Klägerin ist zu einer gütlichen Einigung grundsätzlich bereit (§ 54 ArbGG).

**Anlagen:**
- Prozessvollmacht [FEHLT]
- Anlagen K1 bis K3 [FEHLT]

[FEHLT: Ort, Datum]

[FEHLT: Name der Rechtsanwältin / des Rechtsanwalts]
Rechtsanwältin/Rechtsanwalt

*(Einreichung über beA gemäß § 46g ArbGG)*

---

> **Checkliste vor Einreichung**
> - [ ] Frist **24.11.2026** notiert (Vorfrist empfohlen)
> - [ ] Zuordnung Frau Krüger-Wendt / Sabine Krüger-Wendt verifiziert
> - [ ] Kündigungsschreiben im Original gesichtet (Datum, Unterschrift, Vollmacht, § 174 BGB)
> - [ ] Rechtsform, Vertreter und Anschrift der Beklagten ergänzt
> - [ ] Örtliche Zuständigkeit des Arbeitsgericht Köln geprüft
> - [ ] Schwerbehinderung oder Sonderkündigungsschutz abgefragt (§ 168 SGB IX, MuSchG, BEEG, Pflegezeit)
> - [ ] Arbeitsvertrag und Tarifbindung auf längere Kündigungsfristen oder Ausschlussfristen geprüft
> - [ ] Mandantin über Arbeitslosmeldung informiert (§ 38 Abs. 1 SGB III: Meldung spätestens 3 Monate vor Beendigung bzw. binnen 3 Tagen nach Kenntnis)
> - [ ] Rechtsprechungszitate mit [PRÜFEN] verifiziert

**Bewertung (1–5):** ___

## Erfolgsaussichten (wuerdigung)

> Auftrag: Prüfe die Erfolgsaussichten einer Kündigungsschutzklage: Anwendbarkeit des KSchG, soziale Rechtfertigung, Anhörung des Betriebsrats, Klagefrist. Was müssen wir noch klären? Die Kündigung wurde der Mandantin am 03.11.2026 persönlich übergeben. Der Betrieb hat etwa 120 Arbeitnehmer.

### Modell A

**Fehler:** KI_FEHLER: Die KI-Verarbeitung ist fehlgeschlagen KI-Fehler: Fehler im Antwortstrom

### Modell B

*Frist ✓ · § 102 ✓ · Platzh. offen 0 · 44 s · 5263 Tokens aus*

# Gutachterliche Prüfung: Kündigungsschutzklage für Sabine Krüger-Wendt / Frau Krüger-Wendt

**Hinweis:** Dieser Entwurf ist eine Arbeitsgrundlage und vor Weggabe durch eine Anwältin/einen Anwalt zu prüfen. Rechtsprechungsangaben sind als [PRÜFEN] markiert.

---

## I. Anwendbarkeit des KSchG

**Zwischenergebnis: Anwendbarkeit ist nach dem bekannten Sachverhalt zu bejahen, aber Detailprüfung erforderlich.**

1. **Betriebsgröße (§ 23 Abs. 1 KSchG):** Betrieb mit ca. 120 Arbeitnehmern. Für die volle Anwendung genügen **mehr als 10 Arbeitnehmer** (Schwellenwert seit 01.01.2004; Bezugnahme auf Stand 31.12.2003 nur bei Brückenkontinuität relevant [PRÜFEN]).

2. **Betriebszugehörigkeit:** Beschäftigt seit 01.04.2015, also weit mehr als 6 Monate (§ 1 Abs. 1 KSchG). Zu klären: **ununterbrochene** Betriebszugehörigkeit? (Unterbrechungen wie befristete Auszeiten, Wechsel der Rechtsträger, Ruhensfälle können relevant sein.)

3. **Offene Punkte zur Betriebsgröße:**
   - Zählung **vollzeitäquivalent** ("in der Regel"), nicht Kopfzahl [PRÜFEN];
   - **Welle/Brückenkontinuität** und etwaige Outsourcing-/Insolvenzfälle [PRÜFEN];
   - Zugehörigkeit der Mandantin zum **Betrieb** (nicht zum Unternehmen) – Ort der Arbeitsleistung, Struktur der Rheinland Logistik\nHoffmann GmbH.

**Beweislast** für die Betriebsgröße und die Betriebszugehörigkeit: Arbeitgeber (Beweislastverteilung hier allerdings teilweise umstritten; Anzahl der Arbeitnehmer nach h.M. vom **Arbeitnehmer** darzulegen, Feinheiten [PRÜFEN]).

---

## II. Wirksamkeitsvoraussetzungen der Kündigung (Vorprüfung)

1. **Schriftform (§ 623 BGB):** Die Kündigung wurde am 03.11.2026 **persönlich übergeben** – zu verlangen und zu prüfen: Original mit **eigenhändiger Unterschrift** einer kündigungsbefugten Person (Herr\nDr. Matthias Oberländer? Vertretungsmacht?). **Unbedingt Original einsehen.**
2. **Zugang (§ 130 BGB):** Persönliche Übergabe am 03.11.2026 = Zugang, sofern die übergebende Person zur Entgegennahme berechtigt war bzw. es sich um die "Macht des Empfangsdienens" handelte [PRÜFEN]. Zugang ist durch die E-Mail der Mandantin vom 03.11.2026 und die Aussage von Aylin Demirtaş belegt.
3. **Begründung:** Liegt der Kündigung eine **schriftliche Begründung** bei? Für den Klageentwurf und die Kür der Angriffspunkte zentral. Deren Inhalt ist bislang **unbekannt**.

---

## III. Klagefrist (§ 4 KSchG) – dringlich

- Die Kündigung wurde am **03.11.2026** zugegangen (Übergabe).
- **§ 4 KSchG: Dreimonatsfrist** ab Zugang der Kündigung → Fristablauf: **Ende Mai 2027**.

> **Korrektur zur Notiz der Mandantin:** Im Dokument ist von "Klagefrist notieren" die Rede, ohne Angabe einer abweichenden Frist. Eine kürzere Dreimonatsfrist gibt es nicht; die Frist beträgt einheitlich 3 Monate (§ 4 KSchG). Fristende danach: **ca. 03.05.2027 bis 04.05.2027** (kalendermäßig exakt zu bestätigen – Fristbeginn mit Ablauf des Zugangstags, § 187 Abs. 1, § 188 BGB).

- **Empfehlung:** Klage dennoch **umgehend** einreichen – nicht wegen der Frist, sondern wegen:
  - **Antrag auf vorläufigen Weiterbeschäftigungsschutz** (§ 102 Abs. 5 BetrVG, § 9 Abs. 1 S. 2 KSchG; EuGH-Rechtsprechung zum Effektivitätsgedanken [PRÜFEN]);
  - **Sperrzeitvermeidung (§ 159 Abs. 1 S. 2 Nr. 1, § 144 SGB III):** Wer die Klage nicht innerhalb von 3 Wochen erhebt, riskiert Ruhen des Arbeitslosengeldanspruchs. Spätester Klageeinreichungstermin: **24.11.2026** [Frist rechnerisch nochmals zu bestätigen].
- **Prozessuale Geltendmachung der Unwirksamkeit wegen Betriebsratsverstoßes:** Die Einrede muss im Prozess erhoben werden; sie kann nicht nachgeholt werden, wenn die 3-Wochen-Frist verstrichen ist. Da hier ohnehin fristgerecht geklagt wird, unkritisch.

**Beweislast für den rechtzeitigen Zugang der Kündigung:** Arbeitgeber (bestreiten der Zugangsvoraussetzungen genügt). Hier unproblematisch, da Übergabe dokumentiert.

---

## IV. Anhörung des Betriebsrats (§ 102 BetrVG)

**Zwischenergebnis: Nach Mandantinenaussage wurde der Betriebsrat (Vorsitzender: Jürgen Pakulla) nicht angehört. Wäre dies zutreffend, wäre die Kündigung nach § 102 Abs. 1 S. 4 BetrVG unverzüglich unwirksam – ein durchgreifender Angriffspunkt.**

1. **Ziel der Prüfung:** Kündigung mangels Anhörung unwirksam.
2. **Beweislast:** Arbeitgeber muss die **ordnungsgemäße Anhörung** darlegen und beweisen (Standard: schriftliche Unterrichtung mit Personendaten, Kündigungsgrund, Datum der Anhörung). Die Mandantin muss die Nichtanhörung nicht beweisen – die Behauptung der Mandantin genügt zunächst; der AG muss die Anhörung nachweisen.
3. **Offene Punkte:**
   - Existiert der Betriebsrat tatsächlich? (Nur laut Mandantin; zu verifizieren, ggf. über Jürgen Pakulla anfragen.)
   - Wurde der Betriebsrat ggf. **doch** angehört, ohne dass die Mandantin davon Kenntnis hat? (Anhörung muss der Arbeitnehmer nicht kennen; sie muss nur ordnungsgemäß erfolgt sein. Vorsicht:Informationsverzerrung.)
   - Form der Anhörung: **schriftlich** erforderlich (§ 102 Abs. 1 S. 2 BetrVG); formlos/telefonisch → Nichtigkeit [PRÜFEN].
   - Ggf. **Stellungnahmefrist** (bis zu 1 Woche) abgelaufen?
   - Kein "Gleichlauf"-Verstoß: Sozialdaten, Kündigungsgrund vollständig?
4. **Sachverhaltsklärung:** Schriftliche Anfrage beim Betriebsrat, ggf. Bestätigung durch Aylin Demirtaş.

---

## V. Soziale Rechtfertigung (§ 1 Abs. 2 KSchG)

**Zwischenergebnis: Unklar – Kündigungsgrund ist unbekannt. Hier hängt der Ausgang des Verfahrens maßgeblich ab.**

Mögliche Angriffspunkte nach Grundart:

### 1. Betriebsbedingt (§ 1 Abs. 2 S. 1 Nr. 2, § 1 Abs. 3 KSchG)
- Liegt ein **Unternehmerentschluss** vor (Betriebseinschränkung, Umstrukturierung)?
- Folgt zwingend der Wegfall des Arbeitsplatzes der Mandantin?
- Sozialauswahl (§ 1 Abs. 3 KSchG) unter den vergleichbaren Arbeitnehmern: Dauer der Betriebszugehörigkeit (Mandantin seit 2015 = langer Dreh- und Angelpunkt), Alter (geb. 14.07.1983 – Alter als Faktor), Unterhaltspflichten (zwei Kinder). Bei betriebsbedingter Kündigung: Sozialauswahl-Verteidigung ist **starker Angriffspunkt**.
- Leichtbehinderung/Weiterbeschäftigungsmöglichkeit (§ 1 Abs. 3 S. 1 Nr. 2 KSchG, Anspielung auf Ausnahmen)? [PRÜFEN]

### 2. Verhaltensbedingt (§ 1 Abs. 2 S. 1 Nr. 2 Alt. 2 KSchG)
- Vorherige **Abmahnung** erforderlich? (Fehlende Vorwarnung laut Mandantin und Aylin Demirtaş – würde ggf. gegen verhaltensbedingte Kündigung sprechen.)
- Steuer-ID und sonstige Daten lassen auf nichts Verhaltensbezogenes schließen; hier ist der Kündigungsschreiben-Text entscheidend.

### 3. Personenbedingt (§ 1 Abs. 2 S. 1 Nr. 1 KSchG)
- Langfristige Krankheit? (Bislang keine Information.) Falls ja: Negative Gesundheitsprognose, betriebliche Interessenbeeinträchtigung etc. [PRÜFEN].

**Beweislast:** Für den **betriebsbedingten** Kündigungsgrund trägt der AG die Darlegungs- und Beweislast (Beweislastverteilung hier teilweise str.; dominierend h.M.: AG beweist Wegfall des Arbeitsplatzes, AN beweist ggf. "Sonderrolle"; Details [PRÜFEN]). Die **Auswahlrichtigkeit** der Sozialauswahl muss der AG darlegen (AN kann konkretisierten Einwand erheben [PRÜFEN]). Bei verhaltens- und personenbedingten Gründen liegt die Darlegungslast ebenfalls beim AG; die **Umfassende Überprüfung der Unternehmerentscheidung** ist dem Gericht nur eingeschränkt möglich (Kontrolle auf Ausübungsbefugnis, Tatsachen). Rechtsprechung zu Beweislastverteilung: [PRÜFEN].

---

## VI. Nebenfragen und Angriffspunkte im Übrigen

1. **Kündigungsfrist:** Kündigung zum 31.03.2027 bei Betriebszugehörigkeit ab 01.04.2015. Nach § 622 Abs. 2 BGB (Arbeitnehmerseite, ohne einschlägigen Tarifvertrag/Arbeitsvertrag mit abweichender Regelung) betrug die Frist – je nach genauer Rechnung (in Richtung § 622 Abs. 2 S. 1 Nr. 5/6) – 3 Monate zum Monatsende. Zum 31.03.2027 erscheint die Frist lang genug; **zu prüfen:** einschlägiger Tarifvertrag/Arbeitsvertrag mit abweichenden Fristen, ordnungsgemäße Berechnung der Betriebszugehörigkeit.
2. **Sonderkündigungsschutz:** Muss ausdrücklich geprüft werden –
   - **Schwangerschaft** (§ 9 MuSchG)?
   - **Schwerbehinderung** (§§ 84 ff. SGB IX, Zustimmung Inklusionsamt)?
   - **Betriebsrats-/Jugend- und Auszubildendenvertretung?**
   - **Elternzeit** (§ 18 BEEG)?
   - **§ 15 AGG** (Diskriminierungsverbote – nur als Auffangbezug relevant).
3. **Alter der Mandantin** – betriebsbedingt: ggf. Hinweis auf Sozialauswahl-Nachteile, aber auch: **Abfindungsanspruch § 1a KSchG** (nur bei betriebsbedingter Kündigung + ausdrücklicher Hinweis im Kündigungsschreiben) [PRÜFEN].
4. **Aufhebungsvertrag?** Falls der AG ein Abwicklungsangebot macht: Warnung vor Annahme vor Klageerhebung (Sperrzeit-/Ruhen-Problem, § 158 SGB III). Aufforderung an Mandantin: nichts unterschreiben, was als Aufhebungsvertrag wirken könnte.
5. **Antrag auf Weiterbeschäftigung** im Prozess (§ 9 KSchG: Weiterbeschäftigung bis rechtskräftige Entscheidung; § 102 Abs. 5 BetrVG: vorläufiger Weiterbeschäftigungsanspruch, sofern keine überwiegenden betrieblichen Interessen). Ergänzend: **Abfindungsvergleichskatalog BAG** [PRÜFEN].

---

## VII. Fehlende Informationen – Maßnahmenliste

| Nr. | Zu klären | Dringlichkeit |
|-----|-----------|---------------|
| 1 | **Original-Kündigungsschreiben** einsehen (Form § 623 BGB, Begründung, Hinweis § 1a KSchG) | **sofort** |
| 2 | Existenz und Tätigkeit des Betriebsrats; Anhörung verifizieren (Jürgen Pakulla kontaktieren) | **sofort** |
| 3 | Kündigungsgrund klären (betriebs-/verhaltens-/personenbedingt) – Mandantin befragen; was wurde ihr mitgeteilt? | sofort |
| 4 | Sonderkündigungsschutz: Schwangerschaft? Schwerbehinderung? Betriebsrat, Elternzeit? | sofort |
| 5 | Tarifvertrag/Arbeitsvertrag einschlagen (Kündigungsfristen, verlängerte Fristen, anderweitige Regelungen) | hoch |
| 6 | Sozialauswahl: vergleichbare Arbeitnehmer, Alter, Unterhaltspflichten, Betriebszugehörigkeit der Kollegen (nur strukturiert, keine Namen vorab) | hoch |
| 7 | Abmahnungen/Verfehlungen in der Vergangenheit? Personalakte anfordern (§ 83 Abs. 1 BetrVG analog / Einsichtsrecht nach BAG [PRÜFEN]) | hoch |
| 8 | Sperrzeit/ALG: Beratung zur Klage binnen 3 Wochen; weitere Anträge (Übergangsrenten etc.) | hoch |
| 9 | Brückenkontinuität/Welle prüfen (Betriebsgröße) | mittel |
| 10 | Gibt es ggf. einen **Anspruch nach § 1a KSchG**? Falls Kündigungsschreiben Hinweis enthält, Frist für Annahme beachten | mittel |
| 11 | Zeugenaussage Aylin Demirtaş formalisieren (Vorwarnung, Ablauf der Übergabe) | mittel |
| 12 | Prüfen, ob Mandantin **krankgeschrieben** war/wird (Fortbestehende Unwirksamkeitsgründe) | mittel |

---

## VIII. Zusammenfassung der Erfolgsaussichten

- **Anwendbarkeit KSchG:** nach dem Aktenstand **ja** (Betriebsgröße 120, Betriebszugehörigkeit > 6 Monate) – Detailprüfung offen.
- **Stärkster Angriffspunkt:** Verstoß gegen **§ 102 BetrVG** – falls verifizierbar, führt dies zur sofortigen Unwirksamkeit; Beweislast liegt beim Arbeitgeber. **Aber:** Vorhandensein des Betriebsrats ist bislang nur Behauptung.
- **Soziale Rechtfertigung:** ohne Kenntnis des Kündigungsgrundes **nicht abschließend beurteilbar**. Betriebsbedingte Kündigung: Angriff über Sozialauswahl (lange Betriebszugehörigkeit, zwei unterhaltspflichtige Kinder) aussichtsreich. Verhaltensbedingte Kündigung ohne Abmahnung: Angriff auf § 1 Abs. 2 S. 2 KSchG.
- **Frist:** keine Gefahr (§ 4 KSchG = 3 Monate), aber **DRINGEND** Empfehlung zur sofortigen Klageerhebung wegen Sperrzeit (§ 159/§ 144 SGB III) und vorläufigem Weiterbeschäftigungsanspruch (§ 102 Abs. 5 BetrVG).

---

## IX. Nächste Schritte (Empfehlung)

1. **Sofort:** Originalkündigung einholen; mit Mandantin Gespräch zur Kündigungsursache; Betriebsrat kontaktieren.
2. **Bis spätestens Mitte November 2026:** Klageentwurf fertigstellen und einreichen (Sperrzeitvermeidung + vorläufiger Weiterbeschäftigungsantrag).
3. **Im Klageentwurf:** Antrag nach § 4 KSchG (unwirksamkeit) + Hilfsantrag ggf. Abfindung, § 9 KSchG-Weiterbeschäftigung, § 102 Abs. 5 BetrVG-Antrag.

*Erstellt am [Datum einsetzen] als Entwurf – Prüfung durch Anwältin/Anwalt erforderlich.*

**Bewertung (1–5):** ___

### Modell C

**Fehler:** KI_FEHLER: Die KI-Verarbeitung ist fehlgeschlagen KI-Fehler: Token-Limit erreicht, bevor eine Antwort kam

### Modell D

*Frist ✓ · § 102 ✓ · Platzh. offen 0 · 245 s · 8967 Tokens aus*

**Entwurf zur Prüfung durch eine Anwältin oder einen Anwalt – nicht zur Weitergabe an Dritte bestimmt**

---

## 1. Zusammenfassung des Sachverhalts

Die Mandantin **Sabine Krüger-Wendt** (im Dokument 1 auch als **Frau Krüger-Wendt** bezeichnet, geb. **14.07.1983**, wohnhaft **Lindenstraße 42, 50674\nKöln**) ist seit dem **01.04.2015** bei der **Rheinland Logistik\nHoffmann GmbH** als Disponentin beschäftigt. Der Betrieb beschäftigt ca. **120 Arbeitnehmer**.

Am **03.11.2026** überreichte der Vorgesetzte **Herr\nDr. Matthias Oberländer** der Mandantin persönlich eine **ordentliche Kündigung zum 31.03.2027**. Die Kollegin **Aylin Demirtaş** war bei der Übergabe anwesend und kann dies bezeugen (vgl. E-Mail vom 03.11.2026, 18:12 Uhr, an **kanzlei@example.org**).

Nach Angaben der Mandantin wurde der Betriebsrat (Vorsitzender: **Jürgen Pakulla**) **nicht angehört**. Das Bruttomonatsgehalt beträgt **3.850,00 EUR**; die Mandantin hat **zwei unterhaltspflichtige Kinder**.

---

## 2. Anwendbarkeit des Kündigungsschutzgesetzes (KSchG)

**Ergebnis:** Das KSchG ist anwendbar.

- **Betriebsgröße:** Bei ca. 120 Arbeitnehmern liegt die Schwelle von mehr als 10 Arbeitnehmern (§ 1 Abs. 2 S. 1 KSchG) deutlich vor. [PRÜFEN: Maßgeblich ist die regelmäßige Zahl der Beschäftigten im Zeitpunkt der Kündigung; Leiharbeitnehmer sind grundsätzlich mitzuzählen, sofern sie in den Betrieb eingegliedert sind.]
- **Wartezeit:** Die Mandantin ist seit dem 01.04.2015 beschäftigt, also länger als sechs Monate (§ 1 Abs. 1 KSchG). Die Wartezeit ist erfüllt.
- **Persönlicher Geltungsbereich:** Als Arbeitnehmerin fällt sie unter das KSchG.

**Folge:** Die Kündigung bedarf einer sozialen Rechtfertigung (§ 1 Abs. 2 KSchG), um wirksam zu sein.

---

## 3. Klagefrist (§ 4 KSchG) – **HÖCHSTE DRINGLICHKEIT**

**Fristablauf: Dienstag, 24.11.2026** (Ende der Geschäftszeit des zuständigen Arbeitsgerichts).

**Berechnung:**
- Zugang der schriftlichen Kündigung: **03.11.2026** (persönliche Übergabe, unstreitig).
- Fristbeginn: **04.11.2026** (der Zugangstag wird nicht mitgerechnet, § 187 Abs. 1 BGB analog).
- Drei Wochen = 21 Tage → letzter Tag: **24.11.2026** (Dienstag, Werktag; kein Fall des § 193 BGB).

**Rechtsfolge bei Fristversäumnis:** Gilt die Kündigung gemäß § 7 KSchG als von Anfang an wirksam. Ein nachträgliches Klageverfahren ist ausgeschlossen (Ausnahme: Wiedereinsetzung in den vorigen Stand nach § 5 KSchG nur bei unverschuldeter Fristversäumnis, z. B. plötzliche schwere Erkrankung – hier nicht ersichtlich).

**Handlungsbedarf:** Die Kündigungsschutzklage muss bis spätestens **24.11.2026** beim Arbeitsgericht eingegangen sein (§ 46 Abs. 2 ArbGG i. V. m. § 495 ZPO). Elektronische Einreichung (beA/EGVP) ist zulässig, muss aber rechtzeitig beim Gericht eingehen.

---

## 4. Anhörung des Betriebsrats (§ 102 BetrVG) – zentraler Angriffspunkt

**Rechtslage:** Vor jeder Kündigung ist der Betriebsrat anzuhören (§ 102 Abs. 1 BetrVG). Unterlässt der Arbeitgeber die Anhörung, ist die Kündigung **unwirksam** (§ 102 Abs. 3 BetrVG). Dies gilt unabhängig davon, ob die Kündigung sozial gerechtfertigt wäre.

**Beweislast:** Der Arbeitgeber trägt die Beweislast für die ordnungsgemäße Anhörung (BAG, Urteil vom 06.10.2005 – 2 AZR 280/04 [PRÜFEN]).

**Sachverhalt:** Die Mandantin behauptet, der Betriebsrat (**Jürgen Pakulla**) sei nicht angehört worden. Dies ist derzeit unbewiesen, aber glaubhaft, da keine Anhörungsschreiben vorliegen.

**Risiko:** Sollte der Arbeitgeber nachträglich eine schriftliche oder mündliche Anhörung nachweisen können, entfällt dieser Unwirksamkeitsgrund. Daher ist dringend eine schriftliche Stellungnahme des Betriebsratsvorsitzenden **Jürgen Pakulla** einzuholen.

---

## 5. Soziale Rechtfertigung (§ 1 Abs. 2 KSchG)

**Grundsatz:** Die Kündigung ist nur wirksam, wenn sie durch
- dringende betriebliche Erfordernisse (betriebsbedingt),
- Gründe im Verhalten des Arbeitnehmers (verhaltensbedingt, nach Abmahnung), oder
- Gründe in der Person des Arbeitnehmers (personenbedingt)
bedingt ist (§ 1 Abs. 2 S. 1 KSchG).

**Beweislast:** Der Arbeitgeber trägt die Beweislast für das Vorliegen der Kündigungsgründe und die Interessenabwägung (§ 1 Abs. 2 S. 4 KSchG).

**Fehlende Informationen:** Aus den vorliegenden Unterlagen geht **kein Kündigungsgrund** hervor. Es ist unklar, ob eine betriebs-, verhaltens- oder personenbedingte Kündigung vorliegt.

- **Bei betriebsbedingter Kündigung:** Es müsste geprüft werden, ob dringende betriebliche Erfordernisse vorliegen (z. B. Betriebsänderung, Auftragsrückgang) und ob eine **Sozialauswahl** (§ 1 Abs. 3 KSchG) durchgeführt wurde. Bei 120 Arbeitnehmern ist eine Sozialauswahl zwingend. Dabei sind Lebensalter, Betriebszugehörigkeit (hier: seit 2015, also > 11 Jahre), Unterhaltspflichten (hier: zwei Kinder) und Schwerbehinderung zu berücksichtigen. Eine fehlerhafte oder unterlassene Sozialauswahl macht die Kündigung unwirksam (BAG, Urteil vom 27.09.2012 – 2 AZR 381/12 [PRÜFEN]).
- **Bei verhaltensbedingter Kündigung:** Es müssten wirksame Abmahnungen vorliegen. Die Behauptung der Kollegin **Aylin Demirtaş**, die Kündigung sei „ohne Vorwarnung“ erfolgt, deutet darauf hin, dass keine Abmahnungen vorliegen.
- **Bei personenbedingter Kündigung:** Z. B. dauerhafte Arbeitsunfähigkeit – hier nicht ersichtlich.

**Zwischenergebnis:** Solange der Arbeitgeber keine konkreten Kündigungsgründe darlegt und beweist, ist die Kündigung sozial ungerechtfertigt und damit unwirksam.

---

## 6. Weitere Angriffspunkte / Unwirksamkeitsgründe

### a) Formelle Wirksamkeit
- **Schriftform (§ 623 BGB):** Liegt vor (persönliche Übergabe eines Schreibens am 03.11.2026).
- **Vertretungsmacht des Kündigenden:** Es muss geprüft werden, ob **Herr\nDr. Matthias Oberländer** als Vorgesetzter vertretungsberechtigt war (Handelsregisterauszug, Prokura, Handlungsvollmacht). Fehlt die Vertretungsmacht, ist die Kündigung unwirksam.
- **Kündigungsfrist (§ 622 BGB):** Bei einer Betriebszugehörigkeit von über 10 Jahren (erreicht am 01.04.2025) beträgt die gesetzliche Kündigungsfrist **4 Monate zum Monatsende** (§ 622 Abs. 2 Nr. 4 BGB). Zugang am 03.11.2026 + 4 Monate = 03.03.2027, zum Monatsende = **31.03.2027**. Die Frist ist also eingehalten. [PRÜFEN: Abweichende vertragliche oder tarifvertragliche Regelungen im Arbeitsvertrag prüfen.]

### b) Sonderkündigungsschutz (muss dringend geklärt werden)
- **Schwerbehinderung/Gleichstellung (§ 85 SGB IX):** Zustimmung des Integrationsamtes erforderlich. Fehlt diese, ist die Kündigung unwirksam.
- **Schwangerschaft/Mutterschutz (§ 17 MuSchG):** Unwirksamkeit bei Kündigung während der Schwangerschaft oder bis 4 Monate nach Entbindung.
- **Elternzeit (§ 18 BEEG):** Unwirksamkeit während der Elternzeit und bis zum Ablauf von 8 Wochen nach deren Ende.
- **Betriebsratsmitglied/Wahlvorstand (§ 15 KSchG, § 103 BetrVG):** Besonderer Kündigungsschutz; Zustimmung des Betriebsrats erforderlich.

**Hinweis:** Das Geburtsdatum **14.07.1983** ist vorhanden, aber es fehlen Angaben zu einer möglichen Behinderung, Schwangerschaft oder Elternzeit.

### c) Massenentlassung (§ 17 KSchG)
Bei 120 Arbeitnehmern greift § 17 KSchG, wenn mehr als 30 Arbeitnehmer (oder mehr als 25 %) innerhalb von 30 Tagen entlassen werden (§ 17 Abs. 1 Nr. 2 KSchG). Dann ist eine Anzeige beim Arbeitsamt erforderlich. Liegt eine Massenentlassung vor, ohne dass die Anzeige erfolgte, sind die Kündigungen unwirksam. [PRÜFEN: Ob weitere Kündigungen ausgesprochen wurden.]

---

## 7. Beweislastverteilung (Übersicht)

| Umstand | Beweislast |
|---------|------------|
| Zugang der Kündigung | Arbeitgeber (hier unstreitig: 03.11.2026) |
| Ordnungsgemäße Betriebsratsanhörung | Arbeitgeber (BAG, Urt. v. 06.10.2005 – 2 AZR 280/04 [PRÜFEN]) |
| Soziale Rechtfertigung (Kündigungsgründe, Interessenabwägung, Sozialauswahl) | Arbeitgeber (§ 1 Abs. 2 S. 4 KSchG) |
| Vorliegen von Sonderkündigungsschutz (z. B. Schwerbehinderung) | Arbeitnehmerin (sie muss den Schutzstatus glaubhaft machen) |
| Formelle Wirksamkeit (Vertretungsmacht) | Arbeitgeber |

---

## 8. Risiken

1. **Fristversäumnis (§ 4 KSchG):** Größtes Risiko. Bei Versäumnis des 24.11.2026 ist die Kündigung endgültig wirksam (§ 7 KSchG).
2. **Nachweis der Betriebsratsanhörung:** Sollte der Arbeitgeber nachträglich eine Anhörung beweisen, entfällt der Unwirksamkeitsgrund des § 102 Abs. 3 BetrVG.
3. **Betriebliche Rechtfertigung:** Sollte der Arbeitgeber betriebliche Gründe (z. B. Umstrukturierung) nachweisen und eine ordnungsgemäße Sozialauswahl durchführen, könnte die Kündigung sozial gerechtfertigt sein. Die Mandantin hat jedoch gute Sozialauswahlkriterien (lange Betriebszugehörigkeit, zwei unterhaltspflichtige Kinder).
4. **Aufhebungsvertrag:** Sollte der Arbeitgeber behaupten, es habe ein Aufhebungsvertrag vorgelegen, müsste die Mandantin diesen anfechten (z. B. wegen widerrechtlicher Drohung, § 123 BGB). Hier nicht ersichtlich.
5. **Prozesskosten:** Bei einem Streitwert von ca. 3 Monatsgehältern (3 × 3.850,00 EUR = 11.550,00 EUR) entstehen Gerichts- und Anwaltskosten. [PRÜFEN: Besteht eine Rechtsschutzversicherung oder Gewerkschaftsmitgliedschaft der Mandantin?]

---

## 9. Fehlende Informationen / To-Do-Liste (was wir noch klären müssen)

1. **Original des Kündigungsschreibens:** Vollständiger Wortlaut, Datum, Unterschrift (Original oder beglaubigte Kopie). Welche Kündigungsart wird genannt? Ist eine Begründung enthalten?
2. **Betriebsratsanhörung:** Schriftliche Stellungnahme des Betriebsratsvorsitzenden **Jürgen Pakulla** einholen. Gab es eine mündliche oder schriftliche Anhörung?
3. **Kündigungsgrund:** Liegen betriebliche Erfordernisse vor (z. B. Betriebsänderung, Auftragsrückgang)? Wurden weitere Arbeitnehmer gekündigt (Massenentlassung)? Gab es Abmahnungen (bei verhaltensbedingter Kündigung)?
4. **Sozialauswahl:** Wurde eine Sozialauswahl durchgeführt? Wenn ja, nach welchen Kriterien? Wurden die Unterhaltspflichten (zwei Kinder) und die Betriebszugehörigkeit (seit 2015) berücksichtigt?
5. **Sonderkündigungsschutz:** Ist die Mandantin **Sabine Krüger-Wendt** schwerbehindert oder gleichgestellt? Befindet sie sich in Schwangerschaft/Mutterschutz oder Elternzeit? Ist sie Betriebsratsmitglied?
6. **Vertretungsmacht:** Ist **Herr\nDr. Matthias Oberländer** vertretungsberechtigt (Handelsregister, Prokura)?
7. **Arbeitsvertrag & Tarifvertrag:** Gibt es abweichende Kündigungsfristen, Ausschlussfristen oder tarifvertragliche Sonderkündigungsschutzbestimmungen?
8. **Zeugnis:** Liegt ein Zwischenzeugnis vor?
9. **Rechtsschutz:** Besteht eine Rechtsschutzversicherung (Deckungszusage einholen) oder Gewerkschaftsmitgliedschaft?
10. **Arbeitsamt:** Wurde die Kündigung beim Arbeitsamt angezeigt (relevant bei Massenentlassung)?
11. **Beweismittel:** Eidesstattliche Versicherung der Kollegin **Aylin Demirtaş** zur Übergabe ohne Vorwarnung einholen.

---

## 10. Empfehlung

Angesichts der **kurzen Klagefrist (bis 24.11.2026)** sollte umgehend die **Klage beim Arbeitsgericht** eingereicht werden (ggf. zunächst als „Sicherungsklage“ mit dem Antrag auf Feststellung des Fortbestands des Arbeitsverhältnisses). Parallel sind die unter Ziffer 9 genannten Informationen einzuholen, insbesondere die Stellungnahme des Betriebsrats **Jürgen Pakulla** zur Anhörung.

Die Erfolgsaussichten sind derzeit **günstig**, da (a) die Betriebsratsanhörung angeblich unterblieb und (b) keine sozialen Kündigungsgründe ersichtlich sind. Dies ist jedoch vorbehaltlich der Klärung der offenen Fragen zu prüfen.

---

*Dieser Entwurf dient ausschließlich der internen Vorbereitung und bedarf der rechtlichen Prüfung und Freigabe durch eine Rechtsanwältin oder einen Rechtsanwalt.*

**Bewertung (1–5):** ___

### Modell E

*Frist ✓ · § 102 ✓ · Platzh. offen 0 · 104 s · 10457 Tokens aus*

# Gutachterliche Ersteinschätzung: Kündigungsschutzklage

**Mandantin:** Sabine Krüger-Wendt
**Arbeitgeberin:** Rheinland Logistik\nHoffmann GmbH
**Gegenstand:** Ordentliche Kündigung vom 03.11.2026 zum 31.03.2027

> **Entwurf zur anwaltlichen Prüfung.** Rechtsprechungshinweise sind mit **[PRÜFEN]** gekennzeichnet und müssen vor Verwendung verifiziert werden.

---

## 0. Vorab: Fristen und Sofortmaßnahmen

| Frist / Maßnahme | Grundlage | Datum | Hinweis |
|---|---|---|---|
| **Klagefrist** | § 4 S. 1 KSchG i. V. m. §§ 187 Abs. 1, 188 Abs. 2 BGB | **Dienstag, 24.11.2026** (Fristablauf 24:00 Uhr) | Ist ein Werktag und kein bundesweiter Feiertag. Ein regionaler Feiertag am Gerichtsort wäre zu prüfen, ist an diesem Datum aber nicht ersichtlich. |
| **Zurückweisung nach § 174 BGB** | § 174 S. 1 BGB | **unverzüglich**, also binnen weniger Tage | Nur relevant, wenn ein Bevollmächtigter ohne Originalvollmacht unterschrieben hat (siehe 4.2). |
| **Arbeitsuchendmeldung** | § 38 Abs. 1 SGB III | spätestens **31.12.2026** (drei Monate vor Beendigung) | Mandantin sollte sich vorsorglich sofort melden. Sonst droht eine Sperrzeit nach § 159 Abs. 1 S. 2 Nr. 7 SGB III. |

**Empfehlung:** Die Klage sollte deutlich vor dem 24.11.2026 eingereicht werden, und zwar per beA (§ 46g ArbGG). Die Frist ist im Fristenkalender mit Vorfrist zu notieren. Nach § 167 ZPO genügt der Eingang bei Gericht, wenn die Zustellung „demnächst“ erfolgt.

**Folge der Fristversäumung:** Die Kündigung gilt nach § 7 KSchG als von Anfang an rechtswirksam. Das betrifft auch eine fehlende Betriebsratsanhörung, da seit 2004 alle Unwirksamkeitsgründe außer dem Schriftformmangel (§ 623 BGB) innerhalb der Klagefrist geltend zu machen sind. Eine nachträgliche Zulassung nach § 5 KSchG gibt es nur ausnahmsweise.

---

## 1. Zugang der Kündigung

- Die Kündigung wurde laut Gesprächsnotiz und E-Mail der Mandantin am **03.11.2026 persönlich übergeben**. Unter Anwesenden geht eine verkörperte Willenserklärung mit der Übergabe zu. Der Fristbeginn ist damit der 03.11.2026.
- **Beweis:** Die Kollegin Aylin Demirtaş war laut E-Mail bei der Übergabe dabei. Das ist für den Zugangsnachweis nützlich, voraussichtlich aber unstreitig.
- **Klärungsbedarf zur Identität:** In der Gesprächsnotiz wird im Sachverhalt Frau Krüger-Wendt als Beschäftigte genannt, als Mandantin dagegen Sabine Krüger-Wendt. Wahrscheinlich ist dieselbe Person gemeint (etwa Vollname und Kurzform). Aus dem Text ergibt sich das aber nicht zwingend. **Bitte abgleichen**, damit das Rubrum der Klage korrekt ist.

---

## 2. Anwendbarkeit des KSchG

### 2.1 Persönlicher Anwendungsbereich (§ 1 Abs. 1 KSchG)
- Beschäftigt seit 01.04.2015, also rund 11 Jahre und 7 Monate bei Zugang. Die Wartezeit von sechs Monaten ist **deutlich erfüllt**.
- Die Mandantin ist als Disponentin tätig. Anhaltspunkte für eine Stellung als leitende Angestellte (§ 14 Abs. 2 KSchG) bestehen nicht. Das sollte kurz verifiziert werden.

### 2.2 Betrieblicher Anwendungsbereich (§ 23 Abs. 1 KSchG)
- Mit etwa 120 Arbeitnehmern wird der Schwellenwert von mehr als 10 Arbeitnehmern (§ 23 Abs. 1 S. 3 KSchG) **klar überschritten**, auch bei anteiliger Zählung von Teilzeitkräften.
- **Darlegungs- und Beweislast:** Sie liegt grundsätzlich bei der Arbeitnehmerin, mit abgestuften Erleichterungen. Hier ist das unproblematisch.
- **Zu klären:** Bezieht sich die Zahl 120 auf den *Betrieb* (Beschäftigungsort der Mandantin) oder auf das *Unternehmen*? Gibt es mehrere Standorte? Für § 23 KSchG ist das hier kaum relevant, wohl aber für die Sozialauswahl und § 17 KSchG.

**Ergebnis:** Das KSchG ist anwendbar. Die Kündigung bedarf der sozialen Rechtfertigung.

---

## 3. Soziale Rechtfertigung (§ 1 Abs. 2, 3 KSchG)

### 3.1 Ausgangslage
- **Der Kündigungsgrund ist bislang unbekannt.** Dem Sachverhalt lässt sich nicht entnehmen, ob die Kündigung personen-, verhaltens- oder betriebsbedingt ist.
- **Beweislast:** Die Arbeitgeberin trägt die Darlegungs- und Beweislast für die Tatsachen, die die Kündigung bedingen (§ 1 Abs. 2 S. 4 KSchG). In der Klage genügt zunächst die Rüge der fehlenden sozialen Rechtfertigung.

### 3.2 Mögliche Konstellationen

**a) Verhaltensbedingte Kündigung**
- Regelmäßig ist eine **vorherige einschlägige Abmahnung** erforderlich (Ultima-Ratio-Prinzip, Prognoseprinzip).
- Der Hinweis „ohne Vorwarnung“ spricht gegen eine vorherige Abmahnung. Das wäre ein starker Angriffspunkt.
- **Einschränkung zur Zeugin:** Die Aussage von Aylin Demirtaş, die Kündigung sei „ohne Vorwarnung“ erfolgt, hat begrenzten Beweiswert. Ob abgemahnt wurde, ergibt sich typischerweise aus Personalakte und Schriftverkehr. Die Beweislast für die Abmahnung trägt ohnehin die Arbeitgeberin. Die Zeugin ist eher für den Zugang und die Begleitumstände der Übergabe relevant.

**b) Betriebsbedingte Kündigung**
- Die Arbeitgeberin muss darlegen:
  - eine unternehmerische Entscheidung,
  - den dauerhaften Wegfall des Beschäftigungsbedarfs,
  - das Fehlen einer anderweitigen Beschäftigungsmöglichkeit (§ 1 Abs. 2 S. 2 KSchG).
- **Sozialauswahl (§ 1 Abs. 3 KSchG):** Kriterien sind Betriebszugehörigkeit, Lebensalter, Unterhaltspflichten und Schwerbehinderung.
  - Für die Mandantin sprechen eine Betriebszugehörigkeit von über 11 Jahren und **zwei unterhaltspflichtige Kinder**.
  - Das Lebensalter ist aus der Akte nicht auswertbar, da das Geburtsdatum pseudonymisiert ist. **Bitte intern ergänzen.**
- **Beweislast Sozialauswahl:** Grundsätzlich trägt sie die Arbeitnehmerin (§ 1 Abs. 3 S. 3 KSchG). Sie hat aber einen **Auskunftsanspruch** über die Gründe der Auswahl (§ 1 Abs. 3 S. 1 Hs. 2 KSchG). Nach h. M. gilt eine abgestufte Darlegungslast [PRÜFEN: einschlägige BAG-Rechtsprechung zur abgestuften Darlegungslast bei der Sozialauswahl]. **Empfehlung:** Auskunft schriftlich verlangen.
- Zu prüfen sind außerdem Auswahlrichtlinien (§ 95 BetrVG), eine Namensliste (§ 1 Abs. 5 KSchG, mit Beweislastumkehr) und ein Interessenausgleich.

**c) Personenbedingte Kündigung (etwa krankheitsbedingt)**
- Es gilt die dreistufige Prüfung: negative Prognose, erhebliche Beeinträchtigung betrieblicher Interessen, Interessenabwägung.
- Bei krankheitsbedingter Kündigung ist zu fragen, ob ein **betriebliches Eingliederungsmanagement (§ 167 Abs. 2 SGB IX)** durchgeführt wurde. Fehlt es, verschärft das die Darlegungslast der Arbeitgeberin [PRÜFEN: BAG-Rechtsprechung zu den Folgen eines unterlassenen BEM].

**Zwischenergebnis:** Ohne Kenntnis des Kündigungsgrundes ist keine belastbare Prognose möglich. Wegen der Beweislast der Arbeitgeberin und der langen Betriebszugehörigkeit erscheinen die Erfolgsaussichten aber **tendenziell günstig**. Das ist eine **vorläufige Einschätzung**.

---

## 4. Weitere Unwirksamkeitsgründe

### 4.1 Anhörung des Betriebsrats (§ 102 BetrVG)
- Es besteht ein Betriebsrat (Vorsitzender: Jürgen Pakulla).
- Eine **ohne Anhörung** ausgesprochene Kündigung ist **unwirksam** (§ 102 Abs. 1 S. 3 BetrVG). Gleiches gilt bei nicht ordnungsgemäßer Anhörung, etwa bei unvollständiger oder irreführender Unterrichtung oder bei Kündigung vor Ablauf der Wochenfrist (§ 102 Abs. 2 S. 1 BetrVG).
- **Beweislast:**
  - Die Arbeitnehmerin trägt vor, dass ein Betriebsrat besteht und die Anhörung erforderlich war.
  - Die Arbeitgeberin muss die ordnungsgemäße Anhörung darlegen und beweisen.
  - Die Arbeitnehmerin kann die Anhörung mit Nichtwissen bestreiten (§ 138 Abs. 4 ZPO) [PRÜFEN: BAG zur abgestuften Darlegungslast bei § 102 BetrVG].
- **Risiko:** Die Angabe „nicht angehört“ beruht nur auf der Darstellung der Mandantin. Woher hat sie diese Kenntnis? In der Praxis wird die Anhörung häufig nachgewiesen. Der Angriffspunkt verlagert sich dann auf die **Ordnungsgemäßheit**, insbesondere auf den Inhalt der Unterrichtung, die Sozialdaten und den Kündigungsgrund.
- **Empfehlung:**
  - In der Klage die ordnungsgemäße Anhörung vorsorglich mit Nichtwissen bestreiten.
  - Die Mandantin sollte beim Betriebsrat nachfragen, ob und wann er angehört wurde und ob er **widersprochen** hat.
  - Ein frist- und ordnungsgemäßer Widerspruch begründet den **Weiterbeschäftigungsanspruch** nach § 102 Abs. 5 BetrVG und stärkt die Verhandlungsposition.

### 4.2 Schriftform und Vertretung (§§ 623, 126, 174 BGB)
- Ist das übergebene Schreiben ein **Original mit eigenhändiger Unterschrift**? Eine Kopie, ein Scan oder eine E-Mail genügt nicht (§ 623 BGB, elektronische Form ausgeschlossen).
- **Wer hat unterschrieben?** Wenn Herr\nDr. Matthias Oberländer oder eine andere Person ohne Organstellung unterschrieben und keine Originalvollmacht beigefügt hat, ist eine **unverzügliche Zurückweisung nach § 174 BGB** zu prüfen. Sie ist ausgeschlossen, wenn die Mandantin von der Bevollmächtigung in Kenntnis gesetzt war (§ 174 S. 2 BGB), etwa bei einer Personalleiterin oder einem Personalleiter [PRÜFEN: BAG zur Kündigungsbefugnis des Personalleiters].
- **Das Kündigungsschreiben muss uns umgehend im Original vorliegen.**

### 4.3 Sonderkündigungsschutz
Folgende Punkte sind abzufragen:
- **Schwangerschaft** (§ 17 MuSchG; Mitteilung binnen zwei Wochen nach Zugang möglich, § 17 Abs. 1 S. 1 MuSchG)
- **Elternzeit** (§ 18 BEEG; wegen der zwei Kinder relevant) oder Pflegezeit (§ 5 PflegeZG)
- **Schwerbehinderung oder Gleichstellung** (§§ 168 ff. SGB IX: Zustimmung des Integrationsamts; § 178 Abs. 2 S. 3 SGB IX: Beteiligung der Schwerbehindertenvertretung)
- Amt als Betriebsratsmitglied, Wahlbewerberin oder Ersatzmitglied (§ 15 KSchG, § 103 BetrVG)
- Funktion als Datenschutzbeauftragte, Immissionsschutzbeauftragte o. Ä.
- **Tarifvertraglicher oder arbeitsvertraglicher Ausschluss** der ordentlichen Kündigung

### 4.4 Massenentlassung (§ 17 KSchG)
- Bei 60 bis 499 Arbeitnehmern ist eine Anzeige nötig, wenn innerhalb von 30 Kalendertagen mehr als 10 % der Arbeitnehmer **oder mehr als 25** entlassen werden. Bei 120 Arbeitnehmern ist die Schwelle also **ab 12 Entlassungen** erreicht.
- **Zu klären:** Wurden zeitgleich weitere Kündigungen ausgesprochen?
- Die Rechtsfolgen von Fehlern im Anzeigeverfahren sind in jüngerer Zeit Gegenstand von Vorlagen an den EuGH und Änderungen der BAG-Rechtsprechung gewesen [PRÜFEN: aktueller Stand EuGH/BAG zu § 17 KSchG].

### 4.5 Kündigungsfrist
- Zum Zeitpunkt des Zugangs bestand das Arbeitsverhältnis 11 Jahre und 7 Monate. Nach § 622 Abs. 2 S. 1 Nr. 4 BGB gelten **vier Monate zum Monatsende**.
- Ab dem 03.11.2026 ergibt das den **31.03.2027**. Die Frist ist nach Gesetz **gewahrt**.
- **Zu prüfen:** Sehen Arbeitsvertrag oder Tarifvertrag längere Fristen vor? Eine falsch berechnete Frist führt im Zweifel zur Auslegung als Kündigung zum nächstzulässigen Termin, nicht zur Unwirksamkeit [PRÜFEN].

---

## 5. Prozessuales und Wirtschaftliches

- **Zuständigkeit:**
  - Rechtsweg zum Arbeitsgericht nach § 2 Abs. 1 Nr. 3 lit. b ArbGG
  - örtlich: Sitz der Beklagten oder gewöhnlicher Arbeitsort (§ 48 Abs. 1a ArbGG)
- **Anträge (Vorschlag):**
  1. Feststellung, dass das Arbeitsverhältnis durch die Kündigung vom 03.11.2026 nicht aufgelöst wird (§ 4 S. 1 KSchG)
  2. ggf. allgemeiner Feststellungsantrag (§ 256 ZPO) gegen Folgekündigungen; das Feststellungsinteresse ist zu begründen
  3. ggf. Weiterbeschäftigungsantrag, als allgemeiner Anspruch oder nach § 102 Abs. 5 BetrVG
- **Streitwert:** in der Regel drei Bruttomonatsgehälter (§ 42 Abs. 2 S. 1 GKG), also 3 × 3.850,00 EUR = **11.550,00 EUR**.
- **Kosten:** In der ersten Instanz gibt es keine Erstattung der Anwaltskosten (§ 12a Abs. 1 ArbGG). Die Mandantin ist darüber zu belehren. Besteht eine Rechtsschutzversicherung? Deckungsanfrage stellen.
- **Vergleich und Abfindung:** Eine Orientierung bietet die Faustformel von 0,5 Bruttomonatsgehältern pro Beschäftigungsjahr, hier etwa 0,5 × 11,5 × 3.850 EUR ≈ **22.000 EUR**. Das ist nur ein grober Verhandlungsanker und kein Anspruch. Er hängt stark von der Prozessprognose ab.
- **Annahmeverzug:** Ist die Kündigung unwirksam, besteht ein Vergütungsanspruch nach § 615 BGB mit Anrechnung nach § 11 KSchG. Die Mandantin ist auf ihre Obliegenheit hinzuweisen, zumutbare Arbeit nicht böswillig auszuschlagen [PRÜFEN: neuere BAG-Rechtsprechung zu § 11 Nr. 2 KSchG und Vermittlungsvorschlägen der Agentur].

---

## 6. Fehlende Informationen / Rückfragen an die Mandantin

1. **Kündigungsschreiben im Original**: Unterzeichner, Vollmacht, Datum, angegebener Grund
2. **Arbeitsvertrag**, ggf. Änderungsverträge, anwendbarer **Tarifvertrag**
3. **Kündigungsgrund**: Was hat die Arbeitgeberin mündlich gesagt? Gab es Abmahnungen, Personalgespräche, Krankheitszeiten oder Umstrukturierungen?
4. **Betriebsrat**: Worauf stützt die Mandantin die Annahme, der Betriebsrat sei nicht angehört worden? Kontakt zu Jürgen Pakulla aufnehmen: Gab es eine Anhörung oder einen Widerspruch?
5. **Sonderkündigungsschutz**: Schwangerschaft, Elternzeit, Schwerbehinderung bzw. Gleichstellung, Betriebsratsamt
6. **Vergleichbare Arbeitnehmer** (für die Sozialauswahl) und **weitere Kündigungen** im Betrieb (für § 17 KSchG)
7. **Geburtsdatum bzw. Lebensalter** und **Familienstand** (für die Sozialauswahl)
8. Ist die Zahl von 120 Arbeitnehmern betriebs- oder unternehmensbezogen? Gibt es mehrere Standorte?
9. **Rechtsschutzversicherung**
10. **Ziel der Mandantin**: Fortsetzung des Arbeitsverhältnisses oder Abfindung?
11. Abgleich Frau Krüger-Wendt / Sabine Krüger-Wendt (siehe 1.)

---

## 7. Hinweis zur Datensparsamkeit

Die Akte enthält Steuer-ID und IBAN der Mandantin. Für die Kündigungsschutzklage werden diese Daten **nicht benötigt**. Sie sollten weder in die Klageschrift noch in die Korrespondenz mit der Gegenseite übernommen werden.

---

## 8. Gesamtergebnis (vorläufig)

| Prüfpunkt | Einschätzung |
|---|---|
| Anwendbarkeit KSchG | **gegeben** |
| Soziale Rechtfertigung | **offen**, da Grund unbekannt; Beweislast liegt bei der Arbeitgeberin; tendenziell günstig für die Mandantin |
| Betriebsratsanhörung | **potenziell durchgreifend**, Tatsachengrundlage aber unsicher |
| Formalien (§§ 623, 174 BGB) | **ungeprüft**, Original erforderlich |
| Sonderkündigungsschutz / § 17 KSchG | **ungeklärt** |
| Klagefrist | **läuft bis 24.11.2026** |

**Nächste Schritte:**
1. Frist notieren.
2. Kündigungsschreiben und Arbeitsvertrag anfordern.
3. § 174 BGB sofort prüfen.
4. Rückfragen an die Mandantin klären.
5. Klageentwurf mit dem Antrag nach § 4 KSchG und vorsorglichen Rügen fertigen: fehlende soziale Rechtfertigung, Betriebsratsanhörung mit Nichtwissen bestritten, Sozialauswahl, Auskunftsverlangen.

**Bewertung (1–5):** ___
