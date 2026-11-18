# 17 — Migration aus j-lawyer

Wer bisher mit j-lawyer.org gearbeitet hat, kann Akten, Kontakte, Beteiligte, Dokumente und Kalendereinträge über die j-lawyer-Schnittstelle nach AI-Lawyer übernehmen. Dieses Kapitel beschreibt Voraussetzungen, Ablauf, was übernommen wird und was nicht, und worauf Sie nach der Übernahme achten müssen. Die Seite ist nur für Administratoren zugänglich.

![j-lawyer-Migration](../screenshots/admin-jlawyer.png)

## Vorab: Stand der Schnittstelle

Bitte lesen Sie diesen Abschnitt, bevor Sie Zeit in die Einrichtung stecken.

AI-Lawyer ruft j-lawyer unter Adressen der Form `<Server-URL>/j-lawyer/api/v2/…` auf, zum Beispiel `/j-lawyer/api/v2/cases/list`, `/j-lawyer/api/v2/cases/<id>/contacts` und `/j-lawyer/api/v2/cases/<id>/calendar`. Ein Abgleich mit dem Endpunktkatalog einer aktuellen j-lawyer-Installation (API-Stand 8) zeigt, dass j-lawyer diese Pfade so nicht anbietet. Dort heißen die entsprechenden Endpunkte etwa `/v1/cases/list`, `/v1/cases/{id}/parties` (Beteiligte), `/v1/cases/{id}/duedates` (Fristen und Wiedervorlagen) und `/v1/contacts/list`.

Rechnen Sie deshalb damit, dass **Verbindung testen** mit einer Meldung wie *J-Lawyer API error 404 at /j-lawyer/api/v2/cases/list?max=1* scheitert. Die Übernahme ist in diesem Fall erst nach einer Anpassung des Programms möglich. Die übrigen Abschnitte beschreiben, wie die Funktion im Code angelegt ist.

## Voraussetzungen

| Was | Warum |
| --- | --- |
| j-lawyer-Server mit eingeschalteter REST-Schnittstelle | AI-Lawyer liest alles über die Schnittstelle, nicht aus der Datenbank. |
| j-lawyer-Benutzer und Passwort | Anmeldung per HTTP-Basic. Der Benutzer muss alle Akten, Kontakte und Dokumente lesen dürfen. |
| Server-URL | Mit `https://`. Ohne abschließenden Pfad, AI-Lawyer hängt ihn selbst an. Beispiel im Feld: `https://jlawyer.example.com:8080`. |
| `JLAWYER_ALLOW_PRIVATE_URLS=true` | Nur wenn j-lawyer im eigenen Netz läuft (z. B. `192.168.…`, `10.…`, `localhost`) oder nur per `http://` erreichbar ist. Ohne diese Variable lehnt AI-Lawyer solche Adressen ab. Sie steht nicht in `.env.example` und muss von der IT ergänzt werden ([Kapitel 20](20-konfiguration.md)). |
| `EMAIL_ENCRYPTION_KEY` (mindestens 32 Zeichen) | Das j-lawyer-Passwort wird verschlüsselt gespeichert (AES-256-GCM). Ohne gültigen Schlüssel lässt es sich nicht speichern. |
| Systembenutzer „Helena“ | Übernommene Dokumente und Kalendereinträge werden diesem internen Benutzer zugeordnet. Er entsteht mit den Grunddaten (`npm run db:seed`). Fehlt er, bricht die Migration ab. |
| Ein aktiver Administrator mit Kanzlei | Die neuen Akten werden der Kanzlei des ersten aktiven Administrators zugeordnet. |

Adressen mit Benutzername und Passwort darin (`https://name:pw@…`) werden abgelehnt. Zugangsdaten gehören in die eigenen Felder.

## Ablauf

Die Seite heißt **J-Lawyer Migration** und liegt unter `/admin/jlawyer`. Einen Menüeintrag gibt es nicht; geben Sie die Adresse im Browser ein.

### 1. Verbindung einrichten

1. Im Abschnitt **Verbindung konfigurieren** **Server-URL**, **Benutzername** und **Passwort** eintragen.
2. **Verbindung testen** klicken. AI-Lawyer fragt testweise eine Akte ab. Erfolg zeigt **Verbunden**, ein Fehler **Fehler: …** mit dem Grund.
3. **Speichern** klicken. Es erscheint *Verbindungsdaten gespeichert*.

