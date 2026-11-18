# 13 — Suche und Auswertung

Dieses Kapitel zeigt, wie Sie Akten, Kontakte und Dokumente schnell wiederfinden, wie das BI-Dashboard Kennzahlen der Kanzlei darstellt und wo Sie Listen und Berichte als CSV, Excel oder PDF herunterladen können.

## Die Schnellsuche (⌘K)

Die Schnellsuche erreichen Sie von jeder Seite aus:

1. Oben in der Kopfleiste auf das Feld **Suchen...** klicken oder **⌘ + K** (Mac) bzw. **Strg + K** (Windows) drücken.
2. Im Fenster **Suchen oder Aktion ausführen...** einen Begriff eintippen.
3. Mit den Pfeiltasten einen Treffer wählen und **Enter** drücken, oder den Treffer anklicken.

Mit **Esc** oder einem Klick neben das Fenster schließen Sie es wieder. Dieselbe Tastenkombination öffnet und schließt es abwechselnd.

### Ohne Suchbegriff: Navigation und Aktionen

Solange das Feld leer ist, zeigt die Schnellsuche feste Einträge:

| Gruppe | Einträge |
| --- | --- |
| **KI** | **Helena fragen** |
| **Navigation** | **Dashboard**, **Akten**, **Kontakte**, **Kalender**, **Dokumente**, **Einstellungen** |
| **Aktionen** | **Neue Akte anlegen**, **Neuen Kontakt anlegen**, **Neuen Termin anlegen**, **Frist berechnen** |

Tippen Sie z. B. „Kont“, filtert die Liste auf passende Einträge. **Frist berechnen** öffnet den Fristenrechner ([Kapitel 6](06-fristen-und-kalender.md)). **Helena fragen** öffnet den Chat mit Helena ([Kapitel 9](09-helena.md)); steht dabei schon Text im Suchfeld, wird er als Frage übernommen.

### Mit Suchbegriff: Akten, Kontakte, Dokumente

Sobald Sie tippen, sucht AI-Lawyer nach einer kurzen Pause (0,3 Sekunden) gleichzeitig in drei Bereichen und zeigt je bis zu fünf Treffer:

| Gruppe | Wo gesucht wird | Was angezeigt wird |
| --- | --- | --- |
| **Akten** | Aktenzeichen, Kurzrubrum, „wegen“ | Aktenzeichen — Kurzrubrum und der Status (z. B. `OFFEN`, `RUHEND`) |
| **Kontakte** | Nachname, Vorname, Firma, Kurzname, E-Mail, Ort, PLZ, Straße, Telefon, Mandantennummer, USt-IdNr. | Name, **Person** oder **Firma**, E-Mail |
| **Dokumente** | Volltext über den Suchdienst (siehe unten) | Dateiname mit markiertem Suchbegriff, OCR-Hinweis, Aktenzeichen |

Unter den Dokumenttreffern steht **Alle Ergebnisse anzeigen**. Das öffnet die ausführliche Dokumentensuche mit demselben Begriff.

Bei Akten und Dokumenten sehen Sie nur Treffer aus Akten, auf die Sie Zugriff haben ([Kapitel 15](15-benutzer-und-rollen.md)). Findet keiner der drei Bereiche etwas, erscheint *Keine Ergebnisse gefunden.*

## Die Dokumentensuche

Die Seite **Dokumentensuche** (Adresse `/suche`) ist die Volltextsuche über alle Dokumente. Sie hat keinen eigenen Eintrag in der Seitenleiste; Sie erreichen sie über **Alle Ergebnisse anzeigen** in der Schnellsuche oder direkt über die Adresse, z. B. `/suche?q=Fischer`.

### Was durchsucht wird

Die Volltextsuche läuft über den Suchdienst Meilisearch. Für jedes Dokument sind dort gespeichert und durchsuchbar:

- der Dateiname,
- der erkannte Text (OCR-Text, bei PDF und Bildern nach der Texterkennung),
- die Tags,
- Aktenzeichen und Kurzrubrum der Akte,
- der Ordner,
- der Name der Person, die das Dokument hochgeladen hat.

Ein Dokument kommt in den Suchindex, wenn es hochgeladen, neu angelegt oder aus einer Vorlage erzeugt wird, wenn es in OnlyOffice gespeichert wird, wenn sich Tags oder Angaben ändern und wenn die Texterkennung fertig ist. Der Inhalt eines frisch hochgeladenen Scans ist also erst nach der OCR auffindbar ([Kapitel 5](05-dokumente.md)). Die Suche verzeiht kleine Tippfehler.

