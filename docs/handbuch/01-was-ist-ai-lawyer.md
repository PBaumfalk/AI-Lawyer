# 1 — Was ist AI-Lawyer?

Dieses Kapitel erklärt, wofür AI-Lawyer gedacht ist, und führt die Begriffe ein, die im ganzen Handbuch vorkommen. Wer schon mit einer Kanzleisoftware gearbeitet hat, kann es überfliegen und bei [Kapitel 2](02-erste-schritte.md) weitermachen.

## Wofür AI-Lawyer gedacht ist

AI-Lawyer ist eine Kanzleisoftware, die vollständig im Browser läuft. Akten, Kontakte, Dokumente, Fristen und Termine, E-Mail, beA, Zeiterfassung und Abrechnung, Team-Nachrichten und ein Mandantenportal liegen in einer Anwendung. Eine Installation auf den Arbeitsplätzen ist nicht nötig, auch kein externes Office-Programm: Dokumente werden im Browser mit OnlyOffice bearbeitet.

Mitten in der Anwendung arbeitet **Helena**, eine KI-Assistentin. Sie fasst Akten zusammen, erkennt Fristen in eingehenden Schreiben, recherchiert in Gesetzen und Urteilen und legt Entwürfe vor. Freigeben, unterschreiben und versenden tut immer ein Mensch.

AI-Lawyer ist ein aktives Entwicklungsprojekt (Version 0.9) und noch nicht für den Produktivbetrieb freigegeben. Was bekannt offen ist, steht in [Kapitel 23](23-einschraenkungen-und-fragen.md).

## Grundbegriffe

### Akte und Aktenzeichen

Die **Akte** ist die zentrale Einheit: Zu ihr gehören Beteiligte, Dokumente, Fristen und Termine, E-Mails, Zeiten, Rechnungen und der Aktivitätsverlauf. Jede Akte hat ein **Kurzrubrum** (z. B. „Müller ./. Schmidt GmbH“), optional ein **Wegen** (worum es geht) und einen **Gegenstandswert**.

Das **Aktenzeichen** vergibt AI-Lawyer beim Anlegen automatisch nach dem Schema `NNNNN/JJ`, also fünfstellige laufende Nummer, Schrägstrich, zweistellige Jahreszahl, z. B. `00013/26`. Die Nummerierung beginnt jedes Jahr wieder bei `00001`. Ein eigenes Schema lässt sich derzeit nicht einstellen.

