# beA-Integration: Recherche und Übergabe

Stand: 2026-11-19. Grundlage: Quellcode von `jlawyerorg/j-lawyer-org` (Commit-Stand 12.11.2026), `jlawyerorg/j-lawyer-documentation`, Docker Hub `jlawyerorg/beastie`, GitLab `beaexpert/*` und der Ist-Stand in AI-Lawyer.

Zweck: Eine eigenständige Session soll mit diesem Dokument beA in AI-Lawyer umsetzen können, ohne die Recherche zu wiederholen.

---

## 1. Kurzfassung

1. **j-lawyer spricht das beA nicht selbst an.** Der Server ruft per HTTP einen separaten Docker-Container auf: **beAstie** (`jlawyerorg/beastie`, Port 7080). Darin läuft das geschlossene `j-lawyer-bea-wrapper.jar`. Es baut auf dem offiziellen **BRAK-KSW-Toolkit** auf (Java, OSCI, XJustiz, Signaturbibliotheken) und bringt j-lawyers eigene Produkt-Keystores für Produktiv- und Testumgebung mit.
2. **Im Februar 2026 hat j-lawyer die beA-Logik bewusst aus dem Desktop-Client auf den Server verlagert.** Begründung: zentrale Sitzungen, keine Zertifikate auf den Arbeitsplätzen, Web- und Mobile-Clients. Für AI-Lawyer heißt das: Die heutige Browser-Architektur ist der falsche Weg.
3. **AI-Lawyer hat bisher keine funktionierende beA-Anbindung.** `src/lib/bea/client.ts` wurde gegen eine *angenommene* bea.expert-Browserbibliothek geschrieben (`window.beaExpert`, Importe auskommentiert). UI, Routen, Prisma-Modell, Auto-Zuordnung und Versand-Gate existieren und sind wiederverwendbar.
4. **Empfehlung:** Eine serverseitige Provider-Schnittstelle (`BeaProvider`), deren Zuschnitt sich an j-lawyers `BeaServiceRemote` orientiert. Erste Implementierung über die **bea.expert-REST-API**, mit Login-Krypto in Node (`node:crypto` bzw. `node-forge`). Das ist die einzige Variante ohne Java-Sidecar, ohne BRAK-Herstellerregistrierung und ohne fremde Produktidentität. beAstie bleibt eine Option, aber nur mit ausdrücklicher Erlaubnis von j-lawyer.

---

## 2. So hat j-lawyer es gebaut

### 2.1 Architektur

```
j-lawyer Client (Swing) / Web / MCP
        │  EJB Remote bzw. REST /rest/v8/bea/**
        ▼
j-lawyer Server: BeaService (EJB, @RolesAllowed loginRole)
        │  HTTP JSON, Bearer-Token, Header X-Client-Id
        ▼
beAstie (Spring Boot, Docker jlawyerorg/beastie, :7080)
        │  j-lawyer-bea-wrapper.jar → BRAK KSW-Toolkit / OSCI
        ▼
beA-Server der BRAK
```

Relevante Dateien (im Repo `j-lawyer-org`):

| Datei | Inhalt |
|---|---|
| `j-lawyer-server/j-lawyer-server-ejb/.../services/BeaService.java` (1909 Z.) | gesamte Server-Logik, alle beAstie-Aufrufe |
| `.../services/BeaSessionRegistry.java` | Singleton: Principal → beAstie-Token |
| `j-lawyer-server-api/.../services/BeaServiceRemote.java` | fachliche Schnittstelle (gut kommentiert) |
| `j-lawyer-server-api/.../services/bea/rest/*.java` | 27 DTOs (Postbox, Folder, Message, Attachment, Identity, eEB …) |
| `j-lawyer-server/j-lawyer-io/.../rest/v8/BeaEndpointV8.java` | öffentliche REST-API `/rest/v8/bea/**` |
| `openspec/changes/archive/2026-02-23-add-server-side-bea-via-beastie/` | Proposal, Design, Specs der Server-Umstellung |
| `openspec/specs/bea-rest-api/spec.md` | Export als `.bea`-Datei, Aktenvorschläge |
| `j-lawyer-client/.../client/bea/*` | UI: Posteingang, Versanddialog, eEB-Dialoge, Prüfung |
| `j-lawyer-proprietary/libs/j-lawyer-bea-wrapper.jar` | geschlossenes JAR (nur noch in beAstie relevant) |
| Doku: `docs/benutzerhandbuch/addon-bea.md`, `installation.md#bea` | Benutzerhandbuch, Inbetriebnahme |