E-Mails, Kalendereinträge, Notizen und Helena-Entwürfe sind nicht Teil dieser Suche.

### So suchen Sie

1. Begriff in das Feld **Dokumente durchsuchen...** eingeben. Die Treffer erscheinen beim Tippen.
2. Über der Liste steht, wie viele Treffer es gibt, z. B. „12 Ergebnisse in 8ms“.
3. Auf den Dateinamen klicken, um das Dokument in seiner Akte zu öffnen, oder auf das Aktenzeichen, um die Akte zu öffnen.
4. Bei mehr als 20 Treffern unten auf **Mehr laden** klicken.

Jede Trefferkarte zeigt den Dateinamen und einen Ausschnitt aus dem Text, in dem der Suchbegriff gelb markiert ist. Darunter stehen Aktenzeichen und Kurzrubrum, das Hochladedatum, wer hochgeladen hat, und rechts die Relevanz in Prozent (z. B. „87% Relevanz“). Kleine Etiketten zeigen den OCR-Stand (**OCR ausstehend**, **OCR laeuft**, **OCR fertig**, **OCR fehlgeschlagen**), den Dokumentstatus und die Tags. Hat ein Dokument keinen erkannten Text, steht dort *Kein Textinhalt*.

Suchbegriff und Filter stehen in der Adresszeile. Sie können eine Suche deshalb als Lesezeichen speichern oder den Link an Kolleginnen und Kollegen schicken.

### Filter

Das Symbol mit den Schiebereglern rechts im Suchfeld (**Filter ein-/ausblenden**) klappt die Filterleiste auf. Ist ein Filter aktiv, ist das Symbol farbig hinterlegt.

| Filter | Auswahl |
| --- | --- |
| **Akte** | **Alle Akten** oder eine bestimmte Akte (die Liste zeigt höchstens 100 Akten) |
| **Dokumenttyp** | **Alle Typen**, **PDF**, **Word (DOCX)**, **Bilder**, **Text** |
| **OCR Status** | **Alle**, **Abgeschlossen**, **Ausstehend**, **In Bearbeitung**, **Fehlgeschlagen**, **Nicht noetig** |
| **Dokumentstatus** | **Alle**, **Entwurf**, **Zur Pruefung**, **Freigegeben**, **Versendet** |
| **Von** / **Bis** | Zeitraum, in dem das Dokument angelegt wurde |
| **Hochgeladen von** | **Alle Benutzer** oder eine Person |
| **Tags** | Über **Tag hinzufuegen...** einen oder mehrere Tags wählen. Ein Klick auf das kleine x am Tag entfernt ihn. Gefunden werden Dokumente mit mindestens einem der gewählten Tags. |

**Filter zuruecksetzen** löscht alle Filter, der Suchbegriff bleibt stehen.

Das Feld **Bis** schließt den gewählten Tag ein: Dokumente, die an diesem Tag angelegt wurden, werden mitgefunden.

### Wer was findet

Die Dokumentensuche steht allen Kanzleirollen offen (nicht dem Mandantenportal). Sie zeigt nur Dokumente aus Akten, auf die Sie Zugriff haben, nach denselben Regeln wie die Aktenliste ([Kapitel 15](15-benutzer-und-rollen.md)). Der **Administrator** findet Dokumente aus allen Akten. Wählen Sie im Filter **Akte** eine Akte, für die Sie nicht freigeschaltet sind, bleibt die Trefferliste leer.

### Wenn etwas nicht klappt

| Meldung / Verhalten | Bedeutung | Was tun? |
| --- | --- | --- |
| *Keine Dokumente gefunden* | Kein Treffer für Begriff und Filter. | Andere Begriffe versuchen, Filter lockern. |
| *Keine Dokumente gefunden*, obwohl das Dokument existiert | Der Suchdienst ist nicht erreichbar (die Seite meldet das nicht eigens), oder die Texterkennung ist noch nicht fertig. | Im Dokument den OCR-Stand prüfen. Bleibt die Suche ganz leer, die IT bitten, Meilisearch zu prüfen und den Index neu aufzubauen ([Kapitel 21](21-betrieb-und-sicherung.md)). |
| Ein Dokument fehlt, obwohl es im Index sein müsste | Es liegt in einer Akte, auf die Sie keinen Zugriff haben. | Bei der zuständigen Anwältin bzw. dem zuständigen Anwalt oder dem Administrator nachfragen ([Kapitel 15](15-benutzer-und-rollen.md)). |
| Dokument aus einer bestimmten Akte fehlt in der Auswahl **Akte** | Die Auswahl lädt nur 100 Akten. | Aktenzeichen als Suchbegriff eingeben, es ist ebenfalls durchsuchbar. |

