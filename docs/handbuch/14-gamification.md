# 14 — Gamification

AI-Lawyer kann die tägliche Büroarbeit mit kleinen Spielelementen begleiten: Aufgaben des Tages (Quests), Erfahrungspunkte und Level, eine Spielwährung namens Runen, Serien über mehrere Arbeitstage und einen gemeinsamen „Bossfight“ gegen den Stapel offener Wiedervorlagen. Mitmachen ist freiwillig. Dieses Kapitel erklärt, wie es funktioniert, was gezählt wird und was nicht.

Wichtig vorab: Gezählt wird ausschließlich echte Arbeit in AI-Lawyer. Eine Quest gilt erst als erfüllt, wenn die Fristen, Wiedervorlagen, Tickets, Rechnungen oder Akten tatsächlich in der Datenbank stehen. Es gibt nichts abzuhaken.

## Ein- und ausschalten

Gamification ist für jede Person zunächst ausgeschaltet.

1. Öffnen Sie **Einstellungen**, Reiter **Allgemein**.
2. Schalten Sie **Gamification** ein („Quest-Widget und XP-Fortschritt auf dem Dashboard anzeigen“). Es erscheint *„Gamification aktiviert“*.

Ab jetzt sehen Sie auf dem **Dashboard** das Quest-Widget, und die Seiten **Heldenkarte** und **Shop** zeigen Ihre Daten. Ausschalten geht genauso (*„Gamification deaktiviert“*). Danach werden keine Quests mehr gewertet und Widget, Heldenkarte und Shop bleiben leer. Ihre bisherigen Punkte, Runen und Gegenstände bleiben gespeichert und sind beim erneuten Einschalten wieder da.

Die Menüpunkte **Shop** und **Heldenkarte** stehen in der Seitenleiste für alle, auch ohne Einschalten; die Seiten bleiben dann einfach leer.

## Spielklassen

Ihre Klasse ergibt sich aus Ihrer Rolle und bestimmt, welche Quests Sie zusätzlich zu den allgemeinen bekommen:

| Rolle | Klasse | Schwerpunkt der Klassen-Quests |
| --- | --- | --- |
| Anwalt | **Jurist** | Fristen erledigen, Wiedervorlagen mit Vermerk, Akten pflegen |
| Sachbearbeiter | **Schreiber** | Rechnungen erstellen, Akten pflegen, Wiedervorlagen |
| Sekretariat | **Waechter** | Tickets beantworten, Kalendereinträge erledigen, Akten pflegen |
| Administrator | **Quartiermeister** | Akten pflegen, Wiedervorlagen, Rechnungen |

## Quests

Das Quest-Widget auf dem Dashboard zeigt drei Gruppen: **Tagesquests**, **Wochenquests** und **Special**. Jede Quest zeigt Ihren Stand (z. B. 2/3) und die Belohnung. Ein Klick auf eine Quest führt zur passenden Liste, etwa zu den heutigen Fristen im Kalender.

Beispiele aus dem Grundbestand:

| Quest | Aufgabe | Für | Belohnung |
| --- | --- | --- | --- |
| Die Chroniken entwirren | Erledige 3 Wiedervorlagen | alle | 60 XP, 12 Runen |
| Ordnung im Skriptorium | Aktualisiere 3 Akten | alle | 40 XP, 5 Runen |
| Die Siegel des Tages | Erledige 3 Fristen | Jurist | 80 XP, 8 Runen |
| Praegung der Muenzen | Erstelle 2 Rechnungen | Schreiber | 60 XP, 10 Runen |
| Bote der Klarheit | Beantworte 2 Tickets | Waechter | 30 XP, 4 Runen |
| Backlog-Bezwinger (Woche) | Reduziere offene Tickets um 20 % | alle | 200 XP, 25 Runen |
| Fristenwaechter (Woche) | Reduziere offene Fristen um 15 % | Jurist | 250 XP, 30 Runen |
| Wochenabrechnung (Woche) | Erstelle 5 Rechnungen diese Woche | Schreiber | 200 XP, 25 Runen |

**Wann wird gewertet?** Sobald Sie eine Frist oder Wiedervorlage erledigen, ein Ticket bearbeiten oder eine Rechnung anlegen, prüft AI-Lawyer im Hintergrund Ihre Quests. Zusätzlich läuft jede Nacht um 23:55 Uhr eine Nachprüfung. Tagesquests zählen pro Kalendertag, Wochenquests ab Montag, Wochenziele mit Prozentangabe vergleichen mit dem Stand vom Montag 0 Uhr. Jede Quest gibt es pro Tag bzw. Woche nur einmal.