### 2.2 Inhalt des Wrapper-JARs (aus dem Manifest)

- BRAK-Bibliotheken: `KSWToolkit-3.28.5.0`, `BeaToolkit-4.3.3.0`, `bea-osci-1.20.0`, `osci-bibliothek-2.4.0`, `bea-xjustiz-1.18.1`, `BeaPayload`, `SignerToolBox`, `PCard`, `mcard`, `ecard`, `bea-ksw-validation-dto`, `cs-rest-dto`, `config_schulung.jar`
- Signaturprüfung: EU-DSS 6.3 (CAdES, PAdES, XAdES), BouncyCastle 1.81
- Klassen: `BeaWrapper`, `BeaWrapperSession`, `KSWCommunicatorImplAtos`, `XJustizUtil240/321/331/341/351/362`, Modellklassen
- `certificates/`: `keystore.jks.PROD`, `keystore.jks.SPT`, `truststore.jks`, Test-Softwarezertifikate. **Das ist j-lawyers registrierte Produktidentität gegenüber der KSW.**
- XJustiz-Templates und XSDs für die Versionen 2.4.0, 3.2.1, 3.3.1, 3.4.1, 3.5.1 und 3.6.2

### 2.3 Authentifizierung und Sitzungen

- **beA-Softwarezertifikat** (`.p12` der BNotK, 4,90 €/Jahr) plus Passwort **pro Benutzer**, hochgeladen vom Admin in der Benutzerverwaltung. Gespeichert in `AppUserBean.beaCertificate` (Bytes) und `beaCertificatePassword` (mit `Crypto.encrypt` verschlüsselt). Benutzer sehen weder Zertifikat noch Passwort.
- `login()` ohne Parameter: Der Server löst den Benutzer über den Principal auf, entschlüsselt das Passwort und schickt `{certificate: base64, password}` an `POST /api/v1/auth/login`. Er erhält `token` und `postboxes`.
- `BeaSessionRegistry` hält das Token pro Benutzer. beAstie-Sitzungen laufen nach **9 Minuten** ab. Bei **HTTP 401** meldet sich der Server automatisch neu an und wiederholt den Aufruf einmal.
- Timeouts je Operation: 15 s (Version), 30 s (Listen), bis **300 s** (Senden, Entwurf).
- `X-Client-Id: <installationType>-<installationId>`. beAstie hat eine `allowed-clients`-Liste. Der Container prüft also, wer ihn aufruft.

### 2.4 Funktionsumfang (Vorlage für unsere Schnittstelle)

beAstie-Pfade unter `/api/v1/…`, j-lawyer-REST unter `/rest/v8/bea/…`:

- **Auth:** login, logout, version, certificate-info (Seriennummer und Gültigkeit beim Upload anzeigen)
- **Postfächer:** list, get, `outbox/empty`, `egvp` (Prüfung, ob der Empfänger ein EGVP-Postfach ist)
- **Ordner:** list, get, create, delete
- **Nachrichten:** list headers, search (Filter), messageIds, get (mit/ohne Anhänge), header, attachment (binär/base64), send, draft, delete, restore, move, read-Status abfragen, journal, processcards (Laufzettel), verify (Signaturprüfung), validate, **export als `.bea`**
- **Verzeichnis:** identity by safeId (+PLZ), identity search, legal-authorities (Kammern/Gerichte als Absenderbehörde), default legal authority, message-priorities
- **eEB:** isEebRequest/isEebResponse (XJustiz), request/response attributes, render-html, rejection-reasons, **confirm** (Abgabedatum), **reject** (Code + Kommentar)
- **Aktenvorschläge:** `POST /case-suggestions` mit Betreff, Text, beiden Aktenzeichen und Absender. Liefert `suggestedCases` (Quelle `subjectBody`, `reference` oder `sender`, zugriffsgefiltert, ohne Dubletten), Kontakte und Telefonnummern.

### 2.5 Fachliche Regeln aus Code und Doku (übernehmen)