Eine Akte hat einen von vier Status: **Offen**, **Ruhend**, **Archiviert** oder **Geschlossen** ([Kapitel 3](03-akten.md#status-ändern-und-archivieren)).

### Beteiligte und Rollen

**Beteiligte** sind Kontakte, die mit einer bestimmten Rolle an einer Akte hängen. Ein Kontakt kann an vielen Akten beteiligt sein, jeweils mit eigener Rolle:

| Rolle | Bedeutung |
| --- | --- |
| **Mandant** | Die Partei, die die Kanzlei vertritt. Nur Mandanten können ins Mandantenportal eingeladen werden. |
| **Gegner** | Die Gegenpartei. |
| **Gegnervertreter** | Anwältin oder Anwalt der Gegenseite. |
| **Gericht** | Das zuständige Gericht. |
| **Zeuge** | Zeugin oder Zeuge. |
| **Sachverständiger** | Gutachterin oder Gutachter. |
| **Sonstiger** | Alle anderen. |

Die Rollen sind auch für die **Kollisionsprüfung** wichtig: AI-Lawyer erkennt, wenn ein Kontakt in einer laufenden Akte Mandant und in einer anderen Gegner oder Gegnervertreter ist ([Kapitel 3](03-akten.md#beteiligte)).

### Kontakt

Ein **Kontakt** ist eine natürliche Person (Mensch) oder eine juristische Person (Firma, Verein, Behörde). Kontakte werden einmal angelegt und in beliebig vielen Akten verwendet ([Kapitel 4](04-kontakte.md)).

### Sachgebiet

Jede Akte gehört zu einem **Sachgebiet**: Arbeitsrecht, Familienrecht, Verkehrsrecht, Mietrecht, Strafrecht, Erbrecht, Sozialrecht, Inkasso, Handelsrecht, Verwaltungsrecht oder Sonstiges. Das Sachgebiet bestimmt unter anderem, welche **Falldatenblätter** (strukturierte Erfassungsbögen, z. B. für eine Kündigungsschutzsache) Helena beim Anlegen vorschlägt.

### Dezernat

Ein **Dezernat** ist ein Team, z. B. „Familienrecht-Team“. Es hat Mitglieder (Benutzer) und zugeordnete Akten. Wer Mitglied eines Dezernats ist, hat Zugriff auf dessen Akten, auch wenn er nicht persönlich als Anwalt oder Sachbearbeiter eingetragen ist. Dezernate pflegt die Administration ([Kapitel 15](15-benutzer-und-rollen.md)).

### Frist, Termin, Wiedervorlage

Der Kalender kennt drei Arten von Einträgen, die jeweils an einer Akte hängen können:

| Art | Bedeutung |
| --- | --- |
| **Frist** | Ein Datum, bis zu dem etwas erledigt sein muss, z. B. eine Berufungsbegründungsfrist. Fristen können Vorfristen haben und als Notfrist markiert werden. Wer eine Frist erledigt, muss einen Erledigungsgrund angeben. |
| **Termin** | Ein Ereignis mit Uhrzeit, z. B. eine mündliche Verhandlung oder eine Besprechung. |
| **Wiedervorlage** | Eine Erinnerung, die Akte zu einem bestimmten Tag wieder anzusehen. |

Daneben gibt es **Fokuszeit** als Kalenderblock für konzentriertes Arbeiten. Einzelheiten zu Fristenrechner, Vorfristen und Fristenzettel stehen in [Kapitel 6](06-fristen-und-kalender.md).

> **Hinweis:** Fristberechnungen von AI-Lawyer und von Helena sind Vorschläge. Prüfen Sie jede Frist selbst, bevor Sie sich auf sie verlassen.

### Helena

**Helena** ist die KI-Assistentin von AI-Lawyer. Sie erscheint an mehreren Stellen:

- in der Seitenleiste unter **Helena** (Chat mit Bezug zu einer Akte) und **KI-Chat** (aktenübergreifende Recherche),
- im Aktivitätsverlauf einer Akte, wenn Sie in einer Notiz **@Helena** erwähnen,
- als Knopf **Fallzusammenfassung** und im Reiter **KI-Analyse** einer Akte,
- im Hintergrund, wenn sie in neuen Schreiben Fristen erkennt oder Warnungen erzeugt.

Helena kann lokal auf dem eigenen Server laufen (Ollama) oder, wenn die Kanzlei das so einrichtet, über OpenAI oder Anthropic ([Kapitel 9](09-helena.md)).

### Mandantenportal

Das **Mandantenportal** ist ein eigener, abgetrennter Bereich, in dem Mandantinnen und Mandanten ihre Akten sehen. Sie sehen dort nur Akten, an denen sie als Mandant beteiligt sind, nur Dokumente, die ausdrücklich für sie freigegeben wurden, und den Text **Naechste Schritte (fuer Mandant)**, den die Kanzlei in der Akte pflegt. Über das Portal können sie der Kanzlei Nachrichten schicken. Mandanten melden sich auf einer eigenen Anmeldeseite an ([Kapitel 12](12-mandantenportal.md)).

## Rollen

Jeder Benutzer hat genau eine Rolle. Die Rechte sind im Programm fest hinterlegt und lassen sich nicht frei konfigurieren:

| Recht | Admin | Anwalt | Sachbearbeiter | Sekretariat | Mandant |
| --- | :---: | :---: | :---: | :---: | :---: |
| Akte anlegen und bearbeiten | ja | ja | ja | ja | nein |
| Dokumente freigeben | ja | ja | ja | nein | nein |
| Löschen | ja | ja | ja | nein | nein |
| beA lesen | ja | ja | ja | ja | nein |
| beA senden | ja | ja | nein | nein | nein |
| KI nutzen | ja | ja | ja | ja | nein |
| Einstellungen | ja | ja | ja | nein | nein |
| Administration | ja | nein | nein | nein | nein |

Die Rollen heißen in der Oberfläche **Administrator**, **Anwalt/Anwaeltin**, **Sachbearbeiter/in**, **Sekretariat** und **Mandant**. Einige Funktionen sind zusätzlich an Rollen gebunden, etwa die Portal-Einladung (nur Anwalt und Admin). Darauf weisen die jeweiligen Kapitel hin.

**Zugriff auf Akten:** Admins sehen alle Akten. Alle anderen Rollen sehen und bearbeiten nur Akten, bei denen sie als Anwalt oder Sachbearbeiter eingetragen sind oder die einem ihrer Dezernate zugeordnet sind. Will ein Admin bewusst in eine fremde Akte eingreifen, kann er das mit **Zugriff uebernehmen** begründet und protokolliert tun ([Kapitel 3](03-akten.md#zugriff-dezernate-und-admin-override)).

Diese Regel gilt überall: in der Aktenliste, auf der Akten-Detailseite, in Auswahllisten, in der Suche, bei Dokumenten, Fristen, Rechnungen und den übrigen Funktionen mit Aktenbezug. Konten mit der Rolle **Mandant** kommen ausschließlich ins Mandantenportal ([Kapitel 12](12-mandantenportal.md)); die Kanzleioberfläche ist für sie gesperrt.

## Das Prinzip: KI schlägt vor, Mensch entscheidet

AI-Lawyer ist so gebaut, dass Helena nichts mit Außenwirkung allein erledigt:

- **Entwürfe:** Alles, was Helena schreibt, landet als Entwurf in der Akte und in der Liste **Entwuerfe**. Sie entscheiden mit **Annehmen**, **Bearbeiten** oder **Ablehnen**.
- **Dokumente:** Ein von der KI erzeugtes Dokument steht immer auf **Entwurf**. Die Datenbank verhindert, dass es ohne eine freigebende Person auf einen anderen Status wechselt.
- **Versand:** Per beA oder E-Mail verschickt werden nur Dokumente mit dem Status **Freigegeben**. Diese Freigabe kann nur ein Mensch erteilen.
- **Vorschläge:** Wenn Helena Beteiligte, Fristen oder Falldaten erkennt, erscheinen sie als Vorschläge, die Sie übernehmen oder verwerfen.

Sprachmodelle können Normen, Entscheidungen und Fristen falsch wiedergeben. Prüfen Sie jeden KI-Entwurf, jedes Rechercheergebnis und jede Gebührenberechnung, bevor Sie sie verwenden.

## Datenhaltung: selbst gehostet

AI-Lawyer läuft auf einem Server der Kanzlei (oder eines Dienstleisters ihres Vertrauens):

- Datenbank, Dateien, Suchindex und Hintergrunddienste laufen in eigenen Docker-Containern auf diesem Server.
- Die KI kann ebenfalls dort laufen (Ollama). Dann verlassen Akteninhalte das Haus nicht.
- Wird stattdessen OpenAI oder Anthropic eingestellt, gehen die Texte, die Helena verarbeitet, an diesen Anbieter. Ob das mit dem Mandatsgeheimnis vereinbar ist, entscheidet die Kanzlei.
- Zugangsdaten für E-Mail-Postfächer und beA werden verschlüsselt gespeichert.
- Wer was an einer Akte geändert hat, hält ein Audit-Trail fest ([Kapitel 18](18-datenschutz-und-audit.md)).

Wie die IT AI-Lawyer installiert und sichert, beschreiben die Kapitel [19](19-installation.md) bis [22](22-architektur-und-entwicklung.md).

---

Weiter: [2 — Erste Schritte](02-erste-schritte.md) · [Zur Übersicht](README.md)
