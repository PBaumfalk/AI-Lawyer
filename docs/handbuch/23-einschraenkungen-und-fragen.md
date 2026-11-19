# 23 — Einschränkungen und häufige Fragen

Dieses Kapitel sagt ehrlich, was in AI-Lawyer (Version 0.9) noch nicht oder nur teilweise funktioniert, und beantwortet häufige Fragen aus Kanzlei und IT. Lesen Sie es, bevor Sie entscheiden, AI-Lawyer mit echten Mandantendaten zu nutzen.

AI-Lawyer ist laut README ein aktives Entwicklungsprojekt und **noch nicht für den Produktivbetrieb freigegeben**. Der nächste Meilenstein v1.0 „Production Hardening“ soll mehrere der folgenden Punkte beheben.

## Bekannte Einschränkungen

Eine große Fehlerbehebungsrunde hat viele früher hier aufgeführte Punkte
geschlossen, unter anderem die Zugriffsrechte (Aktenrechte in Aktenliste,
Aktenansicht, Suche, Helena und den Schnittstellen; Mandantenkonten nur im
Portal), die Installation (vollständige Migrationen, `.env` wird gelesen,
Socket.IO im Image, neues MinIO-Image), Fristen erledigen, E-Mail-Anhänge,
Rechnungsliste und Aktenkonto, Beteiligte hinzufügen, das BI-Dashboard und die
j-lawyer-Migration. Die folgenden Tabellen nennen nur, was heute noch offen ist.

### Sicherheit und Zugriffsrechte

| Einschränkung | Auswirkung |
| --- | --- |
| **Einwilligung „KI-Verarbeitung erlaubt“ ohne Wirkung.** Das Feld `einwilligungAi` am Kontakt wird gespeichert und angezeigt, aber nirgends ausgewertet. | Helena verarbeitet Akten unabhängig davon, auch mit einem Cloud-Anbieter. Ob die Einwilligung nötig ist und wie sie beachtet wird, entscheidet die Kanzlei ([Kapitel 9](09-helena.md), [Kapitel 18](18-datenschutz-und-audit.md)). |
| **Helena-Unterhaltungen ohne Akte sind per Link teilbar.** Eine Unterhaltung ohne Aktenbezug kann jeder angemeldete Kanzleibenutzer öffnen, der ihre Adresse kennt; Unterhaltungen mit Akte folgen den Aktenrechten. | Keine vertraulichen Inhalte in Unterhaltungen ohne Akte schreiben. |
| **beA-Postfach ohne Aktenfilter.** Die beA-Nachrichtenliste prüft nur das Recht `canReadBeA`, das alle Kanzleirollen außer Mandanten haben. | Sekretariat und Sachbearbeitung sehen alle beA-Nachrichten der Kanzlei, auch zu Akten, auf die sie sonst keinen Zugriff haben ([Kapitel 8](08-bea.md)). |
| **Kalendereinträge ohne Akte sehen alle.** Kalenderliste und Fristenzettel zeigen Einträge ohne Akte jedem Kanzleibenutzer; Einträge mit Akte folgen den Aktenrechten. | Persönliche Termine ohne Akte sind nicht privat. |
| **Next.js 14 ist veraltet.** | Sicherheitskorrekturen neuerer Versionen fehlen. Der Umstieg ist für v1.0 geplant. Betreiben Sie AI-Lawyer bis dahin nicht direkt im Internet ohne zusätzlichen Schutz (VPN oder vorgeschaltete Anmeldung). |

### Installation und Betrieb