- **Versand:** Anhänge als *Schriftsatz* oder *Anlage* markiert (schließen sich gegenseitig aus), automatischer Alias `01_Schriftsatz_Dateiname.pdf` mit optionalem Aktenzeichen von Absender und Empfänger, Reihenfolge änderbar. Limits: **höchstens 1000 Anhänge und 200 MB**, Warnung ab 50 Anhängen oder 60 MB.
- Absenderbehörde (Kammer/Gericht) wird vor jedem Versand abgefragt. Weitere Felder: Priorität, Nachrichtentyp (*Allgemeine Nachricht*, *Mahnantrag*, *Testnachricht*), vertraulich.
- **eEB anfordern nur mit mindestens einem Anhang.** Betreff ist Pflicht, mindestens ein Empfänger.
- **Zeichensatzprüfung:** beAstie lehnt Zeichen außerhalb von XÖV *String.Latin* ab und liefert `violations[]` (field, character, codePoint, unicodeName, position, line, context). j-lawyer zeigt diese verständlich an (`BeaCharacterViolationFormatter`). Wir sollten **vor** dem Versand selbst prüfen.
- **Nach dem Versand:** Nachricht als Dokument zur Akte (Standard: an), optional Etikett und Frist/Wiedervorlage.
- **Übermittlungsstatus** aus Journal und Laufzettel: Grün = gutes Journal (bei EGVP zusätzlich guter Laufzettel); Orange = gutes Journal, Laufzettel fehlt (EGVP); Rot = schlechtes Journal oder schlechter Laufzettel. Laufzettel stehen meist nur in der zur Akte gespeicherten gesendeten Nachricht.
- **eEB abgeben:** Datum frühestens zwei Monate zurück, spätestens heute, Zeitzone Europe/Berlin. Zurückweisen mit Grund aus Codeliste und optionaler Erläuterung. Möglich überall, wo die Nachricht angezeigt wird, auch aus der Akte heraus. **Voraussetzung:** Die Nachricht liegt noch im beA-Postfach; die Aktenkopie genügt nicht. Die eEB-Antwort landet in derselben Akte.
- **Ablage:** komplette Nachricht als `.bea`-Datei (XML inkl. Anhänge) in die Akte. Dateiname aus Aktenzeichen, Betreff, Absender und Empfänger.
- **Grenzen der KSW:** Der Gelesen-Status lässt sich über die Schnittstelle **nicht setzen**. Abrufen per KSW gilt nicht als gelesen.
- Weitere Funktionen: Gerichtsadressen aus dem beA-Verzeichnis importieren, SAFE-ID in Kontakte übernehmen, Zähler für ungelesene Nachrichten mit periodischem Abruf (`BeaCheckTimerTask`).
- **Haftungshinweis** in der Doku: Nutzung auf eigenes Risiko, Versand und Empfang über die beA-Weboberfläche kontrollieren.

### 2.6 Betrieb

- Auf der j-lawyer.BOX richtet die Management Console in drei Schritten Docker, Berechtigungen und beAstie ein. Dabei lädt sie einen **beAstie-Keystore separat herunter**, setzt den Container mit täglichem Neustart um Mitternacht auf und trägt den Endpunkt `http://localhost:7080` ein.
- Image: öffentlich auf Docker Hub, Tags `latest`, `prod`, `YYYYMMDD`, rund 450 MB, letztes Update am 09.11.2026, über 5.000 Pulls. **Quellcode nicht öffentlich, Lizenz nicht angegeben.**

---

## 3. Ist-Stand in AI-Lawyer

| Bereich | Datei | Bewertung |
|---|---|---|
| Client | `src/lib/bea/client.ts` (530 Z.) | **nicht funktionsfähig**: lädt eine fiktive Bibliothek `window.beaExpert`, API-Signaturen sind geraten |
| Sitzung | `src/lib/bea/session.tsx` | Browser-Kontext, Software-Token per Datei-Upload und PIN, 30 min Leerlauf. Wird bei serverseitiger Lösung ersetzt |
| Versandvertrag | `src/lib/bea/versand.ts`, `src/lib/versand-gate.ts` | gut: GESENDET nur mit beA-Nachrichten-ID, eEB nur nach Bestätigung. Behalten |
| Zuordnung | `src/lib/bea/auto-assign.ts`, `zuordnung.ts`, `/api/bea/auto-assign` | behalten, mit j-lawyers Heuristik (§ 2.4) abgleichen |
| API-Routen | `src/app/api/bea/messages/**` | speichern nur in der Datenbank. Brauchen künftig serverseitige beA-Aufrufe |
| UI | `src/components/bea/*` (Posteingang, Compose, Detail, eEB, XJustiz-Viewer, Prüfprotokoll) | wiederverwendbar, Datenquelle umstellen |
| Datenbank | `prisma/schema.prisma` `BeaNachricht`, `Kontakt.beaSafeId`, `User.beaId` | erweitern (siehe § 5.3) |
| Einstellungen | `src/lib/settings/defaults.ts` `bea.api_url = https://api.bea.expert` | passt zu Option B |
| Historie | Commits `7d9967a`, `ec1aca4` (Phase 06-04), `fb2b40e` („ehrlicher beA-Versand“) | — |