Das Passwortfeld ist danach leer und zeigt Punkte. Das Passwort ist gespeichert, wird aber nie wieder angezeigt. Lassen Sie das Feld beim nächsten Speichern leer, bleibt das alte Passwort erhalten.

### 2. Migration starten

1. Im Abschnitt **Migration** auf **Migration starten** klicken.
2. Der Status wechselt auf **Laueft...** mit dem Hinweis „Dies kann mehrere Minuten dauern. Der Status wird automatisch aktualisiert.“
3. Die Seite fragt den Stand alle paar Sekunden ab. Am Ende steht **Abgeschlossen** oder **Fehler**, darunter **Gestartet** und **Beendet**.

Die Übernahme läuft in einem Zug und in dieser Reihenfolge: Akten, Kontakte, Beteiligte, Dokumente, Kalender. Eine Fortschrittsanzeige je Schritt gibt es nicht. Lassen Sie die Seite offen, bis **Abgeschlossen** erscheint.

### 3. Abschlussbericht lesen

Der **Abschlussbericht** zeigt je eine Kachel für **Akten**, **Kontakte**, **Beteiligte**, **Dokumente** und **Kalender** mit der Zahl verarbeiteter Datensätze, daneben **Keine Fehler** oder **<Anzahl> Fehler**.

Mit **<Anzahl> Fehler anzeigen** klappen Sie die Liste auf. Jeder Eintrag nennt Art (z. B. `Akte`, `Kontakt`, `Beteiligter`, `dokument`, `kalender`), die j-lawyer-ID und die Meldung. Angezeigt werden die ersten 20; darunter steht „Und … weitere Fehler...“.

Ein Fehler bei einem einzelnen Datensatz bricht die Migration nicht ab. Der Datensatz fehlt dann in AI-Lawyer.

## Was übernommen wird

### Akten

| j-lawyer | AI-Lawyer |
| --- | --- |
| Aktenzeichen | **Aktenzeichen**. Fehlt es, entsteht `JL-<j-lawyer-ID>`. |
| Name | **Kurzrubrum** |
| Wegen | **Wegen** |
| Sachgebiet (Text) | Sachgebiet nach Stichwort: enthält der Text „arbeit“ → Arbeitsrecht, „famili“ → Familienrecht, „verkehr“, „miet“, „straf“, „erb“, „sozial“, „inkasso“, „handel“, „verwaltung“ entsprechend, sonst **Sonstiges**. |
| Status | OPEN/ACTIVE → Offen, SUSPENDED/SLEEPING → Ruhend, ARCHIVED → Archiviert, CLOSED → Geschlossen, sonst Offen. |
| Anlagedatum | Angelegt am |