| Einschränkung | Auswirkung | Umgehung |
| --- | --- | --- |
| **Redis-Verbindungsversuche beim Build.** `src/lib/queue/queues.ts` legt die BullMQ-Warteschlangen schon beim Laden des Moduls an, also auch während `next build`. | Im Build-Protokoll können Verbindungsfehler zu Redis erscheinen, weil beim Bauen kein Redis läuft. | Meldungen beim Build nicht als Fehler des laufenden Systems werten. |
| **`docker-compose.portainer.yml` ist nicht auf dem Stand von `docker-compose.yml`.** Redis läuft dort ohne Passwort; `POSTGRES_PASSWORD`, `MINIO_SECRET_KEY` und `MEILISEARCH_API_KEY` haben öffentlich bekannte Standardwerte; der MinIO-Port 9000 ist nicht veröffentlicht; der Worker bekommt keine SMTP-Werte. | Ohne eigene Werte unsichere Zugangsdaten, Downloads aus MinIO scheitern ohne zusätzlichen Proxy, keine Fristerinnerungen per Mail aus dem Worker. | Alle Geheimnisse ausdrücklich setzen oder `docker-compose.yml` mit `.env` verwenden ([Kapitel 19](19-installation.md)). |
| **App, MinIO-API und OnlyOffice lauschen standardmäßig auf allen Schnittstellen.** `PUBLIC_BIND` ist in `.env.example` `0.0.0.0`; die internen Dienste (Datenbank, Redis, Meilisearch, Ollama u. a.) sind nur an `127.0.0.1` gebunden. | Ohne Reverse Proxy sind die Ports 3000, 9000 und 8080 aus dem Netz erreichbar; Docker umgeht `ufw`. | Hinter einem Reverse Proxy `PUBLIC_BIND="127.0.0.1"` setzen ([Kapitel 19](19-installation.md), [Kapitel 20](20-konfiguration.md)). |
| **Protokollansicht unvollständig.** **System → Systemprotokoll** liest nur `<LOG_FILE_PATH>/app.log` im App-Container. | Worker-Protokolle erscheinen dort nicht; je nach Dateinamen der Rotation bleibt die Ansicht leer. | `docker compose logs` ([Kapitel 21](21-betrieb-und-sicherung.md)). |
| **Sicherung nur per Kommandozeile, kein Knopf für den Suchindex.** | Die verschlüsselte Sicherung (`scripts/backup.sh`, per systemd-Timer automatisierbar) und die Wiederherstellung samt Suchindex laufen über Skripte; ein externes Sicherungsziel müssen Sie selbst bereitstellen. Eine Oberfläche dafür gibt es nicht. | [Kapitel 21](21-betrieb-und-sicherung.md#sicherung). |
| **Fremd-Images auf `latest`.** OnlyOffice, Stirling-PDF, Ollama, LanguageTool und das MinIO-Image von Chainguard | Ein `docker compose pull` kann unbemerkt eine inkompatible Version bringen. | Versionen in einer Zusatzdatei bzw. über `MINIO_IMAGE` festschreiben. |

### Konfiguration

| Einschränkung | Auswirkung |
| --- | --- |
| Die Datenbank-Einstellung `auth.totp.requiredRoles` wird nicht ausgewertet. | Die Zwei-Faktor-Pflicht wirkt nur über die Umgebungsvariable `TOTP_REQUIRED_ROLES` ([Kapitel 20](20-konfiguration.md)). |
| `AI_PROVIDER`, `AI_MODEL` und die API-Schlüssel aus `.env` gelten nur als Startwerte beim ersten Start. | Danach zählt allein **Einstellungen → KI**; spätere Änderungen in `.env` wirken nicht ([Kapitel 20](20-konfiguration.md)). |
| **Einstellungen → Fristen** speichert Vorfristen, Standard-Bundesland, Eskalationszeiten und Arbeitszeiten, der übrige Code liest diese Werte aber nicht. | Die Einstellungen sind wirkungslos ([Kapitel 16](16-einstellungen-und-vorlagen.md)). |

### Fachliche Funktionen

| Einschränkung | Auswirkung |
| --- | --- |
| **beA: Die Bibliothek von bea.expert fehlt.** Sie ist kommerziell und nicht im Repository enthalten (`src/lib/bea/client.ts`); jede Anmeldung endet mit „beA-Bibliothek konnte nicht geladen werden“. AI-Lawyer scheitert dabei ehrlich: Eine Nachricht gilt erst mit beA-Nachrichten-ID als gesendet, ein eEB erst mit Bestätigung von bea.expert. | Kein beA über AI-Lawyer, bis die Bibliothek lizenziert und eingebunden ist ([Kapitel 8](08-bea.md)). |
| **Keine Maske zum Anlegen oder Bearbeiten einer Rechnung.** Rechnungen entstehen nur über die Übernahme aus dem RVG-Rechner mit Aktenbezug; diesen Aufruf bietet keine Seite als Knopf an, er geht nur über die Adresse `/finanzen/rechner?akteId=…&aktenzeichen=…`. Der Knopf **Bearbeiten (noch nicht verfuegbar)** ist gesperrt. | Keine Stundenhonorar- oder Pauschalrechnungen über die Oberfläche; Positionen einer bestehenden Rechnung lassen sich nicht ändern ([Kapitel 10](10-zeiterfassung-und-abrechnung.md)). |
| **Mahnungen werden nicht versendet.** **Mahnung** erhöht die Mahnstufe (bis zur 3. Mahnung) und legt einen Mahnungs-Datensatz an, verschickt aber nichts. | Mahnschreiben selbst erstellen und versenden. |
| **Toter Link im Aktenkonto.** Buchungen mit Beleg verweisen auf `/dokumente/<id>`, eine solche Seite gibt es nicht. | Den Beleg über den Reiter **Dokumente** der Akte öffnen. |
| **Fremdgeld-Verrechnung nach FIFO.** Weiterleitungen werden den ältesten offenen Fremdgeld-Eingängen zugeordnet; danach richtet sich die Warnung zur Weiterleitungsfrist. | Fachlich prüfen, ob diese Zuordnung im Einzelfall passt. |
| **RVG-Rechner, fachlich.** Die Anrechnung der Mahnverfahrensgebühr VV 3305 auf die Verfahrensgebühr VV 3100 fehlt (angerechnet wird nur die Geschäftsgebühr nach Vorbem. 3 Abs. 4 VV RVG), Altfälle nach § 60 RVG lassen sich nicht rechnen, die Auslagenpauschale wird nur einmal je Berechnung angesetzt. | Jede Berechnung von Hand prüfen ([Kapitel 10](10-zeiterfassung-und-abrechnung.md)). |
| **Beteiligte lassen sich in der Oberfläche nicht entfernen.** Hinzufügen geht per Dialog mit Kollisionsprüfung; Beteiligte aus Helena-Vorschlägen durchlaufen keine Kollisionsprüfung. | Falsch eingetragene Beteiligte bleiben stehen; Helena-Vorschläge selbst auf Interessenkollision prüfen ([Kapitel 3](03-akten.md)). |
| **Fristenrechner rückwärts:** **Als Frist speichern** ist auch bei einer Rückwärtsberechnung sichtbar, tut dann aber nichts. | Rückwärts berechnete Daten von Hand als Frist anlegen ([Kapitel 6](06-fristen-und-kalender.md)). |
| **Zeiterfassung startet von selbst.** Beim Öffnen einer Akte startet der Timer automatisch und bucht mindestens eine Minute als abrechenbar. | Zeiteinträge vor der Abrechnung durchsehen. |
| **BI-Kennzahl „überfällige Fristen“** zählt eine Frist ab ihrem gespeicherten Zeitpunkt, nicht erst nach Ablauf des letzten Tages wie Kalenderliste und Erledigen (siehe unten). | Die Zahl kann am Tag des Fristablaufs höher sein als die Kalenderliste. |
| **Helena-Websuche** (`search_web`) ist ein Platzhalter. | Helena antwortet „Web-Suche ist noch nicht konfiguriert. Nutze search_gesetze und search_urteile fuer rechtliche Recherche.“ Recherche nur in Gesetzen, Urteilen und eigenen Mustern ([Kapitel 9](09-helena.md)). |
| **Ollama ist auch bei Cloud-KI nötig.** Einbettungen, Reranking (fest `qwen3.5:35b`) und die PII-Erkennung laufen immer über `OLLAMA_URL`. Die PII-Erkennung schickt dabei das unter **Einstellungen → KI** eingetragene Modell an Ollama. | Mit OpenAI oder Anthropic als Anbieter ist dieser Modellname in Ollama unbekannt; neue Schriftsatzmuster bleiben dann in der Prüfung hängen. Reranking ohne `qwen3.5:35b` in Ollama scheitert. |
| **Briefkopf als Standard setzen** schlägt bei einem bestehenden Briefkopf fehl: Die Oberfläche sendet JSON, die Schnittstelle erwartet Formulardaten. | Den Standard-Briefkopf beim Anlegen festlegen ([Kapitel 16](16-einstellungen-und-vorlagen.md)). |
| **Vorlagen:** **In OnlyOffice oeffnen** im Vorlagen-Assistenten bleibt ohne Wirkung; Zusatzfelder für Vorlagen lassen sich in der Oberfläche nicht anlegen. | Das erzeugte Dokument über den Reiter **Dokumente** der Akte öffnen ([Kapitel 16](16-einstellungen-und-vorlagen.md)). |
| **Einstellungen → Benachrichtigungen:** Der Schalter **E-Mail-Benachrichtigungen** ist dauerhaft gesperrt („Verfuegbar nach Einrichtung des E-Mail-Systems (Phase 3)“). | Nicht schaltbar; Fristerinnerungen per Mail hängen allein an der SMTP-Konfiguration ([Kapitel 16](16-einstellungen-und-vorlagen.md)). |
| **LanguageTool** ist als optionaler Dienst (Profil `full`) in `docker-compose.yml` enthalten, im Code aber nicht angebunden. | Keine Rechtschreibprüfung über LanguageTool. Den Dienst müssen Sie nicht starten. |
| **Protokollstufe in den Einstellungen:** Der Worker empfängt Änderungen der Protokollstufe, setzt sie aber nicht um. | `LOG_LEVEL` wirkt nur beim Start. |
| **Tests:** Unit-, Architektur- und Integrationstests (gegen PostgreSQL und Redis), aber keine Oberflächen- oder End-to-End-Tests. | Fehler in der Oberfläche fallen erst im Gebrauch auf ([Kapitel 22](22-architektur-und-entwicklung.md)). |

### Geänderte Fristregel

Eine Frist gilt erst als überfällig, wenn ihr letzter Tag vollständig abgelaufen
ist (§ 188 Abs. 1 BGB, § 222 Abs. 1 ZPO), maßgeblich ist der Kalendertag in der
Zeitzone Europe/Berlin (`src/lib/fristen/erledigung.ts`). Wer eine Frist am Tag
ihres Ablaufs erledigt, muss deshalb keinen Überschreitungsgrund mehr angeben;
erst ab dem Folgetag verlangt der Erledigungsdialog ihn. Die Kalenderliste färbt
Fristen nach derselben Regel ([Kapitel 6](06-fristen-und-kalender.md)).

Fristberechnungen, Gebührenberechnungen und KI-Entwürfe sind Hilfsmittel. Ein Mensch prüft jedes Ergebnis, bevor es verwendet wird.

## Häufige Fragen

### Verlassen Mandantendaten den Server?

Nicht, solange Sie Ollama als KI-Anbieter nutzen: Datenbank, Dateien, Suche und KI laufen dann auf Ihrem Server. Ausgehend lädt der Worker nur öffentliche Daten (Gesetze von GitHub, Urteile aus den RSS-Feeds von rechtsprechung-im-internet.de, beim Start die KI-Modelle). Stellen Sie unter **Einstellungen → KI** OpenAI oder Anthropic ein, gehen die Anfragen an Helena samt den dafür gelesenen Akteninhalten an diesen Anbieter. Ob und mit welchem Vertrag das berufsrechtlich zulässig ist, entscheidet die Kanzlei ([Kapitel 18](18-datenschutz-und-audit.md)).

### Brauchen wir eine Grafikkarte?

Für das Standardmodell `qwen3.5:35b` in vertretbarer Geschwindigkeit ja, als Richtwert eine NVIDIA-Karte mit 24 GB Grafikspeicher oder mehr. Ohne GPU läuft Ollama auf dem Prozessor, Antworten dauern dann sehr lange. Die GPU ist optional: `setup.sh` erkennt eine NVIDIA-Karte über `nvidia-smi` und bindet dann `docker-compose.gpu.yml` ein. Mit einem Cloud-Anbieter brauchen Sie keine GPU, Ollama aber trotzdem für Einbettungen und Reranking ([Kapitel 19](19-installation.md#voraussetzungen)).

### Wie legen wir neue Mitarbeitende an oder ändern Passwörter?

Unter **Admin → Benutzer**: Konto anlegen, Rolle ändern, deaktivieren, Passwort zurücksetzen ([Kapitel 15](15-benutzer-und-rollen.md)). Das eigene Passwort ändert jede Person unter **Einstellungen → Sicherheit**. Mandantenkonten entstehen über Einladungen im Portal ([Kapitel 12](12-mandantenportal.md)).

### Kann Helena selbst Schriftsätze verschicken oder freigeben?

Nein. Helena hat keine Werkzeuge zum Versenden, Freigeben, Löschen oder Ändern von Buchungen. Zusätzlich hält die Datenbankschicht jedes von der KI erzeugte Dokument im Status `ENTWURF`, bis ein Mensch es freigibt (`src/lib/db.ts`, [Kapitel 22](22-architektur-und-entwicklung.md#fachliche-sperren-in-der-datenbankschicht)).

### Warum sehe ich neue Nachrichten erst nach dem Neuladen?

Das Docker-Image startet inzwischen den eigenen Server mit Socket.IO; Team-Nachrichten, Benachrichtigungen und Live-Aktualisierungen kommen ohne Neuladen an. Bleiben sie aus, leitet meist der Reverse Proxy die WebSocket-Verbindung zu `/socket.io/` nicht weiter ([Kapitel 19](19-installation.md)). Die gespeicherten Daten selbst sind davon nicht betroffen.

### Wie sichern wir die Daten, und was brauchen wir für die Wiederherstellung?

Datenbank-Dump und MinIO-Volume (verschlüsselt mit `scripts/backup.sh`) und, getrennt verwahrt, die Geheimnisse, vor allem `EMAIL_ENCRYPTION_KEY` und den Sicherungsschlüssel. Der Suchindex wird bei der Wiederherstellung automatisch neu aufgebaut. Anleitung in [Kapitel 21](21-betrieb-und-sicherung.md#was-gesichert-werden-muss).

### Läuft AI-Lawyer ohne Internet?

Der Kanzleibetrieb mit Ollama ja, sobald die Images gebaut und die Modelle geladen sind. Ohne Internet entfallen der nächtliche Abgleich von Gesetzen und Urteilen, beA (über bea.expert), Cloud-KI, der E-Mail-Verkehr nach außen und der Kalenderabgleich mit Google oder Apple.

### Können wir j-lawyer parallel weiter nutzen?

Die Migration liest über die REST-API von j-lawyer und erkennt bereits übernommene Akten, Kontakte, Fristen und Dokumente an ihrer j-lawyer-ID. Ein erneuter Lauf legt nur fehlende Datensätze an und überschreibt nichts; Änderungen an bereits übernommenen Datensätzen in j-lawyer werden also nicht nachgezogen. Damit ist eine Übergangszeit möglich, in der neue Akten wiederholt übernommen werden. Änderungen in AI-Lawyer fließen nicht zurück nach j-lawyer. Einzelheiten in [Kapitel 17](17-migration-aus-j-lawyer.md).

### Brauchen wir für beA etwas extra?

Ja. Die Bibliothek von bea.expert ist kommerziell und nicht in AI-Lawyer enthalten; ohne sie scheitert jede beA-Anmeldung mit einer Fehlermeldung (siehe oben). Nötig sind eine Registrierung bzw. Lizenz bei bea.expert und das Einbinden der Bibliothek. beA ist nach der Installation ausgeschaltet (Einstellung `bea.enabled` = `false`) und muss eingeschaltet werden ([Kapitel 8](08-bea.md)).

### Wo sehen wir, ob alles läuft?

Admins unter **System** (`/admin/system`) und **Job-Monitor** (`/admin/jobs`). Für eine externe Überwachung `GET /api/health` abfragen ([Kapitel 21](21-betrieb-und-sicherung.md#systemstatus-und-protokolle)).

### Können wir AI-Lawyer direkt ins Internet stellen?

Nur mit Vorsicht. Next.js 14 ist veraltet. Die internen Dienste sind bereits nur an `127.0.0.1` gebunden und mit den von `setup.sh` erzeugten Passwörtern geschützt. Mindestens zusätzlich: HTTPS über einen Reverse Proxy, `PUBLIC_BIND="127.0.0.1"` für App, MinIO und OnlyOffice, Zwei-Faktor-Pflicht über `TOTP_REQUIRED_ROLES`. Besser ist der Zugang über VPN, bis v1.0 die Sicherheitsupdates bringt. Für das Mandantenportal muss die Anwendung allerdings von außen erreichbar sein ([Kapitel 12](12-mandantenportal.md)).

### Wem melden wir Fehler?

Als Issue im Repository auf GitHub, mit Version (`git describe --tags`), Schritten zum Nachstellen und den passenden Zeilen aus `docker compose logs`. Keine Mandantendaten in Fehlerberichte ([Kapitel 22](22-architektur-und-entwicklung.md#beitragen)).

---

[Zur Übersicht](README.md)