---

## 4. Optionen

| | A: beAstie als Sidecar | B: bea.expert-API (empfohlen) | C: eigene BRAK-KSW-Anbindung | D: Brücke über j-lawyer `/rest/v8/bea` |
|---|---|---|---|---|
| Technik | REST, Vertrag vollständig aus `BeaService.java` ablesbar | REST (Form-POST, `j=base64(json)`), Login-Krypto in Node | Java-Sidecar mit KSW-Toolkit, OSCI, XJustiz | vorhandener `src/lib/jlawyer/client.ts` + v8-Endpunkte |
| Aufwand | gering | mittel | sehr hoch (Monate) | gering |
| Kosten | keine bekannt | 7–10 €/Monat je Anwaltspostfach, 70 €/Monat je Kanzleipostfach (Jahresabo) | Registrierung und Zertifizierung bei der BRAK | keine |
| Rechtlich/vertraglich | **kritisch**: geschlossenes Image, j-lawyers Produkt-Keystore, `allowed-clients`-Prüfung. Ohne Zustimmung von j-lawyer nicht vertretbar, für ein Produkt an Dritte erst recht nicht | sauber (Vertrag mit Anbieter). Achtung: `bea-api-javascript` ist **GPL-2.0**, also nicht kopieren, sondern nach Protokoll neu schreiben; `n8n-nodes-bea-expert` ist **MIT** | sauber, aber Herstellerpflichten | sauber, setzt aber eine j-lawyer-Installation mit beAstie voraus |
| Eignung als Produkt | nein (ohne Vertrag) | ja | ja, langfristig | nein (Abhängigkeit von j-lawyer) |
| Eignung intern (Kanzlei Baumfalk) | ja, mit Erlaubnis | ja | übertrieben | **ja, sofort** |

**Hinweis:** Patrick arbeitet aktiv an j-lawyer mit (Upstream-Strategie). Eine Anfrage an die j-lawyer-Maintainer, ob beAstie von Dritten genutzt werden darf, ist deshalb realistisch. Sie ist aber eine Entscheidung für Patrick, nicht für die Umsetzungs-Session.

### Karte oder Softwarezertifikat bei bea.expert (geprüft am 19.11.2026)