## Das BI-Dashboard

Das **BI-Dashboard** (Seitenleiste **BI-Dashboard**, Adresse `/bi`) zeigt *Kanzlei-Analytics im Ueberblick*: Kennzahlen zu Akten, Finanzen, Fristen und Helena, jeweils mit Vergleich zur Vorperiode, dazu drei Verlaufsdiagramme.

### Wer was sieht

Das BI-Dashboard steht allen Kanzleirollen offen; Mandantenkonten haben keinen Zugriff. Die Zahlen hängen von der Rolle ab:

- **Administrator** sieht die Zahlen der ganzen Kanzlei.
- Alle anderen sehen nur Akten, auf die sie Zugriff haben (als Anwalt oder Sachbearbeiter eingetragen oder über ein Dezernat freigeschaltet, siehe [Kapitel 15](15-benutzer-und-rollen.md)), sowie Rechnungen, Fristen und Helena-Aufgaben dieser Akten.

**Token-Verbrauch** zählt beim Administrator kanzleiweit, bei allen anderen nur den eigenen Verbrauch.

### Filter

| Filter | Wirkung |
| --- | --- |
| **Zeitraum** | **Monat**, **Quartal**, **Jahr** (jeweils das laufende) oder **Benutzerdefiniert** mit den Feldern **Von** und **Bis**. Verglichen wird mit dem gleich langen Zeitraum davor. |
| **Anwalt** | **Alle Anwaelte** oder eine bestimmte Person mit der Rolle Anwalt. Gezählt werden dann nur Akten, bei denen diese Person als Anwalt eingetragen ist. |
| **Sachgebiet** | **Alle Sachgebiete** oder z. B. **Arbeitsrecht**, **Familienrecht**, **Verkehrsrecht**, **Mietrecht**, **Strafrecht**, **Erbrecht**, **Sozialrecht**, **Inkasso**, **Handelsrecht**, **Verwaltungsrecht**, **Sonstiges** |

**Anwalt** und **Sachgebiet** wirken auf alle Kennzahlen und auf die Diagramme. Beim **Token-Verbrauch** zählen dann nur Token, die einer passenden Akte zugeordnet sind.

### Die Kennzahlen

Jede Kachel zeigt den Wert und darunter die Veränderung zur Vorperiode in Prozent (grün bei Anstieg, rot bei Rückgang).

| Bereich | Kachel | Was gezählt wird |
| --- | --- | --- |
| **Akten** | **Offene Akten** | Akten mit Status Offen (heute, unabhängig vom Zeitraum) |
| | **Neuzugang** | Im Zeitraum angelegte Akten |
| **Finanzen** | **Umsatz** | Summe brutto aller Rechnungen mit Rechnungsdatum im Zeitraum, ohne stornierte |
| | **Offene Rechnungen** | Rechnungen, die weder bezahlt noch storniert sind |
| **Fristen** | **Fristen-Compliance** | Anteil der Fristen im Zeitraum, die spätestens am Fristtag erledigt wurden |
| | **Ueberfaellige Fristen** | Nicht erledigte Fristen mit Datum in der Vergangenheit |
| **Helena** | **Helena-Gespraeche** | Helena-Aufgaben im Zeitraum |
| | **Helena-Entwuerfe** | Von Helena erstellte Entwürfe im Zeitraum |
| | **Akzeptanzrate** | Anteil angenommener an allen angenommenen oder abgelehnten Entwürfen |
| | **Token-Verbrauch** | Verbrauchte KI-Token (Ein- und Ausgabe) im Zeitraum |

Die Kennzahlen sind eine Übersicht, keine Buchhaltung und keine Fristenkontrolle. Für verbindliche Zahlen gelten die Finanzen ([Kapitel 10](10-zeiterfassung-und-abrechnung.md)) und der Fristenkalender ([Kapitel 6](06-fristen-und-kalender.md)). Die Werte werden für fünf Minuten zwischengespeichert; eine gerade gestellte Rechnung kann also kurz später erscheinen.