Der zuständige Anwalt und die Sachbearbeitung aus j-lawyer werden **nicht** übernommen. Die Akten haben danach niemanden zugewiesen und sind deshalb nur für Administratoren sichtbar (siehe [Nach der Migration](#nach-der-migration)).

### Kontakte

Alle Kontakte aus j-lawyer, nicht nur die mit Akten. Übernommen werden Art (Person → natürliche Person, Organisation → juristische Person), Vorname, Nachname, Firma, Straße, PLZ, Ort, Land (ohne Angabe „Deutschland“), Telefon, Mobil, Fax, E-Mail, Geburtsdatum und Notiz.

**Achtung, Abgleich über E-Mail:** Gibt es in AI-Lawyer schon einen Kontakt mit derselben E-Mail-Adresse, der noch nicht aus j-lawyer stammt, wird **dieser Kontakt mit den j-lawyer-Daten überschrieben**, statt einen neuen anzulegen. Wer vor der Migration schon Kontakte in AI-Lawyer gepflegt hat, sollte das vorher prüfen.

### Beteiligte

Die Beteiligten jeder Akte werden mit ihrer Rolle verknüpft:

| Rolle in j-lawyer | Rolle in AI-Lawyer |
| --- | --- |
| CLIENT / MANDANT | Mandant |
| OPPONENT / GEGNER | Gegner |
| OPPONENT_ATTORNEY / GEGNERVERTRETER | Gegnervertreter |
| COURT / GERICHT | Gericht |
| WITNESS / ZEUGE | Zeuge |
| EXPERT / SACHVERSTAENDIGER | Sachverständiger |
| alles andere | Sonstiger |

Eigene Beteiligtenarten aus j-lawyer (etwa Versicherung, Behörde) landen also als **Sonstiger**. Die Notiz zur Beteiligung wird mitgenommen.

### Dokumente

Jedes Dokument einer Akte wird heruntergeladen und im Dokumentenspeicher (MinIO) unter `akten/<Akte>/jlawyer/…` abgelegt. Übernommen werden Dateiname, Dateityp, Größe und der Ordnername aus j-lawyer.

- Alle übernommenen Dokumente haben den Status **Entwurf**, auch wenn sie in j-lawyer längst versendet waren.
- Als Ersteller steht der Systembenutzer Helena.
- Texterkennung (OCR) und Suchindex werden **nicht** angestoßen. Die Dokumente sind deshalb zunächst nicht im Volltext durchsuchbar und Helena kennt ihren Inhalt nicht ([Kapitel 5](05-dokumente.md)).
- Nur die aktuelle Fassung, keine Versionsgeschichte.

### Kalender

| j-lawyer | AI-Lawyer |
| --- | --- |
| Termin (APPOINTMENT) | **Termin** |
| Frist (DEADLINE) | **Frist** |
| Wiedervorlage (FOLLOW_UP) | **Wiedervorlage** |

Übernommen werden Titel, Beschreibung, Beginn, Ende, ganztägig und erledigt. **Verantwortlich ist bei allen Einträgen der Systembenutzer Helena**, nicht die Person aus j-lawyer. Vorfristen werden nicht übernommen.

## Erneut einlesen

Die Migration lässt sich wiederholen, ohne dass Dubletten entstehen. AI-Lawyer merkt sich zu jedem Datensatz die j-lawyer-ID.

| Bereich | Beim zweiten Lauf |
| --- | --- |
| Akten | Werden aktualisiert: Aktenzeichen, Kurzrubrum, Wegen, Sachgebiet und Status werden wieder auf den j-lawyer-Stand gesetzt. |
| Kontakte | Werden mit den j-lawyer-Daten überschrieben. |
| Beteiligte | Vorhandene bleiben, die Notiz wird aktualisiert. Hat sich die Rolle geändert, kommt eine weitere Beteiligung mit der neuen Rolle hinzu; die alte bleibt. |
| Dokumente | Bereits übernommene werden übersprungen, neue kommen hinzu. |
| Kalender | Titel, Beschreibung, Daten, ganztägig und **erledigt** werden auf den j-lawyer-Stand gesetzt. |

Daraus folgt: **Änderungen, die Sie in AI-Lawyer an übernommenen Akten, Kontakten oder Kalendereinträgen gemacht haben, gehen bei einem weiteren Lauf verloren.** Eine in AI-Lawyer erledigte Frist kann dadurch wieder als offen erscheinen. Wiederholen Sie die Migration deshalb nur, solange in AI-Lawyer noch nicht produktiv gearbeitet wird. Gelöschtes in j-lawyer wird in AI-Lawyer nicht gelöscht.

## Was nicht übernommen wird

- Benutzer, Rollen, Gruppen und die Zuständigkeit (Anwalt, Sachbearbeitung) je Akte
- Rechnungen, Zahlungen, Aktenkonto, Zeiterfassung
- E-Mails, beA-Nachrichten, Aktenhistorie, Notizen zur Akte
- Etiketten, Falldatenblätter, eigene Felder
- Ordnerstruktur als Struktur (nur der Ordnername steht am Dokument), Dokumentversionen, Dokument-Etiketten
- Vorfristen und die verantwortliche Person bei Fristen

## Nach der Migration

Gehen Sie diese Liste vollständig durch, bevor Sie mit den übernommenen Akten arbeiten.

1. **Akten zuweisen.** Tragen Sie in jeder Akte **Anwalt** und **Sachbearbeiter/in** ein oder ordnen Sie die Akten einem Dezernat zu ([Kapitel 15](15-benutzer-und-rollen.md#dezernate)). Vorher sehen nur Administratoren die Akten.
2. **Fristen prüfen.** Jede übernommene Frist hat Helena als Verantwortliche. Erinnerungen und Warnungen gehen damit **an niemanden aus der Kanzlei**. Setzen Sie bei jeder offenen Frist die verantwortliche Person, prüfen Sie Datum und Fristablauf und legen Sie Vorfristen neu an ([Kapitel 6](06-fristen-und-kalender.md)). Ein Mensch muss jede übernommene Frist gegen die Akte prüfen.
3. **Wiedervorlagen und Termine** ebenso zuordnen.
4. **Dokumente indizieren.** Damit Suche und Helena die Inhalte kennen, müssen die Dokumente die Texterkennung durchlaufen. Ein Knopf dafür fehlt; wenden Sie sich an die IT ([Kapitel 21](21-betrieb-und-sicherung.md)).
5. **Dokumentstatus** bei Bedarf anpassen, etwa versendete Schreiben nicht als Entwurf stehen lassen.
6. **Beteiligte mit Rolle „Sonstiger“** durchsehen und korrigieren.
7. **Kontakte** auf ungewollt überschriebene Datensätze prüfen, wenn es vorher schon Kontakte gab.

### Empfehlung: Probelauf

Machen Sie die erste Übernahme in einer Testinstallation von AI-Lawyer, nicht in der Produktivumgebung. Vergleichen Sie Stichproben (Aktenzahl, einige Akten mit Beteiligten, Dokumenten und Fristen) mit j-lawyer. Erst wenn das passt, migrieren Sie produktiv, und zwar möglichst kurz vor dem Umstieg, damit nicht doppelt gepflegt wird. Sichern Sie vorher die Datenbank ([Kapitel 21](21-betrieb-und-sicherung.md)).

## Wenn etwas nicht klappt

| Meldung | Bedeutung | Was tun |
| --- | --- | --- |
| *Private/lokale Hosts sind nicht erlaubt. Fuer On-Premises-Installationen JLAWYER_ALLOW_PRIVATE_URLS=true setzen.* | j-lawyer läuft im internen Netz. | IT setzt `JLAWYER_ALLOW_PRIVATE_URLS=true` und startet AI-Lawyer neu. |
| *Unverschluesseltes http ist nicht erlaubt. …* | Adresse beginnt mit `http://`. | `https://` verwenden oder (intern) die Variable oben setzen. |
| *Ungueltige j-lawyer URL* | Die Adresse ist keine gültige URL. | Vollständig mit `https://` eingeben. |
| *Nur http(s)-URLs sind erlaubt* | Anderes Protokoll. | `https://…` verwenden. |
| *Zugangsdaten gehoeren nicht in die URL* | Name/Passwort stehen in der Adresse. | Aus der URL entfernen, in die Felder eintragen. |
| *Verbindungsdaten fehlen* | URL, Benutzer oder Passwort fehlt. | Alle drei Felder füllen. |
| *J-Lawyer API error 401 …* | Anmeldung abgelehnt. | Benutzer und Passwort prüfen. Bleibt es nach dem Speichern, ist evtl. `EMAIL_ENCRYPTION_KEY` geändert worden: Passwort neu eingeben und speichern. |
| *J-Lawyer API error 404 …* | Der aufgerufene Pfad existiert auf dem Server nicht. | Siehe [Vorab: Stand der Schnittstelle](#vorab-stand-der-schnittstelle). |
| *Fehler beim Speichern der Verbindungsdaten* | Meist fehlt `EMAIL_ENCRYPTION_KEY` oder ist kürzer als 32 Zeichen. | IT prüft die Variable ([Kapitel 20](20-konfiguration.md)). |
| *J-Lawyer Verbindungsdaten nicht konfiguriert* | Migration ohne gespeicherte Zugangsdaten gestartet. | Erst **Speichern**, dann starten. |
| *Migration läuft bereits* | Ein Lauf ist noch aktiv. | Warten. Wurde der Server während eines Laufs neu gestartet, bleibt der Status auf „läuft“ stehen; dann muss die IT den Eintrag `jlawyer.migration.status` in den Systemeinstellungen zurücksetzen. |
| *System user not found — required for migration authorship* | Der Systembenutzer Helena fehlt. | IT führt die Grunddaten aus (`npm run db:seed`). |
| Fehlerliste: *Unique constraint failed …* bei `Akte` | Das Aktenzeichen gibt es in AI-Lawyer schon. | Vorhandene Akte umbenennen oder in j-lawyer das Aktenzeichen prüfen, dann erneut migrieren. |
| Fehlerliste: *Kontakt not found in kontakteMap …* | Ein Beteiligter verweist auf einen Kontakt, der nicht übernommen wurde. | Kontakt in der Fehlerliste suchen, Ursache beheben, erneut migrieren. |
| Seite lädt nach einem Abbruch nicht mehr | Nach einem Lauf mit Status **Fehler** kann die Anzeige des Berichts scheitern. | IT setzt `jlawyer.migration.report` zurück. |

---

Weiter: [18 — Datenschutz und Audit](18-datenschutz-und-audit.md) · [Zur Übersicht](README.md)