- **Die REST-API kennt nur das Softwarezertifikat.** Alle öffentlichen Clients (JavaScript, Python, PHP, C#, n8n) lesen beim Login ausschließlich eine `.p12`-Datei mit PIN. Die Website beschreibt den API-Login nur mit „Softwaretoken“. Für eine Anmeldung mit Karte gibt es keinen Hinweis.
- **Karten gibt es bei bea.expert nur in der SIGNER-API**, und zwar für die qualifizierte elektronische Signatur, nicht für die Anmeldung. Dafür ist eine lokale Komponente (EXE, Socket `127.0.0.1:8425`) am Arbeitsplatz mit Kartenleser nötig. Unterstützt werden alte und neue beA-Karten, BNotK-Karten (auch Fernsignatur) und D-TRUST Card 4.1.
- **Entscheidung (Patrick):** AI-Lawyer bindet beA nur mit Softwarezertifikat an.
- Die Python-Bibliothek zeigt eine neuere Login-Variante, bei der `.p12` und PIN an bea.expert geschickt werden (`p12_certificate_file`, `p12_certificate_pass`, `allow_endless_sessions`). Diese Variante nutzen wir nicht: Zertifikat und PIN bleiben auf dem eigenen Server.

### Wie das bea.expert-Protokoll funktioniert (aus `bea-api-javascript`, nur zum Verständnis, nicht kopieren)

- Alle Aufrufe gehen als `POST /<funktion>` mit `Content-Type: application/x-www-form-urlencoded`, Body `j=<base64(JSON)>`.
- **Login in drei Schritten:**
  1. `.p12` lokal öffnen (Schlüssel und Zertifikat, SHA-1-Thumbprint), dann `bex_login_step1` → Challenge(s).
  2. Challenge mit dem privaten Schlüssel signieren (CMS/PKCS#7) → `bex_login_step2` → `sessionKey` und `validationKey`, beide **RSA-OAEP-SHA256**-verschlüsselt. Lokal entschlüsseln; dazu kommen `safeId` und `tokenValidation`.
  3. `bex_login_step3` mit `tokenValidation` und `validationKey` → `token`.
- **Danach** ist die API zustandslos: Jeder Aufruf schickt das `token`. Metadaten und Anhänge kommen **AES-256-GCM-verschlüsselt** (`value`, `iv`, `tag`) und werden lokal mit dem `sessionKey` entschlüsselt. Beim Versand: `bea_init_message` liefert einen Nachrichtenschlüssel, lokal mit AES-GCM verschlüsseln, dann `bea_save_message` und `bea_send_message`. Der Software-Token verlässt nie die eigene Software.
- Weitere Funktionen: `bea_get_postboxes`, `bea_get_folderstructure`, `bea_get_folderoverview`, `bea_get_message`, `bea_add_folder`/`remove_folder`, `bea_move_messagetofolder`/`totrash`, `bea_restore_messagefromtrash`, `bea_delete_message`, `bea_init_message(_draft)`, `bea_save_message`, `bea_send_message(_validation)`, `bea_get_identitydata`, `bea_get_username`, `bea_get_messageconfig`, `bea_get_addressbook` (+add/delete), `bea_search`, eEB-Beispiele `send_eeb_request/accept/reject_message`, `send_xjustiz_message`, `send_mahn_antrag_message`, außerdem die Akteneinsicht-API.
- Der n8n-Node lagert den Login in einen PHP-Proxy aus, weil die n8n-Sandbox kein OpenSSL hat. **In Next.js/Node ist das unnötig**: `node:crypto` kann RSA-OAEP-SHA256 und AES-256-GCM, `node-forge` (Abhängigkeit ist im Bundle der JS-Bibliothek ohnehin enthalten) kann PKCS#12 und PKCS#7. Zu prüfen ist, ob es bereits ein passendes Paket gibt; sonst eine neue Abhängigkeit.
- Quellen: `https://gitlab.com/beaexpert/bea-api-javascript`, `…/n8n-nodes-bea-expert` (`nodes/BeaExpert/BeaExpert.node.ts`, `proxy/login_proxy.php`), `…/bea-api-python`, `…/bea-api-python-examples`, `…/akteneinsicht-api`. Für die volle API-Dokumentation ist ein Vertrag mit bea.expert nötig.

---

## 5. Empfohlener Zielentwurf für AI-Lawyer

### 5.1 Grundsätze (von j-lawyer übernommen)

1. **Alles serverseitig.** Der Browser kennt weder Zertifikat noch Sitzungsschlüssel. `session.tsx` und die Browser-Funktionen in `client.ts` entfallen.
2. **Software-Zertifikat pro Benutzer**, vom Admin hochgeladen, verschlüsselt gespeichert. Gleiches Muster wie bei den j-lawyer-Zugangsdaten (`src/lib/jlawyer/credentials.ts`, `EMAIL_ENCRYPTION_KEY`). Beim Upload Zertifikatsdaten (Seriennummer, Gültigkeit, Inhaber) anzeigen; Ablaufwarnung.
3. **Sitzungsregister** pro Benutzer, in Redis mit TTL (nicht im Prozessspeicher, weil Next.js und Worker getrennte Prozesse sind). Sitzungsschlüssel in Redis verschlüsselt ablegen. Bei Ablauf oder 401: einmal neu anmelden und wiederholen.
4. **Provider-Schnittstelle** `BeaProvider` in `src/lib/bea/provider/`, mit Methoden nach dem Zuschnitt von `BeaServiceRemote` (§ 2.4). Implementierungen: `bea-expert.ts` (Ziel), `jlawyer-bridge.ts` (optional, intern), `mock.ts` (Tests und Entwicklung).
5. **Menschliche Freigabe** bleibt Pflicht: Helena oder Agenten dürfen nur Entwürfe anlegen. Versand und eEB nur per ausdrücklicher Benutzeraktion (vorhandenes `versand-gate.ts` und BRAK-2025-Gate beibehalten).

### 5.2 Ablauf

- **Abruf:** BullMQ-Job `bea-sync` (z. B. alle 5 Minuten je Postfach mit hinterlegtem Zertifikat). Er lädt neue Nachrichten, entschlüsselt sie, speichert die vollständige Nachricht als `.bea`/XML und die Anhänge in MinIO, legt `BeaNachricht` an, ruft Auto-Zuordnung und OCR/Embedding auf und benachrichtigt per Socket.IO. **Frage:** Wenn kein Benutzer angemeldet ist, braucht der Job hinterlegtes Zertifikat und Passwort (wie bei j-lawyer). Siehe offene Entscheidungen.
- **Versand:** Compose → Server-Route → Zeichensatz-, Limit- und eEB-Prüfung → `provider.saveDraft` bzw. `provider.send` → Journal und Laufzettel nachladen → Status grün, orange oder rot → Ablage in der Akte, optional mit Frist.
- **eEB:** Erkennung aus dem XJustiz-Anhang (Parser existiert), Abgeben oder Zurückweisen über den Server mit den Datumsregeln aus § 2.5.

### 5.3 Schemaänderungen (Vorschlag)

- `BeaZertifikat` (userId, p12 verschlüsselt, Passwort verschlüsselt, Seriennummer, gültigBis, safeIds[])
- `BeaPostfach` (safeId, Name, Typ, Kanzlei, zugeordnete Benutzer)
- `BeaNachricht` erweitern: `postfachSafeId`, `ordnerId`, `richtung`, `journal Json`, `laufzettel Json`, `zustellStatus` (GRUEN/ORANGE/ROT), `exportDokumentId`, `eebAngefordert`, `eebAntwortNachrichtId`, Absender- und Empfänger-Aktenzeichen, `nachrichtenTyp`, `prioritaet`, `vertraulich`

### 5.4 Abnahmekriterien für die Umsetzungs-Session

- Login mit echtem Softwarezertifikat gegen die bea.expert-Testumgebung, falls vorhanden, sonst mit einem Testpostfach. **Nie ohne Freigabe gegen ein Produktivpostfach senden.**
- Posteingang listen, Nachricht öffnen und entschlüsseln, Anhang herunterladen, Ablage in der Akte
- Testnachricht (Nachrichtentyp „Testnachricht“) an das eigene Postfach senden, Journalstatus prüfen
- eEB-Rundlauf mit zwei Testpostfächern
- Unit-Tests: Krypto mit festen Testvektoren (AES-GCM, RSA-OAEP), Zeichensatzprüfung, Limits, eEB-Datumsregel, Zuordnungsheuristik
- Audit-Log-Einträge für Login, Abruf, Versand und eEB (Aktionen existieren teilweise in `src/lib/audit.ts`)

---

## 6. Offene Entscheidungen für Patrick

1. **Anbieter:** bea.expert (Kosten je Postfach, Vertrag) oder zuerst eine j-lawyer-Brücke für die eigene Kanzlei, oder Anfrage bei j-lawyer zur beAstie-Nutzung?
2. **Hintergrundabruf:** Darf der Server Zertifikat und Passwort dauerhaft speichern (wie j-lawyer), um ohne angemeldeten Benutzer abzurufen? Alternative: Abruf nur während einer aktiven Sitzung.
3. **Umfang v1:** nur Empfang, Zuordnung und eEB, oder sofort auch Versand?
4. **Bestehende Phase-06-04-Codebasis:** UI und Routen umbauen (Empfehlung) oder neu aufsetzen?

---

## 7. Recherche nachvollziehen

```bash
git clone --depth 1 https://github.com/jlawyerorg/j-lawyer-org.git
git clone --depth 1 https://github.com/jlawyerorg/j-lawyer-documentation.git
git clone --depth 1 https://gitlab.com/beaexpert/bea-api-javascript.git   # GPL-2.0, nur lesen
git clone --depth 1 https://gitlab.com/beaexpert/n8n-nodes-bea-expert.git # MIT
unzip -p j-lawyer-org/j-lawyer-proprietary/libs/j-lawyer-bea-wrapper.jar META-INF/MANIFEST.MF
```

Weitere Quellen: https://bea.expert/api/ (Preise, Prinzip), https://hub.docker.com/r/jlawyerorg/beastie, https://portal.beasupport.de (BRAK-Support), Bezug des Softwarezertifikats: https://zertifizierungsstelle.bnotk.de/bestellen/beaprodukte/bea-produkte-softwarezertifikat