### Die Diagramme

Unter den Kacheln stehen drei Verläufe über die letzten zwölf Monate:

- **Akten-Neuzugang** (neue Akten je Monat),
- **Umsatz pro Monat** (Summe brutto, ohne stornierte Rechnungen),
- **Fristen-Compliance** (Anteil erledigter Fristen je Monat).

Die Diagramme zeigen immer die letzten zwölf Monate, unabhängig vom gewählten Zeitraum.

### Bericht herunterladen

Oben rechts stehen zwei Knöpfe:

- **PDF-Report** lädt `bi-report-<Datum>.pdf` mit den Abschnitten **Kennzahlen** (KPI, Wert, Vorperiode, Veränderung) und **Trends**.
- **Excel-Report** lädt `bi-report-<Datum>.xlsx` mit dem Blatt **Kennzahlen** und je einem Blatt **Akten-Neuzugang**, **Umsatz** und **Fristen-Compliance**.

Beide berücksichtigen die gesetzten Filter.

### Wenn etwas nicht klappt

| Meldung | Bedeutung | Was tun? |
| --- | --- | --- |
| *KPI-Fehler: KPI-Abfrage fehlgeschlagen (400)* | Ein Filterwert ist ungültig, meist ein unvollständiger benutzerdefinierter Zeitraum. | **Von** und **Bis** prüfen oder einen anderen **Zeitraum** wählen. |
| *KPI-Fehler: KPI-Abfrage fehlgeschlagen (500)* | Die Kennzahlen konnten nicht berechnet werden. | Seite neu laden; bleibt es, die IT informieren (Server-Protokoll). |
| *Trend-Fehler: …* | Die Verläufe konnten nicht geladen werden. | Seite neu laden; bleibt es, die IT informieren. |
| *Fehler beim Erstellen des PDF-Reports* / *Fehler beim Erstellen des Excel-Reports* | Der Bericht konnte nicht erzeugt werden. | Filter prüfen, Seite neu laden; bleibt es, die IT informieren. |

## Exporte im Überblick

An diesen Stellen können Sie Daten herunterladen:

| Wo | Knopf | Format | Inhalt | Wer |
| --- | --- | --- | --- | --- |
| **BI-Dashboard** | **PDF-Report**, **Excel-Report** | PDF, XLSX | Kennzahlen und Verläufe | alle Kanzleirollen |
| **Dashboard**, Kachel Tagesübersicht | **Fristenzettel** | PDF | Fristen des heutigen Tages | alle Kanzleirollen |
| Fristenrechner | **Fristenzettel drucken** | PDF | Fristen des heutigen Tages | alle Kanzleirollen |
| **Administration → Audit-Trail** | **Exportieren**, dann **CSV** oder **PDF**, Zeitraum **Von**/**Bis** | CSV, PDF | Protokolleinträge | nur Administrator |
| **Administration → Team-Dashboard** | **Export** *Monat*, dann **PDF herunterladen** oder **CSV herunterladen** | PDF, CSV | Team-Bericht des Vormonats | nur Administrator |
| **Administration → DSGVO** | Bereich **Auskunftsrecht (Art. 15 DSGVO)** | PDF | Datenauskunft zu einem Kontakt | nur Administrator |
| **Einstellungen** | Export der Kanzlei-Einstellungen | JSON | Einstellungen zur Sicherung, siehe [Kapitel 16](16-einstellungen-und-vorlagen.md) | nur Administrator |

Fristenzettel beschreibt [Kapitel 6](06-fristen-und-kalender.md), Audit-Trail und DSGVO-Auskunft [Kapitel 18](18-datenschutz-und-audit.md).

**Was es (noch) nicht als Knopf gibt:** Für die Aktenliste, die Kontaktliste sowie Rechnungen, Buchungen und Zeiteinträge sind CSV- und Excel-Exporte technisch vorhanden, ebenso DATEV- und SEPA-Exporte ([Kapitel 10](10-zeiterfassung-und-abrechnung.md)). In der Oberfläche ist dafür derzeit kein Export-Knopf eingebunden. Bis dahin kann die IT die Exporte direkt abrufen ([Kapitel 22](22-architektur-und-entwicklung.md)).

---

Weiter: [14 — Gamification](14-gamification.md) · [Zur Übersicht](README.md)
