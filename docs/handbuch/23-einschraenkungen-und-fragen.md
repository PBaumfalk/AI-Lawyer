# 23 — Einschränkungen und häufige Fragen

Dieses Kapitel sagt ehrlich, was in AI-Lawyer (Version 0.9) noch nicht oder nur teilweise funktioniert, und beantwortet häufige Fragen aus Kanzlei und IT. Lesen Sie es, bevor Sie entscheiden, AI-Lawyer mit echten Mandantendaten zu nutzen.

AI-Lawyer ist laut README ein aktives Entwicklungsprojekt und **noch nicht für den Produktivbetrieb freigegeben**. Der nächste Meilenstein v1.0 „Production Hardening“ soll mehrere der folgenden Punkte beheben.

## Bekannte Einschränkungen

### Sicherheit und Zugriffsrechte

Diese Punkte wiegen am schwersten. **Betreiben Sie AI-Lawyer nicht mit echten
Mandantendaten und nicht mit Portalzugängen für Mandanten, solange sie offen sind.**

| Einschränkung | Auswirkung |
| --- | --- |
| **Aktenliste und Aktenansicht prüfen keine Zugriffsrechte.** `src/app/(dashboard)/akten/page.tsx` und `akten/[id]/page.tsx` laden Akten direkt aus der Datenbank, ohne Dezernat oder Zuweisung zu berücksichtigen. | Jeder angemeldete Benutzer sieht alle Akten der Kanzlei. |
| **Mandantenkonten kommen in die Kanzleioberfläche.** Das Layout unter `(dashboard)` sperrt die Rolle MANDANT nicht aus. | Ein Mandant, der sich über `/login` statt über `/portal/login` anmeldet, sieht die Aktenliste mit fremden Mandaten. In einer Testinstanz nachgestellt. Schnittstellen, die nur die Anmeldung prüfen (z. B. `GET /api/kontakte`), liefern ihm die vollständige Kontaktliste. |
| **Helena-Chat prüft den Aktenzugriff nicht.** `/api/ki-chat` lädt die übergebene Akte ohne Rechteprüfung. | Akteninhalte lassen sich über Helena abfragen, auch ohne Zugriff auf die Akte. |
| **Dokumentensuche ohne Aktenfilter.** `/api/search` prüft keine Aktenrechte. | Alle Kanzleirollen sehen Dateinamen und Textausschnitte aller Dokumente, auch über ⌘K ([Kapitel 13](13-suche-und-auswertung.md)). |
| **Weitere Listen ohne Zugriffsfilter:** Fristenzettel, Kalendereinträge ohne Akte, Tickets. | Inhalte aus Akten anderer Dezernate werden sichtbar. |
| **Rechte nur in der Seitenleiste.** `canEditAkte` und `canAccessEinstellungen` stehen in der Rechte-Matrix, werden aber nicht geprüft; Kontakt-Schnittstellen prüfen keine Rollen. | Das Sekretariat kann z. B. Kontakte löschen und Einstellungsseiten über die Adresse öffnen ([Kapitel 15](15-benutzer-und-rollen.md)). |
| **Geheimnisse im Klartext.** Das Zwei-Faktor-Geheimnis und der KI-API-Schlüssel liegen unverschlüsselt in der Datenbank; `GET /api/einstellungen/export` gibt den API-Schlüssel aus. | Wer die Datenbank oder einen Einstellungs-Export sieht, sieht die Schlüssel ([Kapitel 18](18-datenschutz-und-audit.md)). |
| **Einwilligung „KI-Verarbeitung erlaubt“ ohne Wirkung.** Das Feld `einwilligungAi` am Kontakt wird gespeichert, aber nirgends ausgewertet. | Helena verarbeitet Akten unabhängig davon, auch mit einem Cloud-Anbieter ([Kapitel 9](09-helena.md)). |

### Installation und Betrieb