**Special Quests** sind zeitlich begrenzte Kampagnen, die die Administration anlegt (siehe [Für Administratoren](#für-administratoren)). Sie zeigen die verbleibenden Tage bzw. **Letzter Tag**.

## XP und Level

Jede erfüllte Quest bringt Erfahrungspunkte (XP). Das Level steigt in Stufen:

| Level | XP je Level |
| --- | --- |
| 1 bis 10 | 300 |
| 11 bis 20 | 500 |
| ab 21 | 800 |

Das höchste Level ist 50. Zum Level gehört ein Titel: **Junior Workflow** (bis Level 10), **Workflow Stabil** (bis 20), **Backlog Controller** (bis 30), **Billing Driver** (bis 40), **Kanzlei-Operator** (darüber).

## Runen

Runen sind die Währung für den [Shop](#der-shop). Sie bekommen sie für Quests und im Bossfight.

- **Serienbonus**: Ab 3 Tagen Serie gibt es 10 % mehr Runen für Quests, ab 7 Tagen 25 % mehr.
- **Tageslimit**: Für Wiedervorlagen-Quests gibt es höchstens 40 Runen am Tag (einstellbar). Ab 80 % zeigt das Widget den Stand; ist das Limit erreicht, steht dort „Runen-Limit erreicht — XP wird weiterhin vergeben“.
- **Folge-Wiedervorlage**: Legen Sie am selben Tag eine neue Wiedervorlage an, nachdem Sie eine erledigt haben, gibt es 5 Bonus-Runen.

## Streaks

Ihre Serie (Streak) zählt die aufeinanderfolgenden Arbeitstage, an denen Sie mindestens eine Quest erfüllt haben. Wochenenden, gesetzliche Feiertage des eingestellten Bundeslands und Ihre eingetragenen Urlaubstage ([Kapitel 15](15-benutzer-und-rollen.md)) werden übersprungen; sie unterbrechen die Serie nicht. Fehlt ein Arbeitstag ohne Quest, beginnt die Serie neu, es sei denn, Sie haben einen **Streak-Schutz** aus dem Shop aktiviert. Dann erscheint *„Streak-Schutz hat deinen Streak gerettet!“*.

Urlaub tragen Sie nicht selbst ein; das macht die Administration unter **Einstellungen → Vertretung & Urlaub**.

## Was als erledigt zählt (Schutz vor Missbrauch)

Damit niemand Punkte „erklickt“, gelten einige Regeln:

- **Echte Daten**: Gezählt wird nur, was in AI-Lawyer tatsächlich passiert ist, mit dem Zeitpunkt der Erledigung.
- **Wiedervorlagen mit Vermerk**: Eine erledigte Wiedervorlage zählt für Quests nur, wenn beim Erledigen ein Erledigungsgrund mit mindestens 30 Zeichen angegeben wurde ([Kapitel 6](06-fristen-und-kalender.md)).
- **Tageslimit** für Runen aus Wiedervorlagen (siehe oben).
- **Stichproben**: Rund 2 % aller erfüllten Quests werden zufällig zur Prüfung gestellt. Es erscheint **Stichproben-Pruefung** – „Erledigung "…" bestaetigen?“ mit **Bestaetigen** und **Zuruecknehmen**. Bis zur Entscheidung sind XP und Runen vorgemerkt. **Bestaetigen** schreibt sie gut, **Zuruecknehmen** verwirft sie. Ohne Reaktion gilt die Erledigung nach 24 Stunden als bestätigt.

## Bossfight

Der Bossfight ist ein Teamziel gegen den Rückstau an Wiedervorlagen.

**Wann erscheint ein Boss?** Wenn in der Kanzlei mindestens 30 Wiedervorlagen offen sind (einstellbar). Vorher zeigt das Dashboard „Noch … Wiedervorlagen bis zum naechsten Boss“. Der Boss hat einen Namen wie „Der Aktenberg“, „Fristenfresser“ oder „Backlog-Krake“ und so viele Lebenspunkte, wie beim Erscheinen Wiedervorlagen offen waren.

**Wie kämpft man?**

- Jede erledigte Wiedervorlage zieht dem Boss einen Lebenspunkt ab und bringt Ihnen Runen.
- Jede neu angelegte Wiedervorlage heilt ihn um einen Punkt (höchstens bis zum Startwert).
- Der Kampf hat vier Phasen (bei 75 %, 50 % und 25 % Restleben). Je weiter fortgeschritten, desto mehr Runen pro Treffer (5 Runen in Phase 1, bis 15 in Phase 4). Beim Phasenwechsel bekommen alle Beteiligten 20, 40 bzw. 80 Bonus-Runen.

**Sieg.** Fällt der Boss auf null, erscheint **Boss besiegt!** mit dem Namen der Person mit den meisten Treffern. Alle, die mitgekämpft haben, bekommen 500 XP, 100 Runen und eine Trophäe. Danach erscheint frühestens nach 24 Stunden ein neuer Boss (einstellbar).

Das Banner auf dem Dashboard zeigt Lebensbalken, Phase, **Top Angreifer** und **Letzte Treffer**. Es ist für alle in der Kanzlei sichtbar, auch für Personen, die Gamification nicht eingeschaltet haben. In **Top Angreifer** und beim Sieg erscheinen die **Namen** der Beteiligten. Wer das nicht möchte, sollte Gamification ausgeschaltet lassen.

## Die Heldenkarte

Die Seite **Heldenkarte** zeigt nur Ihre eigenen Daten; niemand sonst kann sie aufrufen.

- Oben die Karte mit Klasse, Level und Titel, XP-Fortschritt, Runen, Serie („… Tage Streak“) und **Ausgeruestet**en Gegenständen.
- **Abzeichen**: dauerhafte Auszeichnungen, z. B. **Fristenwaechter** (50 Fristen fristgerecht erledigt), **Aktenkoenig** (100 Akten-Aktivitäten), **Dauerbrenner** (7 Tage Serie), **Streak-Meister** (30 Tage Serie), **Bannbrecher** (einen Boss besiegt), **Teamkaempfer** (an 3 Bossfights teilgenommen), **Quester** (100 Quests), **Runensammler** (500 Runen verdient). Noch nicht erreichte Abzeichen sind gesperrt dargestellt.
- **Quest-Historie**: alle erfüllten Quests mit Art (**Taeglich**, **Woechentlich**, **Spezial**), Datum und Belohnung; blättern mit **Zurueck** und **Weiter**.

## Der Shop

Im **Runen-Shop** (Menüpunkt **Shop**) tauschen Sie Runen gegen Gegenstände. Oben steht Ihr Guthaben.

1. Wählen Sie im Reiter **Shop** eine Kategorie: **Alle**, **Kosmetik** oder **Perks**.
2. Klicken Sie bei einem Gegenstand auf **Kaufen**. Die Rückfrage zeigt Preis, Guthaben und Guthaben nach dem Kauf.
3. Mit **Bestaetigen** kaufen Sie (*„Gegenstand erworben!“*).

| Seltenheit | Preis | Beispiele |
| --- | --- | --- |
| Gewoehnlich | 20 Runen | Silber-Rahmen, Pergament-Banner, Titel „Referendar“, Funkenregen, Fokus-Siegel |
| Selten | 50 Runen | Azur-Rahmen, Aktenwald-Banner, Titel „Assessor“, Konfetti-Salut, Streak-Schutz |
| Episch | 120 Runen | Amethyst-Rahmen, Justizpalast-Banner, Titel „Syndikus“, Feuerwerk, Doppel-Runen |
| Legendaer | 300 Runen | Goldener Rahmen, Paragraphen-Sanctum, Titel „Kanzleipartner“ (erst ab Level 25) |

**Kosmetik** (Avatar-Rahmen, Banner, Profil-Titel, Abschluss-Animation) kaufen Sie einmal und legen sie im Reiter **Inventar** mit **Ausruesten** an oder mit **Ablegen** ab.

**Perks** sind zum einmaligen Verbrauch und werden im **Inventar** mit **Aktivieren** eingesetzt:

| Perk | Wirkung |
| --- | --- |
| Fokus-Siegel | Legt im Kalender einen 30-minütigen Fokuszeit-Eintrag „Fokus-Siegel aktiv“ an. |
| Streak-Schutz | Rettet Ihre Serie beim nächsten verpassten Arbeitstag. |
| Doppel-Runen | Zwei Stunden lang doppelte Runen für alle Quests (das Tageslimit wird vor dem Verdoppeln angewandt). |

## Team-Dashboard

Administratoren sehen unter **Administration → Team-Dashboard** zusammengefasste Werte für die ganze Kanzlei: **Quest-Erfuellungsquote** des Tages, **Offene Wiedervorlagen** mit Trend (**Steigend**, **Fallend**, **Stabil**) und **Bossfight-Teamschaden**, dazu einen Export für den Vormonat. Werte einzelner Personen zeigt das Team-Dashboard nicht. Einzelheiten in [Kapitel 15](15-benutzer-und-rollen.md#team-dashboard).

## Für Administratoren

Unter **Einstellungen**, Reiter **Gamification** (nur Administratoren):

- **Bossfight-Konfiguration**: **Schwellenwert (offene WV)**, ab dem ein Boss erscheint, und **Abklingzeit nach Sieg (Stunden)**.
- **Special Quests**: Mit **Neue Special Quest** legen Sie eine Kampagne an: **Name**, **Beschreibung**, **Vorlage** (**Fristen erledigen**, **Tickets bearbeiten**, **Rechnungen erstellen**, **Akten aktualisieren**), **Zielanzahl**, **Startdatum**, **Enddatum**, **XP-Belohnung**, **Runen-Belohnung** und **Zielklasse**. Die Liste zeigt **Aktiv** oder **Abgelaufen**. Beim Löschen einer Special Quest werden auch die zugehörigen Erledigungen gelöscht.

Das Tageslimit für Runen aus Wiedervorlagen (**Taegliches Runen-Limit (Wiedervorlage-Quests)**, Standard 40, erlaubt 10 bis 200) steht unter **Administration → Einstellungen** ([Kapitel 16](16-einstellungen-und-vorlagen.md#admin-einstellungen)).

## Datenschutz

- Gamification ist **Opt-in**: Ohne Ihr Einschalten wird für Sie nichts gewertet.
- Die **Heldenkarte** ist nur für Sie selbst sichtbar, auch nicht für Administratoren.
- Das **Team-Dashboard** zeigt nur zusammengefasste Werte.
- **Ausnahme Bossfight**: Im Banner erscheinen Namen derer, die Treffer gelandet haben, für alle in der Kanzlei.
- **Löschung**: Eine automatische Löschung der Spieldaten nach 12 Monaten ist im Code derzeit **nicht umgesetzt**. Quest-Erledigungen, Bossfight-Treffer und Profile bleiben gespeichert, bis das Benutzerkonto gelöscht wird; auch das Ausschalten löscht nichts. Wer eine Löschfrist braucht, muss sie derzeit organisatorisch regeln ([Kapitel 18](18-datenschutz-und-audit.md)).
- Gamification eignet sich nicht zur Leistungsbewertung einzelner Personen. Prüfen Sie vor der Einführung, ob der Betriebsrat zu beteiligen ist (§ 87 Abs. 1 Nr. 6 BetrVG).

## Wenn etwas nicht klappt

| Meldung | Bedeutung | Was tun? |
| --- | --- | --- |
| Heldenkarte oder Shop bleiben leer | Gamification ist für Sie nicht eingeschaltet. | **Einstellungen → Allgemein → Gamification** einschalten. |
| *Gamification-Einstellung konnte nicht gespeichert werden* | Speichern fehlgeschlagen. | Seite neu laden, erneut versuchen. |
| Erledigte Wiedervorlage zählt nicht | Erledigungsgrund kürzer als 30 Zeichen, oder Runen-Tageslimit erreicht (XP gibt es trotzdem). | Beim Erledigen einen aussagekräftigen Vermerk schreiben. |
| Quest-Fortschritt hängt | Die Wertung läuft im Hintergrund. | Kurz warten; spätestens die Nachtprüfung um 23:55 Uhr holt es nach. |
| *Nicht genuegend Runen* | Guthaben reicht nicht. | Weitere Quests erfüllen. |
| *Level 25 erforderlich (Dein Level: …)* | Legendäre Gegenstände sind ab Level 25 freigeschaltet. | Level steigern. |
| **Bereits erworben** | Kosmetik besitzen Sie schon. | Im **Inventar** ausrüsten. |
| *Perks koennen nicht ausgeruestet werden* | Perks werden aktiviert, nicht ausgerüstet. | **Aktivieren** verwenden. |
| *Bereits verbraucht* | Der Perk wurde schon eingesetzt. | Neuen kaufen. |
| Kein Boss trotz vieler Wiedervorlagen | Schwellenwert nicht erreicht, Abklingzeit nach dem letzten Sieg läuft, oder in der Kanzlei hat niemand Gamification eingeschaltet. | Administration fragen. |

---

Weiter: [15 — Benutzer und Rollen](15-benutzer-und-rollen.md) · [Zur Übersicht](README.md)
