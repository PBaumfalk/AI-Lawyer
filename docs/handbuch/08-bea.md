# 8 — beA

Das besondere elektronische Anwaltspostfach (beA) ist in AI-Lawyer als Bereich **beA** angelegt: automatischer Abruf, Zuordnung zu Akten, Versand und Empfangsbekenntnis (eEB). Die Anbindung läuft **serverseitig** über den Dienst **bea.expert**. Ihr Zertifikat und Ihre PIN verlassen den eigenen AI-Lawyer-Server nicht: Signatur und Entschlüsselung geschehen dort, bea.expert vermittelt nur den Zugang zum beA-System.

Prüfen Sie bei Fristsachen weiterhin die Eingangs- und Versandbestätigung im beA-Webclient. Fristen berechnet und prüft immer ein Mensch ([Kapitel 6](06-fristen-und-kalender.md)).

## Voraussetzungen

| Voraussetzung | Stand |
| --- | --- |
| Vertrag mit bea.expert | Kommerziell. Der Ident aus dem Vertrag wird von der IT hinterlegt ([Betrieb](#für-die-administration-betrieb)). Ohne Ident zeigt der beA-Bereich *„beA ist nicht eingerichtet“*. |
| Softwarezertifikat | Ein beA-Softwarezertifikat als Datei (`.p12` oder `.pfx`) und die zugehörige PIN. Das Zertifikat wird bei der Bundesnotarkammer bestellt. **Anmeldung mit beA-Karte und Kartenleser ist nicht möglich**, die bea.expert-Schnittstelle kennt sie nicht. |
| SAFE-IDs der Empfänger | Für den Versand. Am bequemsten im Kontakt im Feld **beA Safe-ID** hinterlegt ([Kapitel 4](04-kontakte.md)). |

## Zertifikat hinterlegen (Administration)

1. **Benutzerverwaltung** öffnen und beim betreffenden Benutzer **beA-Zertifikat** wählen.
2. Die `.p12`- oder `.pfx`-Datei und die **PIN** angeben, **speichern**.
3. AI-Lawyer prüft die Anmeldung. Bei Erfolg ist der Status **Aktiv**.

Zertifikat und PIN werden verschlüsselt gespeichert und nie im Browser angezeigt. Ein neues Zertifikat (z. B. nach Ablauf) laden Sie im selben Dialog hoch. Bei falscher PIN oder abgelaufenem Zertifikat setzt AI-Lawyer den Status auf **Fehler**, nennt den Grund und versucht es **erst nach einem neuen Upload** wieder. Es gibt keinen Anmeldeversuch alle fünf Minuten.

## Wer darf was?

| Aktion | Rollen |
| --- | --- |
| beA-Bereich öffnen, Nachrichten lesen und Akten zuordnen | Kanzleirollen mit dem Recht *beA lesen*; Nachrichten sind nach Aktenzugriff gefiltert |
| Zertifikat hinterlegen | Administration |
| Senden, Entwurf speichern, eEB abgeben | nur mit dem Recht zum beA-Versand, ausschließlich durch eine ausdrückliche Handlung des Benutzers |

Helena und andere Agenten dürfen nichts senden und kein eEB abgeben.

## Abruf

AI-Lawyer ruft den Posteingang **automatisch alle 5 Minuten** im Hintergrund ab. Mit **Jetzt abrufen** im Posteingang starten Sie den Abruf sofort. Neue Nachrichten samt Text und Anhängen werden gespeichert; Anhänge einer noch nicht zugeordneten Nachricht liegen sicher im Dokumentenspeicher und werden bei späterer Zuordnung als Dokumente in die Akte übernommen. Dieselbe Nachricht wird nie doppelt angelegt, auch nicht bei mehreren Benutzern mit Zugriff auf dasselbe Postfach.

**Lesestatus:** Der Abruf über AI-Lawyer gilt im beA nicht als gelesen.

Statushinweise erscheinen als Banner oben im beA-Bereich: *„beA ist nicht eingerichtet“* (kein Ident), *„Kein beA-Zertifikat hinterlegt – bitte an die Administration wenden“*, *„beA-Anmeldung fehlgeschlagen“* (mit Grund, etwa falsche PIN oder abgelaufenes Zertifikat).

## Posteingang und Postausgang

Die Reiter **Posteingang** und **Postausgang** zeigen Status, Betreff, Absender bzw. Empfänger, Akte und Datum. Der Postausgang wird serverseitig gefiltert. Ein Klick öffnet die Nachrichtenansicht mit Text, Anhängen, Prüfprotokoll und Absender/Empfänger. Die Detailseite prüft den Zugriff auf die zugeordnete Akte.

## Zuordnung zur Akte

### Automatisch

AI-Lawyer sucht eine passende Akte, in dieser Reihenfolge:

1. **Internes Aktenzeichen** (Form `00123/26`) in Betreff oder Text. Genau ein Treffer gilt als *sicher*.
2. **SAFE-ID des Absenders** gehört zu einem Kontakt einer nicht geschlossenen Akte: *wahrscheinlich*.
3. **Gerichtsaktenzeichen** (z. B. `3 Ca 567/25`) stimmt mit den Falldaten einer nicht geschlossenen Akte überein: *wahrscheinlich*.

Nur ein *sicherer* Treffer ordnet automatisch zu. Ein *wahrscheinlicher* Treffer bleibt ein Vorschlag, die Nachricht bleibt **Nicht zugeordnet**, bis jemand bestätigt. Prüfen Sie auch automatisch zugeordnete Nachrichten: Eine falsche Zuordnung kann eine Frist in die falsche Akte bringen.

### Von Hand

Bei einer nicht zugeordneten Nachricht **Zuordnen** klicken, dann **Automatische Zuordnung versuchen** oder eine Akte suchen und wählen. Dafür brauchen Sie Zugriff auf die Akte. **Sobald zu der Nachricht Dokumente in der Akte liegen, ist eine Umzuordnung gesperrt**, damit Dokumente nicht in der falschen Akte bleiben.

AI-Lawyer legt für eine Nachricht kein Ticket an und trägt keine Frist ein. Das bleibt Handarbeit ([Kapitel 7](07-email-und-tickets.md#tickets)).

## Nachricht senden

1. Im beA-Bereich **Neue Nachricht** wählen.
2. Empfänger aus den Kontakten oder per **SAFE-ID** (Form `DE.BRAK....`) angeben.
3. **Betreff** und **Text** ausfüllen, optional **Nachrichtentyp** wählen und **Empfangsbekenntnis (eEB) anfordern**.
4. Dokumente aus der Akte anhängen. Jedes Dokument ist **Schriftsatz** oder **Anlage**. Entwürfe und nicht freigegebene Dokumente lassen sich nicht anhängen; geben Sie ein Dokument nur nach Prüfung frei.
5. **Senden**, oder **Als Entwurf im beA speichern** (dann bearbeiten Sie die Nachricht im beA-Webclient weiter).

Vor dem Senden prüft AI-Lawyer:

- **Zeichenprüfung:** beA erlaubt nur einen begrenzten Zeichensatz in Betreff, Text und Dateinamen. Unzulässige Zeichen werden gemeldet; **Typografische Zeichen ersetzen** wandelt z. B. typografische Anführungszeichen und Gedankenstriche um. Umlaute, „ß“ und „€“ bleiben erhalten.
- **Grenzen:** höchstens **1000 Anhänge** und **200 MB** insgesamt. Warnungen erscheinen bei mehr als **50 MB** je Nachricht bzw. **60 MB** insgesamt. Warnungen müssen Sie bestätigen, Überschreitungen der Grenzen verhindern den Versand.
- **Zugriff:** auf die Akte und alle Anhänge.

Nach dem Versand bestätigt AI-Lawyer erst, wenn beA eine Nachrichten-ID liefert. Die angehängten Dokumente erhalten den Status **Versendet**.

**Versandstatus unklar:** Kommt auf das Senden keine Antwort (Zeitüberschreitung, Verbindungsabbruch), sendet AI-Lawyer **nie automatisch erneut**. Die Nachricht wird als **Fehler** mit dem Hinweis *„Versandstatus unklar – bitte im beA-Webclient prüfen“* gespeichert. Prüfen Sie im Ordner „Gesendet“ des beA-Webclients, ob sie hinausging, und senden Sie nur dann neu, wenn nicht.

## Empfangsbekenntnis (eEB) abgeben

Fordert ein Gericht ein eEB an, zeigt die Nachrichtenansicht den Bereich zur Abgabe. Das **Abgabedatum** darf nicht in der Zukunft liegen und höchstens **zwei Monate** zurückreichen. Die Abgabe ist gegen Doppelabgabe gesperrt.

Bleibt unklar, ob beA die Abgabe angenommen hat, erscheint *„Abgabe unklar – bitte im beA-Webclient prüfen“* (in der Liste als Hinweis **eEB-Abgabe unklar**). Prüfen Sie dann im beA-Webclient, bevor Sie es erneut versuchen. Das Datum des eEB ist für den Fristbeginn maßgeblich.

## Was es nicht gibt

- keine Anmeldung mit beA-Karte (nur Softwarezertifikat),
- kein Senden durch Helena oder andere Agenten,
- keine Änderung des Lesestatus im beA durch den Abruf.

## Wenn etwas nicht klappt

| Meldung | Was tun |
| --- | --- |
| *beA ist nicht eingerichtet* | IT: `BEA_EXPERT_IDENT` setzen ([Betrieb](#für-die-administration-betrieb)). |
| *Kein beA-Zertifikat hinterlegt …* | Administration: Zertifikat hinterlegen. |
| *beA-Anmeldung fehlgeschlagen* | PIN und Ablaufdatum prüfen, Zertifikat neu hochladen. Bis dahin ruft AI-Lawyer nicht erneut ab. |
| *Versandstatus unklar – bitte im beA-Webclient prüfen* | Im beA-Webclient nachsehen, ob die Nachricht hinausging. |
| *Abgabe unklar – bitte im beA-Webclient prüfen* | Im beA-Webclient prüfen, ob das eEB abgegeben ist. |
| Zuordnung ändern nicht möglich | Zur Nachricht gibt es bereits Dokumente in der Akte. |

## Für die Administration (Betrieb)

| Einstellung | Bedeutung |
| --- | --- |
| `BEA_EXPERT_IDENT` | Ident aus dem bea.expert-Vertrag. Pflicht für den echten Betrieb; ohne Ident ist beA in Produktion deaktiviert. |
| `BEA_PROVIDER` | `expert` (echte Anbindung, Standard bei gesetztem Ident) oder `mock` (Testdaten, nur außerhalb von Produktion). |
| Einstellung `bea.api_url` | API-Adresse, Standard `https://api.bea.expert`. |

Die Umgebungsvariablen stehen in der `.env` ([Kapitel 20](20-konfiguration.md)). Die Anbindung setzt einen bestehenden **bea.expert-Vertrag** voraus. Die TLS-Prüfung bleibt immer eingeschaltet. Zertifikat, PIN und Sitzungsschlüssel werden nie protokolliert.

Vor dem Echtbetrieb lässt sich die Verbindung mit `scripts/bea-smoke.ts` prüfen (nur `TESTNACHRICHT` an das eigene Postfach, siehe Kopfkommentar des Skripts).

---

Weiter: [9 — Helena](09-helena.md) · [Zur Übersicht](README.md)
