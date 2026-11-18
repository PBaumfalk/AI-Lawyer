# 10 — Zeiterfassung und Abrechnung

Dieses Kapitel zeigt, wie AI-Lawyer Arbeitszeit je Akte erfasst, wie Sie Gebühren nach dem RVG berechnen und wie Rechnungen und das Aktenkonto mit Fremdgeld funktionieren. Es sagt auch offen, welche Teile des Finanzbereichs derzeit nur eingeschränkt nutzbar sind.

> **Wichtig:** Gebührenberechnungen, Rechnungen und Fremdgeld-Fristen aus AI-Lawyer sind Arbeitshilfen. Prüfen Sie jede Berechnung und jede Rechnung, bevor sie das Haus verlässt. Bekannte Abweichungen vom RVG stehen im Abschnitt [Grenzen des RVG-Rechners](#grenzen-des-rvg-rechners).

## Zeiterfassung

### Der Timer startet automatisch

AI-Lawyer erfasst Zeit ohne Ihr Zutun: **Sobald Sie eine Akte öffnen, startet ein Timer für diese Akte. Sobald Sie die Akte verlassen, hält er wieder an.** Es läuft immer höchstens ein Timer pro Person. Öffnen Sie eine andere Akte, wird der alte Timer beendet und ein neuer gestartet.

Jeder so entstandene Zeiteintrag

- dauert mindestens 1 Minute (auch wenn Sie die Akte nur kurz angesehen haben),
- ist als **Abrechenbar** markiert,
- hat zunächst keine Beschreibung und keine Kategorie.

Sehen Sie die automatisch erfassten Einträge deshalb regelmäßig durch und ergänzen Sie Beschreibung und Kategorie (siehe [Einträge nacharbeiten](#einträge-nacharbeiten)). Eine Möglichkeit, das automatische Starten abzuschalten, gibt es nicht.

### Das Timer-Feld in der Seitenleiste

Unten in der linken Seitenleiste (nur bei ausgeklappter Leiste) steht das Timer-Feld:

- Läuft kein Timer, steht dort **Kein Timer aktiv**.
- Läuft einer, sehen Sie einen grünen Punkt, das Aktenzeichen und die laufende Zeit (Stunden:Minuten:Sekunden). Mit **Stop** beenden Sie ihn.

Das Feld fragt den Stand alle 30 Sekunden neu ab. Die Sekunden zählt es selbst weiter.

### Stundenhonorar-Akten: Tätigkeit ist Pflicht

Steht in den Falldaten der Akte als Rechnungstyp bzw. Abrechnungsart ein Wert mit „Stundenhonorar“, verlangt AI-Lawyer beim Stoppen eine Beschreibung:

1. Auf **Stop** klicken.
2. Im Feld **Taetigkeit (Pflichtangabe)** eintragen, was Sie gemacht haben (Platzhalter: *Was wurde gemacht?*).
3. **Stoppen** klicken. **Abbrechen** lässt den Timer weiterlaufen.

Bei solchen Akten hält der Timer beim Verlassen der Akte **nicht** von selbst an, weil die Pflichtangabe fehlt. Er läuft weiter, bis Sie ihn über die Seitenleiste mit Beschreibung stoppen oder eine andere Akte öffnen.

### Zeiterfassung in der Akte

In der Akte führt die Kennzahl **Zeiterfassung** im Kopf direkt zum Abschnitt **Zeiterfassung** im Reiter **Finanzen**. Dort finden Sie:

| Anzeige | Bedeutung |
| --- | --- |
| **Gesamt** | Alle erfassten Minuten dieser Akte |
| **Abrechenbar** | Davon als abrechenbar markierte Zeit |
| **Eff. Stundensatz** | Durchschnittlicher Stundensatz der abrechenbaren Einträge |

Darunter stehen die Knöpfe:

- **Timer starten** startet den Timer für diese Akte. Läuft schon einer für eine andere Akte, erklärt ein Hinweis: *Timer laeuft bereits fuer eine andere Akte*.
- **Stop** erscheint, solange der Timer für diese Akte läuft.
- **Manueller Eintrag** öffnet das Formular **Neuer Zeiteintrag**.

### Zeit von Hand erfassen

1. Im Reiter **Finanzen** der Akte auf **Manueller Eintrag** klicken.
2. **Dauer (Minuten)** eintragen, z. B. `30`.
3. **Beschreibung** ausfüllen (Platzhalter: *Taetigkeit beschreiben*).
4. **Speichern** klicken.

Der Eintrag erhält das heutige Datum und gilt als abrechenbar. Ein anderes Datum, eine Kategorie oder „nicht abrechenbar“ lassen sich im Formular nicht wählen. Die Kategorie können Sie danach in der Tabelle setzen.

### Einträge nacharbeiten

Die Tabelle zeigt **Datum**, **Beschreibung**, **Kategorie**, **Dauer**, **Bearbeiter** und **Status**.

- Klick auf die Beschreibung (oder auf **Beschreibung hinzufuegen**) macht sie bearbeitbar. **Enter** speichert, **Esc** bricht ab. Bestätigung: *Beschreibung gespeichert*.
- Klick auf die Kategorie (oder **Keine Kategorie**) öffnet eine Auswahl. Bestätigung: *Kategorie gespeichert*.

Der **Status** lautet **Abrechenbar**, **Intern** (nicht abrechenbar) oder **Abgerechnet**. Abgerechnete Einträge lassen sich nicht mehr ändern.

### Tätigkeitskategorien und Stundensätze

Beim ersten Abruf legt AI-Lawyer für die Kanzlei diese Kategorien an: **Besprechung**, **Gericht**, **Recherche**, **Reise**, **Schriftsatz**, **Telefonat** (abrechenbar) und **Sonstiges** (nicht abrechenbar). Neue Kategorien anlegen oder ändern dürfen nur Admins, allerdings nur über die Programmschnittstelle; eine Verwaltungsseite gibt es dafür nicht.

Ein Stundensatz wird bei manuellen Einträgen aus dem Standard-Stundensatz der Kanzlei übernommen. Diesen Wert kann man in der Oberfläche derzeit nicht pflegen. Timer-Einträge erhalten keinen Stundensatz. **Eff. Stundensatz** bleibt daher oft bei 0,00 €.

## Der Bereich Finanzen

**Finanzen** in der Seitenleiste öffnet die Übersicht. Oben stehen vier Reiter: **Uebersicht**, **Rechner**, **Rechnungen** und **Aktenkonto**.

![Finanzen-Übersicht mit Kennzahlen und Schnellaktionen](../screenshots/finanzen.png)

Die Übersicht zeigt Kennzahlen:

| Kennzahl | Bedeutung | Sichtbar für |
| --- | --- | --- |
| **Gesamtumsatz** | Summe (netto) der bezahlten Rechnungen | nur Admin und Anwalt |
| **Offene Forderungen** | Summe (netto) der gestellten und gemahnten Rechnungen | alle |
| **Ueberfaellige Rechnungen** | Anzahl gestellter oder gemahnter Rechnungen nach Fälligkeit | alle |
| **Fremdgeld-Warnungen** | Anzahl offener Fremdgeld-Weiterleitungsfristen | alle |

Unter **Schnellaktionen** führen **Neue Berechnung** zum RVG-Rechner, **Neue Rechnung** zur Rechnungsliste und **Banking-Import** zum Aktenkonto. Einen Kontoauszug-Import mit Oberfläche gibt es dort allerdings nicht (siehe [Was nur über die Schnittstelle geht](#was-nur-über-die-schnittstelle-geht)).

### Wer welche Zahlen sieht

- Admins sehen Rechnungen, Buchungen und Zeiten der ganzen Kanzlei.
- Anwältinnen und Anwälte sehen kanzleiweit nur, wenn ein Admin bei ihnen **Kanzleiweite Finanzen** eingeschaltet hat ([Kapitel 15](15-benutzer-und-rollen.md)). Sonst nur Daten der Akten, auf die sie Zugriff haben.
- Sachbearbeitung und Sekretariat sehen nur Daten ihrer zugänglichen Akten.
- Das Sekretariat darf keine Fremdgeld-Buchungen anlegen. Buchungen stornieren dürfen nur Anwalt und Admin.

## Der RVG-Rechner

Reiter **Rechner** (Seite **RVG-Rechner**). Der Rechner verwendet die Gebührentabelle nach dem KostBRÄG 2025 (Anlage 2 zu § 13 RVG).

![RVG-Rechner mit Streitwert, Positionen und Ergebnis](../screenshots/rvg-rechner.png)

### So rechnen Sie

1. Unter **Streitwert / Gegenstandswert** den Wert eingeben, z. B. `5.000,00`. Mit **Vorschlaege** sehen Sie Faustformeln, etwa *Kuendigungsschutzklage: 3 x Bruttomonatsgehalt*. Ein Klick übernimmt den Beispielbetrag, den Sie dann anpassen.
2. Unter **Schnellauswahl (Presets)** einen typischen Fall wählen oder mit **manuell hinzufuegen** einzelne Positionen suchen (*VV-Nummer oder Bezeichnung suchen...*).
3. Je Position den **Gebuehrensatz** mit dem Schieberegler anpassen (Schritte zu 0,1, begrenzt auf den gesetzlichen Rahmen). Bei VV 1008 statt dessen die Zahl der **Auftraggeber** eintragen.
4. Rechts unter **Berechnung** das Ergebnis ablesen: Einzelpositionen, **Zwischensumme (netto)**, **USt (19%)** und **Gesamtbetrag**.

Die Presets:

| Preset | Positionen |
| --- | --- |
| **Typisches Klageverfahren 1. Instanz** | VV 3100, 3104 |
| **Aussergerichtliche Vertretung** | VV 2300 |
| **Klageverfahren mit Einigung** | VV 3100, 3104, 1003 |
| **Berufung** | VV 3200, 3202 |
| **Mahnverfahren** | VV 3305 |

Auslagenpauschale und Umsatzsteuer kommen automatisch dazu. Mit den Häkchen **VV 7002 Auslagenpauschale** und **VV 7008 USt (19%)** schalten Sie sie ab.

Sind VV 2300 und VV 3100 zugleich gewählt, rechnet AI-Lawyer die Geschäftsgebühr zur Hälfte, höchstens mit 0,75, auf die Verfahrensgebühr an (Vorbem. 3 Abs. 4 VV RVG). Die betroffene Position wird gelb hinterlegt, und unter der Berechnung steht die Herleitung.

Ergebnis weitergeben:

- **Kopieren als Text** legt die Aufstellung in die Zwischenablage (Bestätigung **Kopiert!**).
- **DAV Vergleich** öffnet den Prozesskostenrechner des DAV mit dem Streitwert in einem neuen Tab, zum Gegenprüfen.

Die Knöpfe **Berechnung speichern** und **Uebernehmen als Rechnung** erscheinen nur, wenn der Rechner mit einem Aktenbezug geöffnet wurde. Keine Seite in AI-Lawyer öffnet ihn derzeit so, und beide Funktionen speichern im aktuellen Stand nicht zuverlässig. Nutzen Sie den Rechner deshalb als eigenständige Rechenhilfe.

### Grenzen des RVG-Rechners

Bitte bei der Prüfung besonders beachten:

- **VV 3305 (Mahnverfahren)** ist mit einem Satz von 0,5 voreingestellt. Das Gesetz sieht für den Antragsteller 1,0 vor. Stellen Sie den Regler von Hand auf 1,0.
- **Gebührentabelle:** Es gilt immer die Tabelle für das heutige Datum. Für Aufträge vor dem 1. Juni 2025 (§ 60 RVG) muss die alte Tabelle verwendet werden. Das kann der Rechner nicht.
- **Auslagenpauschale:** Sie wird einmal für die ganze Berechnung angesetzt (20 %, höchstens 20 €). Umfasst die Berechnung mehrere Angelegenheiten, etwa außergerichtliche Vertretung und Klageverfahren, steht sie Ihnen je Angelegenheit zu.
- **Anrechnung** erkennt der Rechner nur zwischen VV 2300 und VV 3100.
- **Nur 14 Positionen** stehen zur Auswahl (Teile 1, 2, 3 und 7 VV). Betragsrahmengebühren, etwa im Straf- oder Sozialrecht, fehlen.
- **VV 2300 über 1,3:** Der Regler geht bis 2,5. Ob die Tätigkeit umfangreich oder schwierig war, prüft der Rechner nicht.
- Der **Mindestbetrag** einer Gebühr (§ 13 Abs. 2 RVG) wird nicht gesondert geprüft.

## Rechnungen

### Bekannter Fehler: Rechnungsliste bricht ab

Im aktuellen Stand lässt sich die Rechnungsliste nicht öffnen. Statt der Liste erscheint *Fehler im Dashboard: Cannot read properties of undefined (reading 'toFixed')*. Ursache: Die Liste will eine Kennzahl **Stornoquote** anzeigen, die der Server nicht liefert. Betroffen sind der Reiter **Rechnungen** und der Abschnitt **Rechnungen** im Reiter **Finanzen** der Akte, der dieselbe Liste verwendet. Die Behebung ist eingeplant.

### Rechnungstypen, Nummern und Inhalt

Eine Rechnung hat einen der Typen **RVG**, **Stundenhonorar** oder **Pauschale**, gehört immer zu einer Akte und setzt voraus, dass dort ein Mandant als Beteiligter eingetragen ist. Jede Position hat Beschreibung, Menge, Einzelpreis und einen eigenen USt-Satz. Die Umsatzsteuer wird je Steuersatz summiert.

Die Rechnungsnummer vergibt AI-Lawyer beim Anlegen fortlaufend je Jahr, im Format `RE-2026-0001`. Stornorechnungen bekommen einen eigenen Nummernkreis, `GS-2026-0001`. Das Zahlungsziel beträgt ohne andere Kanzlei-Vorgabe 14 Tage.

Eine Eingabemaske zum Anlegen einer Rechnung gibt es derzeit nicht. Der Weg aus dem RVG-Rechner (**Uebernehmen als Rechnung**) funktioniert ebenfalls nicht zuverlässig (siehe oben). Rechnungen entstehen deshalb im Moment nur über die Programmschnittstelle.

### Die Rechnungsliste

Wenn sie wieder läuft: Suchfeld (*Rechnungsnr., Mandant, Aktenzeichen...*), Statusfilter (**Alle Status**, **Entwurf**, **Gestellt**, **Bezahlt**, **Storniert**) und das Häkchen **Nur ueberfaellige**. Überfällige Rechnungen zeigen *… Tage ueberfaellig*, ab 14 Tagen orange, ab 30 Tagen rot. Die Knöpfe **Alle stellen**, **PDFs herunterladen** und **Mahnungen senden**, die bei markierten Rechnungen erscheinen, haben noch keine Funktion.

### Status-Ablauf

| Status | Bedeutung | Mögliche nächste Schritte |
| --- | --- | --- |
| **Entwurf** | Noch änderbar und löschbar | Gestellt, Storniert |
| **Gestellt** | Rechnungsdatum und Fälligkeit stehen fest | Bezahlt, Mahnung, Storniert |
| **Mahnung** | Mindestens eine Mahnstufe erzeugt | Bezahlt, Storniert |
| **Bezahlt** | Abgeschlossen | – |
| **Storniert** | Abgeschlossen | – |

In der Rechnungsansicht stehen je nach Status diese Knöpfe zur Verfügung. Jeder Schritt verlangt eine Bestätigung mit **Bestaetigen** oder **Abbrechen**:

| Status | Knopf | Was passiert | Stand heute |
| --- | --- | --- | --- |
| Entwurf | **Stellen** | *Rechnung jetzt stellen? Das Rechnungsdatum wird festgeschrieben.* Fälligkeit = heute + Zahlungsziel. Im Aktenkonto entsteht die Buchung *Forderung: Rechnung …*. | funktioniert |
| Entwurf | **Loeschen** | *Entwurf endgueltig loeschen?* | funktioniert |
| Entwurf | **Bearbeiten** | soll den Entwurf öffnen | Seite fehlt noch |
| Gestellt | **PDF**, **XRechnung** | Download, siehe unten | funktioniert |
| Gestellt | **Stornieren** | *Rechnung stornieren? Eine Stornorechnung wird erstellt.* Die Forderungsbuchung im Aktenkonto wird storniert. | funktioniert |
| Gestellt | **Bezahlt markieren** | soll die Rechnung auf Bezahlt setzen | ohne Wirkung |
| Gestellt | **Mahnung** | soll die nächste Mahnstufe erzeugen | ohne Wirkung |
| Bezahlt | **PDF herunterladen** | Download | funktioniert |

Für Rechnungen im Status **Mahnung** zeigt die Ansicht keine Knöpfe.

### Mahnstufen

Vorgesehen sind vier Stufen: Erinnerung, erste, zweite und dritte Mahnung. Die Rechnungsansicht listet erzeugte Mahnungen mit Stufe, Datum und **Gesendet** oder **Offen**. Im aktuellen Stand lässt sich nur die erste Stufe (Erinnerung) erzeugen, und auch das nur über die Programmschnittstelle. Einen Mahnversand gibt es nicht.

### Teilzahlungen

Eine Rechnung kann mehrere Teilzahlungen haben. Die Ansicht zeigt sie unter **Teilzahlungen** und darunter den **Restbetrag**. Teilzahlungen entstehen nur, wenn ein importierter Kontoumsatz einer Rechnung zugeordnet wird. Dafür gibt es keine Oberfläche (siehe unten). Von Hand lässt sich keine Teilzahlung erfassen.

### Storno und Korrektur

Ein Entwurf wird beim Stornieren einfach auf **Storniert** gesetzt. Bei einer gestellten oder gemahnten Rechnung legt AI-Lawyer eine Stornorechnung mit eigener GS-Nummer an. Sie trägt den Vermerk *Stornierung von RE-…*. Die ursprüngliche Rechnung bleibt erhalten. Für eine Korrektur stornieren Sie und stellen eine neue Rechnung aus.

### PDF und E-Rechnung

- **PDF** erzeugt die Rechnung mit den Kanzlei-Stammdaten im Kopf und in der Fußzeile: Name, Anschrift, Telefon, E-Mail, Steuernummer, USt-IdNr. und Bank. Eine Maske zum Pflegen dieser Stammdaten gibt es derzeit nicht ([Kapitel 16](16-einstellungen-und-vorlagen.md#kanzlei-stammdaten)). Die Vorlagen aus dem Briefkopf-Editor werden hier nicht verwendet. Eine Kopie des PDFs wird im Dokumentenspeicher abgelegt.
- **XRechnung** lädt eine XML-Datei im Format XRechnung (CII, EN 16931), Dateiname `<Rechnungsnummer>_xrechnung.xml`. Das geht nur für gestellte oder bezahlte Rechnungen und nur, wenn bei der Kanzlei Steuernummer oder USt-IdNr. eingetragen ist.

## Aktenkonto und Fremdgeld

Reiter **Aktenkonto**: Unter **Akte auswaehlen** Aktenzeichen oder Mandant eintippen (ab zwei Zeichen) und die Akte aus der Liste wählen. Dasselbe Aktenkonto steht auch im Reiter **Finanzen** jeder Akte.

![Aktenkonto einer Akte mit Saldo, Fremdgeld und Kontobuch](../screenshots/aktenkonto.png)

Oben stehen **Saldo** (Einnahmen minus Ausgaben und Auslagen, ohne Fremdgeld), **Fremdgeld**, **Offene Forderungen** und **Auslagen**. Darunter liegen zwei Reiter, **Kontobuch** und **Fremdgeld**.

### Buchung anlegen

1. **Neue Buchung** klicken.
2. **Buchungstyp** wählen: **Einnahme**, **Ausgabe**, **Fremdgeld** oder **Auslage**.
3. **Betrag** eintragen (z. B. `1.500,00`, immer positiv; Ausgaben und Auslagen bucht AI-Lawyer als Minus).
4. **Verwendungszweck** angeben.
5. **Konto** wählen: **Geschaeftskonto** oder **Anderkonto**.
6. **Buchen** klicken.

Buchungen lassen sich nicht ändern oder löschen, nur stornieren (GoBD). Stornierte Buchungen erscheinen durchgestrichen. Das Stornieren über den Knopf in der Zeile (Dialog **Buchung stornieren**, Feld *Grund fuer die Stornierung*) schlägt im aktuellen Stand allerdings fehl, die Buchung bleibt bestehen.

### Fremdgeld und Weiterleitungsfrist

Für jede Fremdgeld-Buchung berechnet AI-Lawyer eine Weiterleitungsfrist von **5 Werktagen** ab Buchungsdatum. Wochenenden und Feiertage zählen nicht mit; maßgeblich ist der Feiertagskalender von Nordrhein-Westfalen. Offene Fristen erscheinen als Hinweis *Fremdgeld-Weiterleitung faellig* mit Eingang, Frist und verbleibenden Werktagen:

| Farbe | Bedeutung |
| --- | --- |
| blau | mehr als 3 Werktage übrig |
| gelb | 1 bis 3 Werktage |
| orange | Frist endet heute |
| rot, **UEBERFAELLIG** | Frist verstrichen |

Liegt die Summe des Fremdgelds einer Akte bei 15.000 € oder mehr, warnt AI-Lawyer: *15.000 EUR Anderkonto-Schwelle ueberschritten!*

Bitte beachten: Die Fünf-Tage-Frist ist eine Regel der Software. Was berufsrechtlich unverzüglich ist und wann ein Anderkonto Pflicht ist, beurteilen Sie selbst. Die Warnung verschwindet nur, wenn die Fremdgeld-Buchung storniert wird. Eine Weiterleitung als Ausgabe gebucht beendet sie nicht.

### Kostenstellen und Buchungsperioden

Admins können Kostenstellen anlegen und Buchungsmonate sperren. In einem gesperrten Monat lehnt AI-Lawyer neue Buchungen ab. Beides geht nur über die Programmschnittstelle; eine Verwaltungsseite gibt es noch nicht.

## Was nur über die Schnittstelle geht

Folgende Funktionen sind auf dem Server vorhanden, haben aber noch keinen Knopf in der Oberfläche:

| Funktion | Inhalt | Berechtigt |
| --- | --- | --- |
| DATEV-Export | Buchungsstapel (EXTF-CSV) für den Steuerberater, SKR03 oder SKR04 | Admin, Anwalt |
| SEPA-Export | XML für Überweisungen (pain.001) oder Lastschriften (pain.008) | Admin, Anwalt |
| CSV/XLSX-Export | Rechnungen, Buchungen, Zeiterfassung | alle angemeldeten Nutzer |
| Kontoauszug-Import | CSV oder CAMT.053, mit Zuordnung zu Rechnungen | – |
| Kostenstellen, Buchungsperioden | anlegen, sperren, entsperren | Admin |

Wenn Sie diese Funktionen brauchen, wenden Sie sich an die IT ([Kapitel 22](22-architektur-und-entwicklung.md)).

## Wenn etwas nicht klappt

| Meldung | Bedeutung | Was tun |
| --- | --- | --- |
| *Fehler im Dashboard: Cannot read properties of undefined (reading 'toFixed')* | Bekannter Fehler der Rechnungsliste | Abwarten bis zur Behebung, siehe [oben](#bekannter-fehler-rechnungsliste-bricht-ab) |
| *Taetigkeitsbeschreibung ist Pflicht bei Stundenhonorar-Akten* | Timer einer Stundenhonorar-Akte ohne Beschreibung gestoppt | Über die Seitenleiste mit Tätigkeit stoppen |
| Timer läuft nach Verlassen der Akte weiter | Stundenhonorar-Akte | Wie oben |
| *Bereits abgerechnete Eintraege koennen nicht bearbeitet werden* | Zeiteintrag ist abgerechnet | Nichts ändern; ggf. Rechnung stornieren |
| *Fehler beim Speichern* | Beschreibung oder Kategorie nicht gespeichert | Seite neu laden, erneut versuchen |
| *Akte hat keinen Mandanten zugeordnet* | Rechnung ohne Mandant in der Akte | In der Akte einen Mandanten als Beteiligten eintragen ([Kapitel 3](03-akten.md)) |
| *Kanzlei muss Steuernummer oder USt-IdNr konfiguriert haben fuer E-Rechnung-Erstellung. …* | Für XRechnung fehlen Steuerdaten | Die IT trägt sie in den Kanzlei-Stammdaten ein ([Kapitel 16](16-einstellungen-und-vorlagen.md#kanzlei-stammdaten)) |
| *E-Rechnung nur fuer gestellte oder bezahlte Rechnungen verfuegbar. …* | Rechnung ist noch Entwurf | Erst stellen |
| *Keine Berechtigung. Sekretariat darf keine Fremdgeld-Buchungen erstellen.* | Rollenbeschränkung | Anwalt oder Admin bucht |
| *Buchungsperiode MM/JJJJ ist gesperrt. Keine Buchungen moeglich.* | Monat abgeschlossen | Admin entsperrt den Monat oder Buchungsdatum prüfen |
| **Bezahlt markieren** oder **Mahnung** ohne Wirkung | Bekannter Fehler | Derzeit nicht über die Oberfläche möglich |
| Rechner zeigt *Bitte Streitwert eingeben.* / *Bitte VV-Positionen hinzufuegen.* | Eingabe fehlt | Streitwert eintragen bzw. Position wählen |

---

Weiter: [11 — Team-Nachrichten](11-team-nachrichten.md) · [Zur Übersicht](README.md)