| Einschränkung | Auswirkung | Umgehung |
| --- | --- | --- |
| **Prisma-Migrationen unvollständig.** Unter anderem fehlen die Tabelle `portal_invites` und die Spalte `users.inviteToken`. | Nach einer frischen Installation scheitern Mandantenportal-Einladungen und weitere Funktionen an fehlenden Tabellen oder Spalten. | Nach dem ersten Start einmal `npx prisma db push` im Container ausführen ([Kapitel 19](19-installation.md#erster-start-was-docker-entrypointsh-tut)). Behebung für v1.0 geplant. |
| **`minio/minio:latest` ist nicht mehr frei ziehbar.** | `docker compose up` bricht beim Dienst `minio` ab. | Eigenes, gespiegeltes oder fest versioniertes Image mit `mc` eintragen ([Kapitel 19](19-installation.md#bekannte-stolpersteine)). |
| **`setup.sh` und `docker-compose.yml` passen nicht zusammen.** Das Skript schreibt eine `.env`, die Compose-Datei liest sie nicht. | Die Container laufen mit fest eingetragenen Entwicklungs-Geheimnissen und `localhost`-Adressen, auch wenn das Skript andere Werte abgefragt hat. | Für Server `docker-compose.portainer.yml` mit `.env` und Zusatzdatei verwenden ([Kapitel 19](19-installation.md#zwei-compose-dateien)). |
| **Kein Socket.IO im Docker-Image.** Das Image startet den Next.js-Standalone-Server statt des eigenen Servers (`Dockerfile`: `CMD ["node", "server.js"]`). | Alles, was über Echtzeit-Ereignisse kommt, erscheint erst nach Neuladen der Seite: neue Team-Nachrichten, Benachrichtigungen, Aktualisierungen im Aktenverlauf, Bossfight-Anzeige. Der Browser versucht vergeblich, `/socket.io/` zu erreichen. | Seite neu laden. In der Entwicklung mit `npm run dev:server` läuft Socket.IO. |
| **Keine Benutzerverwaltung in der Oberfläche.** Es gibt keine Funktion, Kanzleikonten anzulegen, zu deaktivieren, ihre Rolle zu ändern oder ein Passwort zu ändern. Nur Mandanten können ihr Portal-Passwort ändern. | Beispielkonten mit dem öffentlich bekannten Passwort `password123` lassen sich nur über die Datenbank ändern. | SQL-Befehle in [Kapitel 19](19-installation.md#erste-anmeldung-und-beispielkonten). |
| **Docker-Ports offen.** `docker-compose.yml` veröffentlicht Datenbank, Redis (ohne Passwort), MinIO, Meilisearch, Ollama u. a. auf allen Schnittstellen mit Standard-Zugangsdaten; die Portainer-Datei immerhin noch Datenbank, MinIO-Konsole und OnlyOffice. | Ohne Gegenmaßnahme aus dem Netz erreichbar; Docker umgeht `ufw`. | Ports an `127.0.0.1` binden oder entfernen, Passwörter ändern ([Kapitel 19](19-installation.md#reverse-proxy-mit-https)). |
| **GPU-Pflicht in `docker-compose.yml`.** Ollama reserviert NVIDIA-GPUs. | Ohne NVIDIA Container Toolkit startet der Stack nicht. | GPU-Reservierung per Zusatzdatei entfernen. |
| **Protokollansicht unvollständig.** **System → Systemprotokoll** liest nur `<LOG_FILE_PATH>/app.log` im App-Container. | Worker-Protokolle erscheinen dort nicht; je nach Dateinamen der Rotation bleibt die Ansicht leer. | `docker compose logs` ([Kapitel 21](21-betrieb-und-sicherung.md#protokolle-auf-der-kommandozeile)). |
| **Kein eingebautes Backup, kein Knopf für den Suchindex.** | Sicherung und Neuaufbau des Index laufen über die Kommandozeile bzw. einen API-Aufruf. | [Kapitel 21](21-betrieb-und-sicherung.md). |
| **Next.js 14 ist veraltet.** | Sicherheitskorrekturen neuerer Versionen fehlen. | Umstieg ist für v1.0 geplant. Betreiben Sie AI-Lawyer bis dahin nicht direkt im Internet ohne zusätzlichen Schutz (VPN oder vorgeschaltete Anmeldung). |
| **Fremd-Images auf `latest`.** OnlyOffice, Stirling-PDF, Ollama, LanguageTool | Ein `docker compose pull` kann unbemerkt eine inkompatible Version bringen. | Versionen in der Zusatzdatei festschreiben. |

### Konfiguration

| Einschränkung | Auswirkung |
| --- | --- |
| `AI_PROVIDER`, `AI_MODEL`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `OLLAMA_BASE_URL`, `OLLAMA_DEFAULT_MODEL`, `OLLAMA_NUM_CTX`, `OPENCLAW_GATEWAY_URL` stehen in `.env.example`, `setup.sh` oder der Portainer-Datei, werden vom Code aber nicht gelesen. | Der KI-Anbieter wird ausschließlich unter **Einstellungen → KI** festgelegt ([Kapitel 20](20-konfiguration.md#ki)). |
| `.env.example` nennt `EMBEDDING_MODEL="nomic-embed-text"`. Die Datenbank erwartet 1024-dimensionale Vektoren, passend zum Standard `blaifa/multilingual-e5-large-instruct`. | Wer den Beispielwert übernimmt, bekommt fehlerhafte Einbettungen. Variable weglassen. |
| Die Datenbank-Einstellung `auth.totp.requiredRoles` wird nicht ausgewertet. | Die Zwei-Faktor-Pflicht wirkt nur über die Umgebungsvariable `TOTP_REQUIRED_ROLES`. |
| `NEXT_PUBLIC_KANZLEI_NAME` wird beim Image-Build nicht übergeben. | Die Portal-Aktivierungsseite zeigt „Kanzlei“ statt des Kanzleinamens. |
| In der Portainer-Datei hat `ONLYOFFICE_SECRET` keinen Pflicht-Vermerk, OnlyOffice bekommt dann `changeme`. | Editor funktioniert nicht, solange der Wert fehlt. |
| SMTP-Variablen stehen in keiner Compose-Datei. | Ohne eigene Ergänzung verschickt AI-Lawyer keine Systemmails (Fristerinnerungen, Portal-Einladungen, Ausfallwarnungen). |

### Fachliche Funktionen

| Einschränkung | Auswirkung |
| --- | --- |
| **BI-Dashboard:** Die Kennzahl zur Fristeneinhaltung fragt die Tabelle `"KalenderEintrag"` ab; sie heißt in der Datenbank `kalender_eintraege` (`src/lib/bi/kpi-queries.ts`). | Sobald im Zeitraum Fristen existieren, laden die Kennzahlen nicht ([Kapitel 13](13-suche-und-auswertung.md)). |
| **Rechnungsliste:** `/finanzen/rechnungen` ruft `stats.stornoquote.toFixed(1)` auf (`src/components/finanzen/invoice-list.tsx`), die API `src/app/api/finanzen/rechnungen/route.ts` liefert `stornoquote` aber nicht mit. | Die Seite stürzt ab, sobald Rechnungen existieren ([Kapitel 10](10-zeiterfassung-und-abrechnung.md)). |
| **Dashboard-Begrüßung:** nimmt das erste Wort des Namens. | Bei „Dr. Maria Schmidt“ erscheint „Willkommen, Dr.“. Kosmetisch. |
| **beA ist derzeit nicht nutzbar.** Die Bibliothek von bea.expert ist nicht eingebunden (`src/lib/bea/client.ts`), jede Anmeldung endet mit „beA-Bibliothek konnte nicht geladen werden“. Scheitert ein Versand oder ein eEB, speichert AI-Lawyer ihn trotzdem als gesendet bzw. bestätigt. | Kein beA über AI-Lawyer. Versand und eEB nie anhand der Statusanzeige als erledigt betrachten ([Kapitel 8](08-bea.md)). |
| **E-Mail-Anhänge werden nicht verschickt.** `/api/email-send` legt keine Anhänge an; die älteren Seiten `/email/compose` und `/email/[id]` können gar nicht senden. | E-Mails mit Dokumenten kommen ohne Anhang an ([Kapitel 7](07-email-und-tickets.md)). |
| **Fristen lassen sich kaum erledigen.** Die Kalenderliste schickt keinen Erledigungsgrund, für überfällige Fristen fragt keine Oberfläche den verlangten Überschreitungsgrund ab. Externe Termine aus CalDAV bringen die Kalenderliste zum Absturz. Der Fristenrechner speichert mit „Als Frist speichern“ nichts. | Fristen bleiben offen stehen; Fristen von Hand anlegen und prüfen ([Kapitel 6](06-fristen-und-kalender.md)). |
| **Beteiligte lassen sich nicht von Hand hinzufügen.** Der Dialog samt Kollisionsprüfung ist nicht eingebunden. | Beteiligte kommen nur über Helena-Vorschläge oder die j-lawyer-Migration in eine Akte, ohne Kollisionsprüfung ([Kapitel 3](03-akten.md)). |
| **j-lawyer-Migration erreicht vermutlich keine Daten.** Der Client ruft Pfade unter `/api/v2/…` auf, die eine aktuelle j-lawyer-Instanz nicht anbietet. Übernommene Fristen gehen an den Systembenutzer Helena, Akten bleiben ohne Zuweisung. | Migration vorher mit einer Testinstanz ausprobieren ([Kapitel 17](17-migration-aus-j-lawyer.md)). |
| **Rechnungen und Aktenkonto.** Es gibt keine Maske zum Anlegen einer Rechnung; „Bezahlt markieren“, „Mahnung“ und „Bearbeiten“ wirken nicht; Speichern und Übernehmen aus dem RVG-Rechner schlägt fehl; Stornieren im Aktenkonto schlägt fehl. | Abrechnung derzeit nicht produktiv nutzbar ([Kapitel 10](10-zeiterfassung-und-abrechnung.md)). |
| **RVG-Rechner, fachlich.** VV 3305 ist mit 0,5 statt 1,0 voreingestellt, Altfälle nach § 60 RVG lassen sich nicht rechnen, die Auslagenpauschale wird nur einmal je Berechnung angesetzt. | Jede Berechnung von Hand prüfen ([Kapitel 10](10-zeiterfassung-und-abrechnung.md)). |
| **Zeiterfassung startet von selbst.** Beim Öffnen einer Akte startet der Timer automatisch und bucht mindestens eine Minute als abrechenbar. | Zeiteinträge vor der Abrechnung durchsehen. |
| **Benutzer:** kein Anlegen, Deaktivieren, Rollenwechsel oder Passwortwechsel in der Oberfläche, kein Zurücksetzen der Zwei-Faktor-Anmeldung durch Admins. | Nur über die Datenbank ([Kapitel 15](15-benutzer-und-rollen.md)). |
| **Helena-Websuche** (`search_web`) ist ein Platzhalter. | Helena antwortet „Web-Suche ist noch nicht konfiguriert. Nutze search_gesetze und search_urteile fuer rechtliche Recherche.“ Recherche nur in Gesetzen, Urteilen und eigenen Mustern ([Kapitel 9](09-helena.md)). |
| **Ollama ist auch bei Cloud-KI nötig.** Einbettungen, Reranking (fest `qwen3.5:35b`) und die PII-Erkennung laufen immer über `OLLAMA_URL`. Die PII-Erkennung schickt dabei das unter **Einstellungen → KI** eingetragene Modell an Ollama. | Mit OpenAI oder Anthropic als Anbieter ist dieser Modellname in Ollama unbekannt; neue Schriftsatzmuster bleiben dann in der Prüfung hängen. Reranking ohne `qwen3.5:35b` in Ollama scheitert. |
| **Einstellungen → Benachrichtigungen:** Der Schalter **E-Mail-Benachrichtigungen** ist dauerhaft gesperrt („Verfuegbar nach Einrichtung des E-Mail-Systems (Phase 3)“). | Nicht schaltbar; Fristerinnerungen per Mail hängen allein an der SMTP-Konfiguration und der Fristen-Einstellung ([Kapitel 16](16-einstellungen-und-vorlagen.md)). |
| **LanguageTool** ist als optionaler Dienst (Profil `full`) in `docker-compose.yml` enthalten, im Code aber nicht angebunden. | Keine Rechtschreibprüfung über LanguageTool. Den Dienst müssen Sie nicht starten. |
| **Protokollstufe in den Einstellungen:** Der Worker empfängt Änderungen der Protokollstufe, setzt sie aber nicht um. | `LOG_LEVEL` wirkt nur beim Start. |
| **Tests:** 442 Unit-Tests, keine Oberflächen- oder End-to-End-Tests. | Fehler in der Oberfläche fallen erst im Gebrauch auf. |

Fristberechnungen, Gebührenberechnungen und KI-Entwürfe sind Hilfsmittel. Ein Mensch prüft jedes Ergebnis, bevor es verwendet wird.

## Häufige Fragen

### Verlassen Mandantendaten den Server?

Nicht, solange Sie Ollama als KI-Anbieter nutzen: Datenbank, Dateien, Suche und KI laufen dann auf Ihrem Server. Ausgehend lädt der Worker nur öffentliche Daten (Gesetze von GitHub, Urteile aus den RSS-Feeds von rechtsprechung-im-internet.de, beim Start die KI-Modelle). Stellen Sie unter **Einstellungen → KI** OpenAI oder Anthropic ein, gehen die Anfragen an Helena samt den dafür gelesenen Akteninhalten an diesen Anbieter. Ob und mit welchem Vertrag das berufsrechtlich zulässig ist, entscheidet die Kanzlei ([Kapitel 18](18-datenschutz-und-audit.md)).

### Brauchen wir eine Grafikkarte?

Für das Standardmodell `qwen3.5:35b` in vertretbarer Geschwindigkeit ja, als Richtwert eine NVIDIA-Karte mit 24 GB Grafikspeicher oder mehr. Ohne GPU läuft Ollama auf dem Prozessor, Antworten dauern dann sehr lange. Mit einem Cloud-Anbieter brauchen Sie keine GPU, Ollama aber trotzdem für Einbettungen und Reranking ([Kapitel 19](19-installation.md#voraussetzungen)).

### Wie legen wir neue Mitarbeitende an oder ändern Passwörter?

Derzeit nur über die Datenbank, siehe [Kapitel 19](19-installation.md#erste-anmeldung-und-beispielkonten). Ändern Sie die Passwörter der Beispielkonten vor allem anderen. Mandantenkonten entstehen dagegen über Einladungen im Portal ([Kapitel 12](12-mandantenportal.md)).

### Kann Helena selbst Schriftsätze verschicken oder freigeben?

Nein. Helena hat keine Werkzeuge zum Versenden, Freigeben, Löschen oder Ändern von Buchungen. Zusätzlich hält die Datenbankschicht jedes von der KI erzeugte Dokument im Status `ENTWURF`, bis ein Mensch es freigibt (`src/lib/db.ts`, [Kapitel 22](22-architektur-und-entwicklung.md#fachliche-sperren-in-der-datenbankschicht)).

### Warum sehe ich neue Nachrichten erst nach dem Neuladen?

Im Docker-Betrieb läuft derzeit kein Socket.IO-Server (siehe oben). Laden Sie die Seite neu. Das betrifft Team-Nachrichten, Benachrichtigungen und Live-Aktualisierungen in der Akte, nicht die gespeicherten Daten selbst.

### Wie sichern wir die Daten, und was brauchen wir für die Wiederherstellung?

Datenbank-Dump, MinIO-Volume und die Geheimnisse, vor allem `EMAIL_ENCRYPTION_KEY`. Der Suchindex lässt sich neu aufbauen. Anleitung in [Kapitel 21](21-betrieb-und-sicherung.md#was-gesichert-werden-muss).

### Läuft AI-Lawyer ohne Internet?

Der Kanzleibetrieb mit Ollama ja, sobald die Images gebaut und die Modelle geladen sind. Ohne Internet entfallen der nächtliche Abgleich von Gesetzen und Urteilen, beA (über bea.expert), Cloud-KI, der E-Mail-Verkehr nach außen und der Kalenderabgleich mit Google oder Apple.

### Können wir j-lawyer parallel weiter nutzen?

Die Migration liest über die REST-API von j-lawyer und erkennt bereits übernommene Akten, Kontakte und Dokumente an ihrer j-lawyer-ID, sodass ein erneuter Lauf aktualisiert statt doppelt anzulegen. Damit ist eine Übergangszeit mit wiederholtem Abgleich möglich. Änderungen in AI-Lawyer fließen nicht zurück nach j-lawyer. Einzelheiten in [Kapitel 17](17-migration-aus-j-lawyer.md).

### Brauchen wir für beA etwas extra?

Derzeit lässt sich beA über AI-Lawyer nicht nutzen, weil die Bibliothek von bea.expert nicht eingebunden ist (siehe oben). Sobald das behoben ist, braucht es eine kommerzielle Registrierung bei bea.expert. beA ist nach der Installation ausgeschaltet (Einstellung `bea.enabled` = `false`) und muss eingeschaltet werden ([Kapitel 8](08-bea.md)).

### Wo sehen wir, ob alles läuft?

Admins unter **System** (`/admin/system`) und **Job-Monitor** (`/admin/jobs`). Für eine externe Überwachung `GET /api/health` abfragen ([Kapitel 21](21-betrieb-und-sicherung.md#systemstatus-und-protokolle)).

### Können wir AI-Lawyer direkt ins Internet stellen?

Nur mit Vorsicht. Next.js 14 ist veraltet, und die Standard-Compose-Datei öffnet viele Ports. Mindestens: HTTPS über einen Reverse Proxy, alle internen Ports an `127.0.0.1` gebunden, eigene Passwörter und Schlüssel, Zwei-Faktor-Pflicht über `TOTP_REQUIRED_ROLES`. Besser ist der Zugang über VPN, bis v1.0 die Sicherheitsupdates bringt. Für das Mandantenportal muss die Anwendung allerdings von außen erreichbar sein ([Kapitel 12](12-mandantenportal.md)).

### Wem melden wir Fehler?

Als Issue im Repository auf GitHub, mit Version (`git describe --tags`), Schritten zum Nachstellen und den passenden Zeilen aus `docker compose logs`. Keine Mandantendaten in Fehlerberichte ([Kapitel 22](22-architektur-und-entwicklung.md#beitragen)).

---

[Zur Übersicht](README.md)
