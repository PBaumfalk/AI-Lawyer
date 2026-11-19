# beA-Anbindung über bea.expert – Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI-Lawyer ruft beA-Nachrichten serverseitig über die bea.expert-REST-API ab, ordnet sie Akten zu, legt Anhänge ab, versendet Nachrichten und gibt eEBs ab. Kein Zertifikat und kein Sitzungsschlüssel gelangt in den Browser.

**Architecture:** Ein schlanker bea.expert-Client in `src/lib/bea/expert/` (Transport, Krypto, Login, Ver- und Entschlüsselung) implementiert eine fachliche Schnittstelle `BeaProvider` (`src/lib/bea/provider.ts`). Softwarezertifikat und PIN liegen pro Benutzer verschlüsselt in der Datenbank (Muster wie bei j-lawyer). Sitzungen liegen verschlüsselt in Redis. Ein BullMQ-Job ruft alle 5 Minuten ab. Versand und eEB laufen über Server-Routen. Die vorhandene browserseitige Fantasie-Anbindung (`src/lib/bea/client.ts`, `session.tsx`) wird entfernt.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Prisma/PostgreSQL, Redis + BullMQ, MinIO, vitest. Neu: `node-forge` (PKCS#12), `jsrsasign` (CMS-Signatur mit RSA-PSS), `node:crypto` (RSA-OAEP-SHA256, AES-GCM, AES-CBC).

**Spec:** `.planning/research/BEA-INTEGRATION.md` (Recherche, Protokoll, fachliche Regeln aus j-lawyer). Protokollreferenz: `https://gitlab.com/beaexpert/bea-api-javascript`, Datei `bea.expert_api.js`. **GPL-2.0: nur lesen, nichts kopieren.** Algorithmen nach der Beschreibung in diesem Plan neu schreiben.

## Vorbedingungen (Patrick, vor Beginn der Session)

- **V1** Vertrag mit bea.expert abschließen und den **`bex-ident`**-Wert erhalten.
- **V2** Eigene SAFE-ID(s) bei bea.expert freischalten lassen.
- **V3** Eigenes beA-Softwarezertifikat (`.p12`) und PIN bereithalten. Nur für den Smoke-Test in Task 13; nie ins Repo.
- **V4** Bei bea.expert die API-Dokumentation anfordern. Benötigt werden: Fehlerformat und Sitzungsdauer, Felder von `bea_get_folderstructure` und `bea_get_folderoverview`, Feld der Nachrichten-ID in der Antwort von `bea_send_message_validation`, Format von `eeb_date`, Feld für den Zurückweisungsgrund beim eEB.

Ohne V1 und V2 lassen sich Tasks 1–12 vollständig gegen Mocks bauen. Nur Task 13 braucht echten Zugang. Wo dieser Plan eine Annahme über V4-Inhalte trifft, ist sie als **Annahme** markiert, und der Smoke-Test prüft sie.

## Global Constraints

- Oberflächentexte auf Deutsch mit korrekten Umlauten; Code-Kommentare auf Englisch.
- Neue npm-Pakete nur: `node-forge`, `jsrsasign`, `@types/node-forge`, `@types/jsrsasign`.
- Umgebungsvariablen: `BEA_EXPERT_IDENT` (Pflicht für echten Betrieb), `BEA_PROVIDER` = `expert` | `mock`. Standard: `expert`, wenn `BEA_EXPERT_IDENT` gesetzt ist. Sonst `mock`, aber **nur** bei `NODE_ENV !== "production"`. In Produktion ohne Ident ist beA deaktiviert und die Oberfläche zeigt „beA ist nicht eingerichtet“.
- API-Basis-URL aus der vorhandenen Einstellung `bea.api_url` (Standard `https://api.bea.expert`).
- Anmeldung **nur mit beA-Softwarezertifikat**. Die bea.expert-REST-API kennt keine Kartenanmeldung (geprüft am 19.11.2026, siehe Spec § 4). Karten sind nicht Teil dieses Plans.
- Die Login-Optionen von bea.expert `p12_certificate_file`, `p12_certificate_pass` und `allow_endless_sessions` werden **nicht** genutzt: Zertifikat und PIN verlassen den eigenen Server nie. Signatur und Entschlüsselung laufen lokal (Tasks 2 und 3).
- TLS-Zertifikatsprüfung bleibt **an**. Der n8n-Node schaltet sie mit `rejectUnauthorized: false` ab; das nicht übernehmen.
- Zertifikat (`.p12`), PIN, `sessionKey` und `token` dürfen nie geloggt, nie an den Browser gegeben und nie im Audit-Log gespeichert werden.
- Versand und eEB nur nach ausdrücklicher Benutzeraktion mit `canSendBeA`. Helena und Agenten dürfen nicht senden.
- Automatische Wiederholung ist **nur für lesende Aufrufe** erlaubt, nie für `sende`, `speichereEntwurf` oder `gibEebAb`.
- Vor dem Merge ist `npm test` grün und `npx tsc --noEmit` fehlerfrei.
- Tests gegen das echte beA nur mit Nachrichtentyp `TESTNACHRICHT` an das eigene Postfach.

## Review Focus

1. **Doppelversand:** Wenn beim Senden ein Timeout auftritt oder die Antwort fehlt, wird nicht automatisch erneut gesendet. Die Nachricht wird als `FEHLER` mit Hinweis „Versandstatus unklar – bitte im beA-Webclient prüfen“ gespeichert. Test in Task 10.
2. **Doppelter Abruf:** Zwei parallele Sync-Jobs, oder zwei Benutzer mit Zugriff auf dasselbe Kanzleipostfach, legen dieselbe Nachricht nur einmal an (eindeutige `nachrichtenId`, P2002 wird abgefangen). Test in Task 9.
3. **Falsche PIN oder abgelaufenes Zertifikat:** Der Abruf setzt das Zertifikat auf `FEHLER`, speichert eine verständliche Meldung und versucht es erst nach neuem Upload wieder. Kein Anmeldeversuch alle 5 Minuten. Tests in Task 7 und Task 9.
4. **Umlaute und Sonderzeichen:** Betreff, Text und Dateinamen mit „Müller ß €“ kommen unverändert hin und zurück (UTF-8 vor Base64). Zeichen außerhalb des erlaubten Satzes werden vor dem Versand gemeldet. Tests in Tasks 1, 4, 5 und 10.
5. **Nachricht ohne Akte:** Anhänge einer nicht zugeordneten Nachricht liegen in MinIO. Bei späterer manueller Zuordnung entstehen die Akten-Dokumente nachträglich. Test in Task 9.

---

## Dateistruktur

| Datei | Verantwortung |
|---|---|
| `src/lib/bea/expert/transport.ts` | HTTP-Umschlag (`j=base64(json)`, Header `bex-ident`), Fehler → `BeaExpertError` |
| `src/lib/bea/expert/krypto.ts` | PKCS#12 lesen, CMS-Signatur, RSA-OAEP, AES-GCM/-CBC |
| `src/lib/bea/expert/login.ts` | dreistufiger Login → `BeaSitzung` |
| `src/lib/bea/expert/eingang.ts` | Ordner, Nachrichtenliste, Entschlüsselung einer Nachricht |
| `src/lib/bea/expert/ausgang.ts` | Verschlüsselung und Versand, Entwurf, eEB-Antwort |
| `src/lib/bea/expert/provider.ts` | `BeaExpertProvider implements BeaProvider` |
| `src/lib/bea/provider.ts` | Typen, `BeaProvider`, `getBeaProvider()` |
| `src/lib/bea/mock-provider.ts` | In-Memory-Provider für Tests und Entwicklung |
| `src/lib/bea/zertifikat.ts` | Zertifikat speichern, laden, Status setzen |
| `src/lib/bea/sitzung.ts` | Redis-Sitzungsspeicher, `mitBeaSitzung()` |
| `src/lib/bea/regeln.ts` | Zeichensatz, Limits, eEB-Regeln, eEB-Datum |
| `src/lib/bea/abruf.ts` | Abruf eines Zertifikats, Speicherung, Ablage, Zuordnung |
| `src/lib/queue/processors/bea-sync.processor.ts` | Job-Wrapper um `abruf.ts` |
| `src/lib/bea/client.ts`, `src/lib/bea/session.tsx` | **löschen** (Task 12) |

---

### Task 1: Abhängigkeiten und Transport

**Files:**
- Modify: `package.json` (Pakete laut Global Constraints)
- Create: `src/lib/bea/expert/transport.ts`
- Test: `src/lib/bea/expert/__tests__/transport.test.ts`

**Interfaces:**
- Produces:
  - `class BeaExpertError extends Error { funktion: string; status: number | null; antwort: unknown }`
  - `bexAufruf<T = unknown>(funktion: string, nutzlast: Record<string, unknown>, opts?: { timeoutMs?: number }): Promise<T>`, Standard-Timeout 60 000 ms
  - `getBeaExpertKonfig(): Promise<{ apiUrl: string; ident: string }>` (liest `bea.api_url` und `BEA_EXPERT_IDENT`; wirft `BeaExpertError`, wenn der Ident fehlt)

- [ ] **Step 1: Pakete installieren**

Run: `npm install node-forge jsrsasign && npm install -D @types/node-forge @types/jsrsasign`
Expected: `package.json` enthält die vier Pakete, sonst keine Änderungen.

- [ ] **Step 2: Failing Tests schreiben** (fetch mit `vi.stubGlobal("fetch", …)` mocken)

```ts
it("sendet POST an <apiUrl>/<funktion> mit form-urlencoded j=base64(utf8-json) und bex-ident", async () => {
  // nutzlast { betreff: "Müller ß €" }
  // erwartet: URL "https://api.bea.expert/bea_get_postboxes", method POST,
  // headers["Content-Type"] === "application/x-www-form-urlencoded", headers["bex-ident"] === "ident-1"
  // new URLSearchParams(body).get("j") → Buffer.from(…,"base64").toString("utf8") → JSON mit "Müller ß €"
});
it("liefert geparstes JSON zurück");
it("wirft BeaExpertError bei HTTP 500 mit status 500");
it("wirft BeaExpertError, wenn die Antwort ein nicht-leeres Feld error hat", /* { error: "invalid token" } */);
it("wirft BeaExpertError, wenn BEA_EXPERT_IDENT fehlt");
it("bricht nach timeoutMs ab");
```

- [ ] **Step 3: Tests laufen lassen, Fehlschlag prüfen**

Run: `npx vitest run src/lib/bea/expert/__tests__/transport.test.ts`
Expected: FAIL (Modul fehlt)

- [ ] **Step 4: `transport.ts` implementieren**

Base64 von `Buffer.from(JSON.stringify(nutzlast), "utf8")`. Body per `new URLSearchParams({ j })`. Timeout mit `AbortSignal.timeout`. Die Einstellung `bea.api_url` über den vorhandenen Settings-Zugriff lesen und einen abschließenden `/` entfernen.

- [ ] **Step 5: Tests laufen lassen**

Run: `npx vitest run src/lib/bea/expert/__tests__/transport.test.ts`
Expected: PASS

- [ ] **Step 6: Commit** — `feat(bea): bea.expert-Transport mit Fehlerbehandlung`

---

### Task 2: Krypto-Primitiven

**Files:**
- Create: `src/lib/bea/expert/krypto.ts`
- Create: `src/lib/bea/expert/__tests__/fixtures.ts` (Test-Zertifikat erzeugen)
- Test: `src/lib/bea/expert/__tests__/krypto.test.ts`

**Interfaces:**
- Produces:
  - `leseP12(p12: Buffer, pin: string): { privateKeyPem: string; zertifikatPem: string; thumbprintSha1Hex: string; seriennummer: string; inhaber: string; gueltigBis: Date }`. Wirft `Error("PIN falsch oder Datei ist kein beA-Softwarezertifikat")`.
  - `signiereChallenge(challenge: string, zertifikatPem: string, privateKeyPem: string): string`: CMS SignedData als Base64 ohne PEM-Kopf.
  - `rsaOaepEntschluesseln(chiffratB64: string, privateKeyPem: string): Buffer` (OAEP, SHA-256)
  - `aesGcmEntschluesseln(teil: { value: string; iv: string; tag: string }, schluessel: Buffer): Buffer` (alle Felder Base64)
  - `aesGcmVerschluesseln(klartext: Buffer, schluessel: Buffer): { data: string; iv: string; tag: string }`, **IV 16 Byte** (wie die Referenz)
  - `aesCbcEntschluesseln(chiffratB64: string, schluessel: Buffer, ivB64?: string): Buffer`. Ohne IV sind die ersten 16 Byte des Chiffrats der IV.
- Test-Hilfe: `erzeugeTestP12(pin: string): { p12: Buffer; privateKeyPem: string; zertifikatPem: string }` (RSA 2048, mit node-forge, einmal pro Testdatei erzeugen)

- [ ] **Step 1: Failing Tests schreiben**

```ts
it("leseP12 liefert Schlüssel, Zertifikat und SHA-1-Thumbprint über das DER-Zertifikat (40 Hex-Zeichen)");
it("leseP12 wirft bei falscher PIN die deutsche Fehlermeldung");
it("signiereChallenge erzeugt CMS SignedData mit RSASSA-PSS, SHA-512 und signingCertificateV2", () => {
  // Base64 → DER → ASN.1 (jsrsasign ASN1HEX oder forge.asn1) enthält die OIDs
  // 1.2.840.113549.1.1.10 (RSASSA-PSS), 2.16.840.1.101.3.4.2.3 (SHA-512),
  // 1.2.840.113549.1.9.16.2.47 (signingCertificateV2), 1.2.840.113549.1.9.5 (signingTime)
  // und den Challenge-Text als eContent
});
it("rsaOaepEntschluesseln entschlüsselt, was node:crypto publicEncrypt mit OAEP/SHA-256 verschlüsselt hat");
it("aesGcm: verschlüsseln → entschlüsseln ergibt den Klartext, IV ist 16 Byte");
it("aesGcmEntschluesseln wirft bei manipuliertem Tag");
it("aesCbcEntschluesseln mit vorangestelltem IV und mit separatem IV");
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen** — `npx vitest run src/lib/bea/expert/__tests__/krypto.test.ts` → FAIL

- [ ] **Step 3: `krypto.ts` implementieren**

PKCS#12 mit `node-forge` (`pkcs12FromAsn1`). Der Thumbprint ist SHA-1 über das DER des Zertifikats. CMS mit `jsrsasign` `KJUR.asn1.cms.SignedData`:
- `hashalgs: ["sha256","sha512"]`, eContent = Challenge-Text
- signierte Attribute: `contentType` (1.2.840.113549.1.7.1), `messageDigest` = SHA-512-Hex des Challenge-Texts, `signingCertificateV2` mit dem Zertifikat, `signingTime` als UTCTime `YYMMDDhhmmssZ`
- `sigalg: "SHA512withRSAandMGF1"`, `version: 1`, Signer-ID per Issuer und Seriennummer

OAEP und AES mit `node:crypto`.

- [ ] **Step 4: Tests laufen lassen** → PASS

- [ ] **Step 5: Commit** — `feat(bea): Krypto für bea.expert-Login und Nachrichten`

---

### Task 3: Login

**Files:**
- Create: `src/lib/bea/expert/login.ts`
- Test: `src/lib/bea/expert/__tests__/login.test.ts`

**Interfaces:**
- Consumes: `bexAufruf` (Task 1), `leseP12`, `signiereChallenge`, `rsaOaepEntschluesseln` (Task 2)
- Produces:
  - `interface BeaSitzung { token: string; sessionKey: Buffer; safeId: string }` (in `src/lib/bea/provider.ts` deklarieren und hier importieren; Task 6 ergänzt die übrigen Typen dort)
  - `anmelden(p12: Buffer, pin: string): Promise<BeaSitzung>`

Protokoll:
1. `bex_login_step1` mit `{ thumbprint, diagnose: false }` liefert `{ challengeVal, challengeValidation, tokenPAOS }`.
2. Beide Challenges signieren. Ist ein Wert **keine** UUID (36 Zeichen, `-` an den Positionen 8, 13, 18, 23), wird er vorher Base64-dekodiert.
3. `bex_login_step2` mit `{ tokenPAOS, userCert: base64(zertifikatPem), challengeSigned, validationSigned }` liefert `{ sessionKey, validationKey, safeId, tokenValidation }`. `sessionKey` und `validationKey` sind RSA-OAEP-verschlüsselt.
4. `bex_login_step3` mit `{ tokenValidation, validationKey: base64(entschlüsselter validationKey) }` liefert `{ token }`.

- [ ] **Step 1: Failing Tests schreiben** (fetch-Mock simuliert alle drei Schritte mit dem Test-Zertifikat aus Task 2)

```ts
it("führt step1–3 aus und liefert token, sessionKey (32 Byte) und safeId", async () => {
  // step1 → { challengeVal: "<uuid>", challengeValidation: "<uuid>", tokenPAOS: "paos-1" }
  // step2: Body enthält tokenPAOS "paos-1", userCert = base64(zertifikatPem), challengeSigned/validationSigned nicht leer
  //   → { sessionKey: OAEP(pub, 32 Zufallsbytes), validationKey: OAEP(pub, 16 Zufallsbytes), safeId: "DE.BRAK.test.1", tokenValidation: "tv-1" }
  // step3: Body validationKey === base64(16 Zufallsbytes) → { token: "tok-1" }
  // erwartet: { token: "tok-1", safeId: "DE.BRAK.test.1", sessionKey.equals(32 Zufallsbytes) }
});
it("dekodiert Base64-Challenges, die keine UUID sind, vor dem Signieren");
it("wirft BeaExpertError, wenn step2 einen error liefert");
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen** — `npx vitest run src/lib/bea/expert/__tests__/login.test.ts` → FAIL
- [ ] **Step 3: `login.ts` implementieren**
- [ ] **Step 4: Tests laufen lassen** → PASS
- [ ] **Step 5: Commit** — `feat(bea): dreistufiger bea.expert-Login`

---

### Task 4: Eingang – Ordner, Liste, Entschlüsselung

**Files:**
- Create: `src/lib/bea/expert/eingang.ts`
- Test: `src/lib/bea/expert/__tests__/eingang.test.ts`

**Interfaces:**
- Consumes: `bexAufruf`, `aesGcmEntschluesseln`, `aesCbcEntschluesseln`, `BeaSitzung`
- Produces (die Typen `BeaPostfachInfo`, `BeaOrdnerInfo`, `BeaNachrichtKopf`, `BeaAnhangDaten` und `BeaNachrichtVoll` **in diesem Task** in `src/lib/bea/provider.ts` anlegen, genau wie in Task 6 definiert):
  - `holePostfaecher(s: BeaSitzung): Promise<BeaPostfachInfo[]>` → `bea_get_postboxes { token }`
  - `holeOrdner(s: BeaSitzung, postfachSafeId: string): Promise<BeaOrdnerInfo[]>` → `bea_get_folderstructure { token, postboxSafeId }`
  - `holeNachrichtenkoepfe(s: BeaSitzung, ordnerId: string): Promise<BeaNachrichtKopf[]>` → `bea_get_folderoverview { token, folderId }`; Betreff mit `sessionKey` per AES-GCM entschlüsseln
  - `holeNachricht(s: BeaSitzung, messageId: string): Promise<BeaNachrichtVoll>` → `bea_get_message { token, messageId }`
  - `mimeTypAusName(name: string): string`

Entschlüsselung von `bea_get_message`:
- `metaData.subject` (`{value, iv, tag}`) wird mit `sessionKey` per AES-GCM entschlüsselt, als UTF-8.
- Für jedes Element in `encryptedObjects`:
  - `objectKey` = AES-GCM(`sessionKey`, `encKeyInfo.encKey`).
  - Daten: Sind `enc_iv` und `enc_tag` leer, gilt AES-CBC mit `objectKey` (IV vorangestellt), sonst AES-GCM(`objectKey`, `{enc_data, enc_iv, enc_tag}`).
  - Hat das Objekt den Namen **`project_coco`**: XML parsen (vorhandener `fast-xml-parser`, `removeNSPrefix`). Die n-te `CipherReference@URI` (ohne Präfix `cid:`) gehört zum n-ten `MgmtData`-Text (Base64-Schlüssel). Ist die Anzahl verschieden, gilt der erste Schlüssel für alle.
  - Ein Objekt mit Textinhalt (Name laut V4, **Annahme:** `nachrichtentext`) wird zu `text`.
- Für jedes Element in `attachments`: Schlüssel = Map-Eintrag zu `reference`.
  - Ist `symEncAlgorithm === "http://www.w3.org/2001/04/xmlenc#aes256-cbc"` oder sind `iv` und `tag` leer: AES-CBC mit Map-Schlüssel, ersatzweise mit `element.key`.
  - Sonst AES-GCM.
- Metadaten übernehmen: `osciMessageId`, `messageId`, `metaData.{sender, addressees, referenceNumber, referenceJustice, receptionTime, eebAngefordert, confidential, urgent}`.
- Feldnamen der Ordnerstruktur und der Ordnerübersicht laut V4. **Annahme:** `{id, name, type, parentId}` und `{messageId, subject{value,iv,tag}, sender, receptionTime, eebAngefordert, attachments}`. Die Zuordnung steht in **einer** Funktion je Antworttyp, damit eine Korrektur lokal bleibt.

- [ ] **Step 1: Failing Tests schreiben.** Fixtures im Test mit `aesGcmVerschluesseln` und `node:crypto` erzeugen:

```ts
it("entschlüsselt Betreff 'Klage Müller ./. Schäfer €' aus metaData.subject");
it("entschlüsselt einen Anhang über project_coco-Schlüssel (AES-GCM) und liefert Buffer, Name, mimeType application/pdf");
it("entschlüsselt einen Anhang mit symEncAlgorithm aes256-cbc");
it("nutzt den ersten Schlüssel für alle Anhänge, wenn Anzahl CipherReference ≠ Anzahl MgmtData");
it("liefert eebAngefordert true aus metaData.eebAngefordert");
it("wirft BeaExpertError, wenn ein GCM-Tag nicht passt");
it("mimeTypAusName: pdf, xml, txt, p7s, tif, jpg, png, docx, odt, unbekannt → application/octet-stream");
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen** — `npx vitest run src/lib/bea/expert/__tests__/eingang.test.ts` → FAIL
- [ ] **Step 3: `eingang.ts` implementieren**
- [ ] **Step 4: Tests laufen lassen** → PASS
- [ ] **Step 5: Commit** — `feat(bea): Abruf und Entschlüsselung eingehender Nachrichten`

---

### Task 5: Ausgang – Versand, Entwurf, eEB-Antwort

**Files:**
- Create: `src/lib/bea/expert/ausgang.ts`
- Test: `src/lib/bea/expert/__tests__/ausgang.test.ts`

**Interfaces:**
- Consumes: `bexAufruf` (Timeout **300 000 ms** für init, save, send und validation), `aesGcmVerschluesseln`, `aesGcmEntschluesseln`
- Produces (die Typen `BeaNachrichtenTyp`, `BeaVersandAuftrag`, `BeaEebAuftrag` und `BeaVersandErgebnis` **in diesem Task** in `src/lib/bea/provider.ts` anlegen, genau wie in Task 6 definiert):
  - `baueMsgInfos(a: BeaVersandAuftrag | BeaEebAuftrag): Record<string, unknown>`
  - `sendeNachricht(s: BeaSitzung, a: BeaVersandAuftrag): Promise<BeaVersandErgebnis>`
  - `speichereEntwurf(s: BeaSitzung, a: BeaVersandAuftrag): Promise<{ messageId: string | null }>`
  - `sendeEebAntwort(s: BeaSitzung, a: BeaEebAuftrag): Promise<BeaVersandErgebnis>`

`msg_infos` (Feldnamen genau so):

`betreff`, `aktz_sender`, `aktz_rcv`, `msg_text`, `is_eeb`, `dringend`, `pruefen: false`, `receivers` (SAFE-IDs; **leer bei Entwurf**), `attachments` (nur Namen), `is_eeb_response`, `eeb_fremdid`, `eeb_date`, `verfahrensgegenstand: ""`, `eeb_erforderlich`, `eeb_accept`, `xj: true`, `nachrichten_typ` (`ALLGEMEINE_NACHRICHT` | `MAHN_ANTRAG` | `TESTNACHRICHT`).

Für eine eEB-Abgabe: `is_eeb: true`, `is_eeb_response: true`, `eeb_accept: true`, `eeb_fremdid` = XJustiz-Nachrichten-ID der Anforderung, `eeb_date` = `formatEebDatum(abgabeDatum)`. **Annahme:** `""`, wenn das Datum heute ist, sonst `YYYY-MM-DD`; Smoke-Test prüft das. Keine Anhänge.

Ablauf:
1. `bea_init_message { token, postboxSafeId, msg_infos }` liefert `{ key: {value,iv,tag}, messageToken }`. Den Nachrichtenschlüssel mit `sessionKey` entschlüsseln.
2. Betreff und jeden Anhang mit dem Nachrichtenschlüssel per AES-GCM verschlüsseln.
3. Je Anhang: `{ data, tag, iv, key: base64(Nachrichtenschlüssel), name, sizeKB: floor(base64Länge/1024), hash: base64(sha256(Rohdaten)), att_type: "SCHRIFTSATZ" | "ATTACHMENT" }`.
4. Nutzlast `{ messageToken, encrypted_data: { encSubject, attachments } }` an `bea_save_message` (Entwurf) bzw. `bea_send_message`.
5. Beim Senden: Die Antwort `{ validationTokenMSG, validations[] }` mit `sessionKey` entschlüsseln (je `{data,iv,tag,id}`) und als `{ validationTokenMSG, validations: [{ id, data: base64(klar) }] }` an `bea_send_message_validation` schicken.
6. Die Antwort enthält die Nachrichten-ID; Feld laut V4, **Annahme:** `messageId`. Fehlt sie, `messageId: null` zurückgeben.
7. Bei einem Fehler nach `bea_init_message`: `bea_cleanup_message { messageToken }` best-effort aufrufen. Fehler darin nur loggen.

- [ ] **Step 1: Failing Tests schreiben**

```ts
it("baueMsgInfos setzt für Testnachricht nachrichten_typ TESTNACHRICHT, receivers, attachments-Namen, eeb_erforderlich");
it("baueMsgInfos für Entwurf: receivers leer");
it("baueMsgInfos für eEB-Abgabe: is_eeb, is_eeb_response, eeb_accept true, eeb_fremdid gesetzt, keine attachments");
it("sendeNachricht ruft init → send → validation auf; Anhang lässt sich mit dem Nachrichtenschlüssel wieder entschlüsseln; hash = sha256");
it("sendeNachricht liefert messageId aus der Validierungsantwort");
it("sendeNachricht ruft bea_cleanup_message, wenn bea_send_message fehlschlägt, und wirft BeaExpertError");
it("Betreff 'Schriftsatz Müller ß €' lässt sich aus encSubject per UTF-8 zurückgewinnen");
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen** — `npx vitest run src/lib/bea/expert/__tests__/ausgang.test.ts` → FAIL
- [ ] **Step 3: `ausgang.ts` implementieren**
- [ ] **Step 4: Tests laufen lassen** → PASS
- [ ] **Step 5: Commit** — `feat(bea): Versand, Entwurf und eEB-Antwort über bea.expert`

---

### Task 6: Provider-Schnittstelle, bea.expert-Provider, Mock-Provider

**Files:**
- Create/Modify: `src/lib/bea/provider.ts`
- Create: `src/lib/bea/expert/provider.ts`, `src/lib/bea/mock-provider.ts`
- Test: `src/lib/bea/__tests__/provider.test.ts`

**Interfaces:**
- Produces (alle Typen in `src/lib/bea/provider.ts`):

```ts
export interface BeaPostfachInfo { safeId: string; name: string; typ: string }
export interface BeaOrdnerInfo { id: string; name: string; typ: string; parentId: string | null }
export interface BeaNachrichtKopf { messageId: string; betreff: string; absender: string; empfangenAm: Date | null; eebAngefordert: boolean }
export interface BeaAnhangDaten { name: string; mimeType: string; inhalt: Buffer; typ: string | null }
export interface BeaNachrichtVoll {
  messageId: string; osciMessageId: string | null; betreff: string; text: string | null;
  absender: { safeId: string; name: string }; empfaenger: { safeId: string; name: string }[];
  aktenzeichenAbsender: string | null; aktenzeichenJustiz: string | null;
  empfangenAm: Date | null; eebAngefordert: boolean; vertraulich: boolean; dringend: boolean;
  anhaenge: BeaAnhangDaten[];
}
export type BeaNachrichtenTyp = "ALLGEMEINE_NACHRICHT" | "MAHN_ANTRAG" | "TESTNACHRICHT";
export interface BeaVersandAuftrag {
  postfachSafeId: string; empfaengerSafeIds: string[]; betreff: string; text: string;
  aktenzeichenAbsender?: string; aktenzeichenEmpfaenger?: string;
  nachrichtenTyp: BeaNachrichtenTyp; eebAnfordern: boolean; dringend: boolean;
  anhaenge: { name: string; inhalt: Buffer; art: "SCHRIFTSATZ" | "ATTACHMENT" }[];
}
export interface BeaEebAuftrag {
  postfachSafeId: string; empfaengerSafeId: string; betreff: string;
  aktenzeichenAbsender?: string; aktenzeichenEmpfaenger?: string;
  fremdId: string; abgabeDatum: string /* YYYY-MM-DD */;
}
export interface BeaVersandErgebnis { messageId: string | null }
export interface BeaProvider {
  anmelden(p12: Buffer, pin: string): Promise<BeaSitzung>;
  pruefeSitzung(s: BeaSitzung): Promise<boolean>;      // bea_check_session { token }
  abmelden(s: BeaSitzung): Promise<void>;              // bea_logout { token }
  listePostfaecher(s: BeaSitzung): Promise<BeaPostfachInfo[]>;
  listeOrdner(s: BeaSitzung, postfachSafeId: string): Promise<BeaOrdnerInfo[]>;
  listeNachrichten(s: BeaSitzung, ordnerId: string): Promise<BeaNachrichtKopf[]>;
  holeNachricht(s: BeaSitzung, messageId: string): Promise<BeaNachrichtVoll>;
  sende(s: BeaSitzung, a: BeaVersandAuftrag): Promise<BeaVersandErgebnis>;
  speichereEntwurf(s: BeaSitzung, a: BeaVersandAuftrag): Promise<{ messageId: string | null }>;
  gibEebAb(s: BeaSitzung, a: BeaEebAuftrag): Promise<BeaVersandErgebnis>;
  sucheIdentitaet(s: BeaSitzung, q: { name?: string; plz?: string; ort?: string }): Promise<{ safeId: string; name: string; ort: string | null }[]>; // bea_search
}
export function getBeaProvider(): BeaProvider | null; // null = beA deaktiviert (Global Constraints)
```

- `MockProvider`: Konstruktor `new MockProvider(seed?: { postfaecher; nachrichten: BeaNachrichtVoll[] })`; zeichnet `gesendet: (BeaVersandAuftrag | BeaEebAuftrag)[]` auf; `anmelden` wirft bei PIN `"falsch"`.

- [ ] **Step 1: Failing Tests schreiben**

```ts
it("getBeaProvider liefert BeaExpertProvider bei gesetztem BEA_EXPERT_IDENT");
it("getBeaProvider liefert MockProvider ohne Ident außerhalb von Produktion");
it("getBeaProvider liefert null ohne Ident in Produktion");
it("MockProvider.sende zeichnet den Auftrag auf und liefert eine messageId");
it("MockProvider.anmelden wirft bei PIN 'falsch'");
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen** — `npx vitest run src/lib/bea/__tests__/provider.test.ts` → FAIL
- [ ] **Step 3: Implementieren.** `BeaExpertProvider` delegiert an `login.ts`, `eingang.ts` und `ausgang.ts`. `sucheIdentitaet` ruft `bea_search` auf und mappt in einer eigenen Funktion.
- [ ] **Step 4: Tests laufen lassen** → PASS
- [ ] **Step 5: Commit** — `feat(bea): BeaProvider-Schnittstelle mit bea.expert- und Mock-Implementierung`

---

### Task 7: Datenmodell, Zertifikatsspeicher, Admin-Upload

**Files:**
- Modify: `prisma/schema.prisma` (Modell `BeaZertifikat`, Erweiterung `BeaNachricht`, Relation an `User`)
- Create: Prisma-Migration `bea_expert_anbindung`
- Create: `src/lib/bea/zertifikat.ts`
- Create: `src/app/api/admin/benutzer/[id]/bea-zertifikat/route.ts` (GET, POST, DELETE)
- Create: `src/components/admin/bea-zertifikat-dialog.tsx`
- Modify: `src/app/(dashboard)/admin/benutzer/page.tsx` (Aktion „beA-Zertifikat“ je Benutzer)
- Test: `src/lib/bea/__tests__/zertifikat.test.ts`

**Interfaces:**
- Schema:

```prisma
enum BeaZertifikatStatus { AKTIV FEHLER }
enum BeaRichtung { EINGANG AUSGANG }

model BeaZertifikat {
  id                String              @id @default(cuid())
  userId            String              @unique
  user              User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  p12Verschluesselt String              @db.Text   // encryptCredential(base64(p12))
  pinVerschluesselt String
  seriennummer      String
  inhaber           String
  gueltigBis        DateTime
  safeId            String?
  status            BeaZertifikatStatus @default(AKTIV)
  letzterFehler     String?
  letzterAbruf      DateTime?
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt
  @@map("bea_zertifikate")
}
// BeaNachricht zusätzlich:
//   postfachSafeId String?, richtung BeaRichtung @default(EINGANG),
//   aktenzeichenAbsender String?, aktenzeichenJustiz String?,
//   eebAngefordert Boolean @default(false), xjustizNachrichtenId String?,
//   exportPfad String?  (MinIO-Key von nachricht.json)
//   anhaenge Json bleibt; Format: [{ name, storageKey, mimeType, groesse, art, dokumentId? }]
```

- Produces (`zertifikat.ts`):
  - `speichereZertifikat(userId: string, p12: Buffer, pin: string): Promise<{ seriennummer: string; inhaber: string; gueltigBis: Date }>`. Liest per `leseP12`, wirft bei falscher PIN oder Ablauf (`gueltigBis < jetzt` → „Zertifikat ist abgelaufen“), setzt `status: AKTIV` und `letzterFehler: null`.
  - `ladeZertifikat(userId: string): Promise<{ p12: Buffer; pin: string } | null>`, nur bei Status `AKTIV`
  - `markiereZertifikatFehler(userId: string, meldung: string): Promise<void>`
  - `zertifikatInfo(userId: string): Promise<{ seriennummer; inhaber; gueltigBis; status; letzterFehler; letzterAbruf; safeId } | null>`
- Verschlüsselung mit `encryptCredential`/`decryptCredential` aus `src/lib/email/crypto.ts`.
- Route: Admin-Prüfung wie in `src/app/api/admin/benutzer/[id]/entsperren/route.ts`. POST als `multipart/form-data` (`datei`, `pin`), Antwort ohne Geheimnisse. Audit-Aktionen `BEA_ZERTIFIKAT_HINTERLEGT` und `BEA_ZERTIFIKAT_ENTFERNT` (in `src/lib/audit.ts` ergänzen).
- Dialog: Datei-Upload (`.p12`, `.pfx`) und PIN-Feld. Zeigt Seriennummer, Inhaber, „gültig bis“, Status, letzten Fehler und letzten Abruf, dazu die Schaltfläche „Zertifikat entfernen“. Hinweis: „Das beA-Softwarezertifikat erhalten Sie bei der Bundesnotarkammer.“

- [ ] **Step 1: Failing Tests schreiben** (Prisma wie in den bestehenden Tests mocken; Test-P12 aus Task 2)

```ts
it("speichereZertifikat speichert p12 und PIN verschlüsselt (Klartext-PIN kommt im gespeicherten Datensatz nicht vor)");
it("speichereZertifikat wirft bei falscher PIN 'PIN falsch oder Datei ist kein beA-Softwarezertifikat'");
it("speichereZertifikat wirft 'Zertifikat ist abgelaufen' bei gueltigBis in der Vergangenheit");
it("ladeZertifikat liefert null bei Status FEHLER");
it("speichereZertifikat setzt einen FEHLER-Status zurück auf AKTIV");
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen** — `npx vitest run src/lib/bea/__tests__/zertifikat.test.ts` → FAIL
- [ ] **Step 3: Schema ändern, Migration erzeugen** — `npx prisma migrate dev --name bea_expert_anbindung` → Migration angelegt, `npx prisma generate` ok
- [ ] **Step 4: `zertifikat.ts`, Route und Dialog implementieren**
- [ ] **Step 5: Tests laufen lassen** → PASS; `npx tsc --noEmit` → keine Fehler
- [ ] **Step 6: Commit** — `feat(bea): Softwarezertifikat pro Benutzer verschlüsselt hinterlegen`

---

### Task 8: Sitzungsverwaltung

**Files:**
- Create: `src/lib/bea/sitzung.ts`
- Test: `src/lib/bea/__tests__/sitzung.test.ts`

**Interfaces:**
- Consumes: `getBeaProvider`, `ladeZertifikat`, `markiereZertifikatFehler`, `createRedisConnection` (`src/lib/redis.ts`)
- Produces:
  - `class BeaNichtEingerichtetError extends Error` (kein Zertifikat, Status FEHLER oder Provider `null`)
  - `mitBeaSitzung<T>(userId: string, fn: (s: BeaSitzung, p: BeaProvider) => Promise<T>, opts: { wiederholen: boolean }): Promise<T>`
  - `verwerfeBeaSitzung(userId: string): Promise<void>`

Verhalten:
- Der Redis-Schlüssel `bea:sitzung:<userId>` enthält `encryptCredential(JSON { token, sessionKey: base64, safeId })`, **TTL 600 s**.
- Ist keine Sitzung vorhanden: Zertifikat laden und `anmelden`. Bei Fehler beim Anmelden: `markiereZertifikatFehler(userId, "beA-Anmeldung fehlgeschlagen: <Meldung>")`, dann `BeaNichtEingerichtetError` werfen.
- `wiederholen: true`: Wirft `fn` einen `BeaExpertError`, Sitzung verwerfen, neu anmelden und `fn` **genau einmal** erneut ausführen.
- `wiederholen: false`: Vor `fn` einmal `pruefeSitzung` aufrufen; ist das Ergebnis `false`, neu anmelden. **Kein** erneuter Aufruf von `fn`.
- Erfolgreiches Anmelden schreibt `safeId` in `BeaZertifikat`.

- [ ] **Step 1: Failing Tests schreiben** (Redis mit In-Memory-Fake, `MockProvider`)

```ts
it("meldet beim ersten Aufruf an und nutzt danach die Sitzung aus Redis (anmelden genau 1×)");
it("speichert die Sitzung verschlüsselt (Redis-Wert enthält das Token nicht im Klartext)");
it("wiederholen:true – nach BeaExpertError neu anmelden und fn ein zweites Mal aufrufen");
it("wiederholen:true – zweiter Fehler wird durchgereicht (fn höchstens 2×)");
it("wiederholen:false – fn wird nach BeaExpertError NICHT erneut aufgerufen");
it("wiederholen:false – pruefeSitzung false führt vor fn zu neuer Anmeldung");
it("falsche PIN → Zertifikat FEHLER und BeaNichtEingerichtetError");
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen** — `npx vitest run src/lib/bea/__tests__/sitzung.test.ts` → FAIL
- [ ] **Step 3: `sitzung.ts` implementieren**
- [ ] **Step 4: Tests laufen lassen** → PASS
- [ ] **Step 5: Commit** — `feat(bea): Sitzungsverwaltung mit Redis und kontrollierter Wiederholung`

---

### Task 9: Abruf, Ablage, Zuordnung, Job

**Files:**
- Create: `src/lib/bea/abruf.ts`
- Create: `src/lib/queue/processors/bea-sync.processor.ts`
- Modify: `src/lib/queue/queues.ts` (`beaSyncQueue`, `registerBeaSyncJob`, Eintrag in `ALL_QUEUES`)
- Modify: `src/worker.ts` (Worker registrieren wie `caldavSyncWorker`; `registerBeaSyncJob()` beim Start)
- Create: `src/app/api/bea/sync/route.ts` (POST: Job für das eigene Zertifikat einreihen; `canReadBeA`)
- Create: `src/app/api/bea/status/route.ts` (GET: `{ eingerichtet: boolean, zertifikat: zertifikatInfo | null }`)
- Modify: `src/lib/xjustiz/parser.ts` (`XJustizData.nachrichtenId?: string` aus `nachrichtenkopf/eigeneNachrichtenID`)
- Modify: `src/app/api/bea/messages/[id]/route.ts` (bei Zuordnungsänderung `legeDokumenteAn`; Anhang-Download über `storageKey`)
- Test: `src/lib/bea/__tests__/abruf.test.ts`, Erweiterung von `src/lib/xjustiz/__tests__/parser.test.ts`

**Interfaces:**
- Consumes: `mitBeaSitzung` (Task 8, `wiederholen: true`), `autoAssignToAkte` (`src/lib/bea/auto-assign.ts`), `parseXJustiz`, `uploadFile`, `generateStorageKey` (`src/lib/storage.ts`), `ocrQueue`, `logAuditEvent`
- Produces:
  - `rufeZertifikatAb(userId: string): Promise<{ neu: number; fehler: string[] }>`
  - `speichereEingang(n: BeaNachrichtVoll, postfachSafeId: string, userId: string): Promise<{ id: string; neu: boolean }>`
  - `legeDokumenteAn(beaNachrichtId: string, akteId: string): Promise<number>` (idempotent: Anhänge mit `dokumentId` überspringen)
  - `beaSyncQueue: Queue<{ userId?: string }>`, Job-Name `bea-sync`, wiederkehrend alle **5 Minuten**
  - `registerBeaSyncJob(): Promise<void>`

Ablauf von `rufeZertifikatAb`:
1. Postfächer listen, dann Ordner listen, dann den Ordner vom Typ `INBOX` wählen (**Annahme** laut V4; sonst der Name „Posteingang“).
2. Nachrichtenköpfe holen und die `messageId`s herausfiltern, die schon als `nachrichtenId` existieren.
3. Für jede neue Nachricht `holeNachricht`, dann `speichereEingang`.
4. Zum Schluss `letzterAbruf` setzen.

Ablauf von `speichereEingang`:
1. Anhänge nach MinIO unter `bea/<postfachSafeId>/<messageId>/<name>` hochladen.
2. `nachricht.json` (Metadaten und Anhangsreferenzen, ohne Inhalte) unter `bea/<postfachSafeId>/<messageId>/nachricht.json` ablegen; Key nach `exportPfad`.
3. Den Anhang `xjustiz_nachricht.xml` (falls vorhanden) mit `parseXJustiz` in `xjustizData` und `xjustizNachrichtenId` übernehmen.
4. `BeaNachricht` anlegen mit `status: EINGANG` und `richtung: EINGANG`. Bei P2002 auf `nachrichtenId` zurückgeben `{ neu: false }`, ohne Fehler.
5. `autoAssignToAkte`: Bei Konfidenz `SICHER` `akteId` setzen, `status: ZUGEORDNET` und `legeDokumenteAn` aufrufen.
6. Dokumente: `status: FREIGEGEBEN` (eingehende Post ist kein Entwurf), `erstelltDurch: "system"`, `ordner: "beA"`, Tag `beA`, danach OCR-Job.
7. Audit-Eintrag `BEA_NACHRICHT_EMPFANGEN` (ohne Inhalte).

Fehler im Job:
- `BeaNichtEingerichtetError` beendet den Job für dieses Zertifikat ohne erneuten Versuch.
- Andere Fehler landen in `fehler[]`; der Job schlägt mit BullMQ-Backoff fehl.
- Der Job ohne `userId` läuft über alle Zertifikate mit Status `AKTIV`.

- [ ] **Step 1: Failing Tests schreiben** (`MockProvider`, Prisma- und Storage-Mocks)

```ts
it("legt zwei neue Nachrichten an und lädt ihre Anhänge nach bea/<safeId>/<messageId>/ hoch");
it("überspringt bereits vorhandene nachrichtenId (holeNachricht nicht aufgerufen)");
it("P2002 bei parallelem Abruf ergibt { neu: false } statt Fehler");
it("SICHER zugeordnete Nachricht → status ZUGEORDNET, Dokumente FREIGEGEBEN mit Tag beA, OCR eingereiht");
it("nicht zugeordnete Nachricht → keine Dokumente; legeDokumenteAn bei späterer Zuordnung legt sie an");
it("legeDokumenteAn zweimal → Dokumente nur einmal");
it("xjustiz_nachricht.xml wird geparst, xjustizNachrichtenId gesetzt");
it("falsche PIN → keine Exception aus dem Job, Zertifikat FEHLER, kein zweiter Anmeldeversuch beim nächsten Lauf");
// parser.test.ts:
it("parseXJustiz liest eigeneNachrichtenID aus dem nachrichtenkopf");
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen** — `npx vitest run src/lib/bea/__tests__/abruf.test.ts src/lib/xjustiz` → FAIL
- [ ] **Step 3: Implementieren** (`abruf.ts`, Processor, Queue, Worker, Routen, Parser)
- [ ] **Step 4: Tests laufen lassen** → PASS; `npx tsc --noEmit` → keine Fehler
- [ ] **Step 5: Commit** — `feat(bea): periodischer Abruf mit Ablage und Aktenzuordnung`

---

### Task 10: Versandregeln und serverseitiger Versand

**Files:**
- Create: `src/lib/bea/regeln.ts`
- Modify: `src/lib/bea/versand.ts` (neues Schema `beaVersandSchema`; nicht mehr genutzte Teile des Browser-Vertrags entfernen)
- Modify: `src/app/api/bea/messages/route.ts` (POST sendet serverseitig)
- Modify: `src/app/api/bea/messages/versand-pruefung/route.ts` (nutzt `pruefeVersand`)
- Test: `src/lib/bea/__tests__/regeln.test.ts`, `src/lib/bea/__tests__/versand.test.ts` (anpassen)

**Interfaces:**
- Produces (`regeln.ts`):
  - `pruefeZeichensatz(feld: string, text: string): ZeichenVerstoss[]`, mit `ZeichenVerstoss = { feld: string; zeichen: string; codePoint: string /* "U+201E" */; position: number; ersatz: string | null }`
  - `ersetzeTypografie(text: string): string`
  - `pruefeVersand(e: { betreff: string; text: string; empfaengerSafeIds: string[]; eebAnfordern: boolean; anhaenge: { name: string; groesse: number }[] }): { fehler: string[]; warnungen: string[]; verstoesse: ZeichenVerstoss[] }`
  - `pruefeEebDatum(abgabeDatum: string, heute?: Date): string | null` (Fehlermeldung oder `null`)
  - `heuteBerlin(jetzt?: Date): string` (YYYY-MM-DD in Europe/Berlin)
- `beaVersandSchema` (zod): `{ akteId?: string; postfachSafeId: string; empfaengerSafeIds: string[] (min 1); betreff: string (min 1); text: string; aktenzeichenAbsender?: string; aktenzeichenEmpfaenger?: string; nachrichtenTyp: BeaNachrichtenTyp; eebAnfordern: boolean; dringend: boolean; anhaenge: { dokumentId: string; art: "SCHRIFTSATZ" | "ATTACHMENT" }[]; alsEntwurf: boolean }`

Feste Werte:
- **Erlaubte Zeichen:** `\t \n \r`, U+0020–U+007E, U+00A0–U+017F und U+20AC (€). Alles andere ist ein Verstoß.
- **Ersatz:** `„ “ ” ″` → `"`; `‚ ‘ ’ ′` → `'`; `– —` → `-`; `…` → `...`; U+00A0 bleibt erlaubt. Ohne Ersatz `null`.
- Geprüft werden Betreff, Text, beide Aktenzeichen und die Anhangnamen.
- **Fehler:** „Betreff fehlt“; „Mindestens ein Empfänger ist erforderlich“; „Ein eEB kann nur für Nachrichten mit mindestens einem Anhang angefordert werden“; „Höchstens 1000 Anhänge erlaubt“; „Anhänge dürfen zusammen höchstens 200 MB groß sein“.
- **Warnungen:** mehr als 50 Anhänge → „Mehr als 50 Anhänge“; mehr als 60 MB → „Anhänge größer als 60 MB“.
- **MB-Grenze:** 1 MB = 1 048 576 Byte; 200 MB = 209 715 200 Byte.
- **eEB-Datum:** nicht nach `heuteBerlin()` und nicht vor `heuteBerlin()` minus 2 Kalendermonate. Fehlermeldungen: „Das Abgabedatum darf nicht in der Zukunft liegen“, „Das Abgabedatum darf höchstens zwei Monate zurückliegen“.

Ablauf von POST `/api/bea/messages`:
1. `requirePermission("canSendBeA")`, dann Schema prüfen, dann Aktenzugriff prüfen.
2. `checkDokumenteFreigegeben`.
3. Dokumente aus MinIO laden und `pruefeVersand` aufrufen; bei Fehlern oder Verstößen **422** mit `{ fehler, warnungen, verstoesse }`.
4. `mitBeaSitzung(userId, …, { wiederholen: false })` mit `sende` bzw. `speichereEntwurf`.
5. Bei Erfolg: `BeaNachricht` mit `richtung: AUSGANG`, `status: GESENDET` und `nachrichtenId`. Ein Entwurf bekommt `status: EINGANG` und wird **nicht** als gesendet markiert. Danach `markDokumenteVersendet` (nur bei Versand) und Audit `BEA_NACHRICHT_GESENDET`.
6. Bei `BeaExpertError` oder Timeout: `BeaNachricht` mit `status: FEHLER` und `inhalt`-Hinweis „Versandstatus unklar – bitte im beA-Webclient prüfen“. Antwort **502**, **kein** zweiter Versuch.
7. Bei `BeaNichtEingerichtetError`: **409** „Für Ihren Benutzer ist kein gültiges beA-Softwarezertifikat hinterlegt“.

- [ ] **Step 1: Failing Tests schreiben**

```ts
it("pruefeZeichensatz meldet „ an Position 0 mit codePoint U+201E und ersatz '\"'");
it("pruefeZeichensatz akzeptiert 'Müller ß € Æ ł'");
it("pruefeZeichensatz meldet Emoji ohne ersatz");
it("ersetzeTypografie('„Klage“ – Teil…') === '\"Klage\" - Teil...'");
it("pruefeVersand: eEB ohne Anhang → Fehler mit genauem Text");
it("pruefeVersand: 1001 Anhänge → Fehler; 51 Anhänge → Warnung");
it("pruefeVersand: 209_715_201 Byte → Fehler; 62_914_561 Byte → Warnung");
it("pruefeEebDatum: morgen → Zukunftsfehler; heute minus 2 Monate → ok; minus 2 Monate minus 1 Tag → Fehler");
it("heuteBerlin: 2026-11-19T23:30Z → '2026-11-20'");
// versand.test.ts (Route mit MockProvider):
it("POST sendet und speichert GESENDET mit nachrichtenId des Providers");
it("POST bei Provider-Fehler: genau ein sende-Aufruf, Status FEHLER, HTTP 502");
it("POST ohne Zertifikat → 409");
it("POST mit nicht freigegebenem Dokument → abgelehnt, Provider nicht aufgerufen");
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen** — `npx vitest run src/lib/bea/__tests__/regeln.test.ts src/lib/bea/__tests__/versand.test.ts` → FAIL
- [ ] **Step 3: Implementieren**
- [ ] **Step 4: Tests laufen lassen** → PASS
- [ ] **Step 5: Commit** — `feat(bea): Versandregeln und serverseitiger Versand`

---

### Task 11: eEB abgeben

**Files:**
- Modify: `src/app/api/bea/messages/[id]/eeb/route.ts` (serverseitige Abgabe)
- Test: `src/lib/bea/__tests__/eeb.test.ts`

**Interfaces:**
- Consumes: `pruefeEebDatum`, `heuteBerlin` (Task 10), `mitBeaSitzung` (`wiederholen: false`), `gibEebAb`, `BeaNachricht.xjustizNachrichtenId`, `postfachSafeId`, `safeIdAbsender`
- Request: `{ abgabeDatum: string /* YYYY-MM-DD */ }`

Ablauf:
1. `canSendBeA` und Aktenzugriff prüfen.
2. Die Nachricht muss `eebAngefordert: true` haben, `eebStatus` darf nicht `BESTAETIGT` sein, und `xjustizNachrichtenId` muss gesetzt sein. Sonst **422** mit „Für diese Nachricht kann kein eEB abgegeben werden“.
3. Datum mit `pruefeEebDatum` prüfen.
4. `gibEebAb` mit `fremdId = xjustizNachrichtenId`, `empfaengerSafeId = safeIdAbsender` und `betreff = "Elektronisches Empfangsbekenntnis zu " + (aktenzeichenJustiz ?? betreff)`.
5. Bei Erfolg: `eebStatus: BESTAETIGT`, `eebDatum` und Audit `BEA_EEB_BESTAETIGT`. Bei Fehler: 502, Status bleibt unverändert, kein zweiter Versuch.

Das **Zurückweisen** eines eEB folgt erst, wenn V4 das Feld für den Grund nennt (Task 14).

- [ ] **Step 1: Failing Tests schreiben**

```ts
it("gibt eEB mit fremdId = xjustizNachrichtenId und Empfänger = Absender ab, setzt BESTAETIGT");
it("verweigert eEB bei bereits BESTAETIGT (422), Provider nicht aufgerufen");
it("verweigert eEB ohne xjustizNachrichtenId (422)");
it("verweigert Abgabedatum in der Zukunft (422)");
it("Provider-Fehler → 502, eebStatus unverändert, gibEebAb genau 1×");
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen** — `npx vitest run src/lib/bea/__tests__/eeb.test.ts` → FAIL
- [ ] **Step 3: Implementieren**
- [ ] **Step 4: Tests laufen lassen** → PASS
- [ ] **Step 5: Commit** — `feat(bea): eEB serverseitig abgeben`

---

### Task 12: Oberfläche umstellen, Browser-Anbindung entfernen

**Files:**
- Delete: `src/lib/bea/client.ts`, `src/lib/bea/session.tsx`
- Modify: `src/app/(dashboard)/bea/layout.tsx` (`BeaSessionProvider` entfernen)
- Modify: `src/components/bea/bea-inbox.tsx`, `bea-compose.tsx`, `bea-message-detail.tsx`, `eeb-button.tsx`
- Modify: `src/components/kontakte/kontakt-form-rechtliches.tsx` (Schaltfläche „Im beA-Verzeichnis suchen“; Route `src/app/api/bea/identitaeten/route.ts` mit `sucheIdentitaet`, `canReadBeA`, `wiederholen: true`)

**Interfaces:**
- Consumes: `GET /api/bea/status`, `POST /api/bea/sync`, `POST /api/bea/messages`, `POST /api/bea/messages/versand-pruefung`, `POST /api/bea/messages/[id]/eeb`, `GET /api/bea/identitaeten?name=&plz=&ort=`

Verhalten:
- **Posteingang:**
  - Kein Login-Dialog mehr. Ein Banner aus `/api/bea/status` zeigt, wenn nötig: „Kein beA-Zertifikat hinterlegt – bitte an die Administration wenden“, „beA-Anmeldung fehlgeschlagen: <letzterFehler>“ oder „beA ist nicht eingerichtet“.
  - Schaltfläche „Jetzt abrufen“ ruft `/api/bea/sync` auf und lädt die Liste nach 5 s neu.
  - Anzeige „Zuletzt abgerufen: <letzterAbruf>“.
- **Versand (Compose):**
  - Anhänge kommen aus den Dokumenten der Akte, je mit Auswahl „Schriftsatz“ oder „Anlage“.
  - Felder: Nachrichtentyp (Allgemeine Nachricht, Mahnantrag, Testnachricht), „eEB anfordern“, „dringend“, Absender-Aktenzeichen (vorbelegt mit dem Aktenzeichen) und Empfänger-Aktenzeichen.
  - Vor dem Senden wird `versand-pruefung` aufgerufen. Fehler, Warnungen und Zeichenverstöße werden angezeigt, mit der Schaltfläche „Typografische Zeichen ersetzen“ (`ersetzeTypografie`).
  - Schaltflächen „Senden“ und „Als Entwurf im beA speichern“.
  - Zähler „n Anhänge · x MB“; rot ab 50 Anhängen oder 60 MB.
- **eEB-Schaltfläche:** Datumsauswahl (Standard: heute; frühestens zwei Monate zurück, spätestens heute), dann POST an den Server.
- **Detailansicht:** Anhänge laden über die Download-Route, Hinweis zum Gelesen-Status: „Der Abruf über AI-Lawyer gilt im beA nicht als gelesen.“

- [ ] **Step 1: Prüfen, dass nichts mehr die gelöschten Module importiert**

Run: `grep -rn "lib/bea/client\|lib/bea/session" src`
Expected: keine Treffer nach dem Umbau

- [ ] **Step 2: Komponenten umbauen und Dateien löschen**

- [ ] **Step 3: Typen und Tests prüfen**

Run: `npx tsc --noEmit && npm test`
Expected: keine Fehler, alle Tests grün

- [ ] **Step 4: Manuell im Browser prüfen** (`BEA_PROVIDER=mock`, Seed mit zwei Nachrichten, davon eine mit eEB-Anforderung)
  - Posteingang zeigt beide Nachrichten.
  - Compose mit „„Test““ im Betreff zeigt einen Verstoß; „Ersetzen“ behebt ihn.
  - Senden ergibt `GESENDET`.
  - Die eEB-Schaltfläche gibt das eEB ab; danach ist sie deaktiviert.

- [ ] **Step 5: Commit** — `feat(bea): Oberfläche auf serverseitige beA-Anbindung umgestellt`

---

### Task 13: Smoke-Test gegen bea.expert und Dokumentation

**Files:**
- Create: `scripts/bea-smoke.ts`
- Modify: `.planning/research/BEA-INTEGRATION.md` (Annahmen aus V4 bestätigen oder korrigieren)
- Modify: Benutzerhandbuch (Abschnitt beA; Ort wie die übrigen Handbuchkapitel im Repo) und `.env.example` (`BEA_EXPERT_IDENT`, `BEA_PROVIDER`)

**Interfaces:**
- Aufruf: `BEA_SMOKE_P12=/pfad/zert.p12 BEA_SMOKE_PIN=… BEA_EXPERT_IDENT=… npx tsx scripts/bea-smoke.ts [--senden]`

Ablauf des Skripts:
1. Anmelden, Postfächer, Ordner und Posteingang listen, die neueste Nachricht holen. Ausgabe: Betreff, Anhangnamen und Größen. Keine Inhalte und keine Schlüssel ausgeben.
2. Nur mit `--senden`: eine `TESTNACHRICHT` an die **eigene** SAFE-ID mit einem Textanhang `test.txt` schicken und die zurückgegebene `messageId` ausgeben.
3. Abmelden.

- [ ] **Step 1: Skript schreiben**
- [ ] **Step 2: Lauf ohne `--senden`** (Patrick mit eigenem Zertifikat) — Expected: Liste der Postfächer und Nachrichten, Betreff lesbar mit Umlauten
- [ ] **Step 3: Lauf mit `--senden`** — Expected: `messageId` ausgegeben; die Nachricht erscheint im beA-Webclient im Ordner „Gesendet“ des eigenen Postfachs und im Posteingang
- [ ] **Step 4: Annahmen prüfen und korrigieren**
  - Ordnertyp `INBOX`, Feldnamen von Ordnerübersicht und Nachricht, Name des Textobjekts, `messageId` in der Validierungsantwort, `eeb_date`-Format.
  - Abweichungen in den Mapping-Funktionen der Tasks 4 und 5 korrigieren und die betroffenen Tests anpassen.
  - Fixture-Werte aus der echten Antwort übernehmen, **ohne** personenbezogene Inhalte.
- [ ] **Step 5: Abruf über den Job prüfen** — Zertifikat im Admin-Dialog hinterlegen, „Jetzt abrufen“ → neue Nachricht in AI-Lawyer, bei Aktenzeichen im Betreff der Akte zugeordnet
- [ ] **Step 6: Commit** — `chore(bea): Smoke-Test, Doku und bestätigte Protokollannahmen`

---

### Task 14: eEB zurückweisen (erst nach V4)

**Files:**
- Modify: `src/lib/bea/provider.ts` (`BeaEebAuftrag` um `ablehnung?: { code: string; kommentar?: string }` erweitern)
- Modify: `src/lib/bea/expert/ausgang.ts`, `src/app/api/bea/messages/[id]/eeb/route.ts`, `src/components/bea/eeb-button.tsx`
- Test: Erweiterung von `ausgang.test.ts` und `eeb.test.ts`

Verhalten:
- Bei `ablehnung`: `eeb_accept: false`, Grund-Code und Kommentar in den laut V4 benannten Feldern.
- Codeliste für die Auswahl laut V4 (XJustiz-Codeliste für eEB-Zurückweisungsgründe).
- Oberfläche: Dialog „eEB zurückweisen“ mit Grund und optionaler Erläuterung.
- Bei Erfolg `eebStatus: ABGELEHNT`, Audit `BEA_EEB_ABGELEHNT`.

- [ ] **Step 1: Failing Tests** — `baueMsgInfos` mit Ablehnung setzt `eeb_accept: false` und die Grund-Felder; die Route setzt `ABGELEHNT`
- [ ] **Step 2: Fehlschlag prüfen** — `npx vitest run src/lib/bea/expert/__tests__/ausgang.test.ts src/lib/bea/__tests__/eeb.test.ts` → FAIL
- [ ] **Step 3: Implementieren**
- [ ] **Step 4: Tests laufen lassen** → PASS
- [ ] **Step 5: Commit** — `feat(bea): eEB zurückweisen`

---

## Bewusst nicht im Umfang

- Ordnerverwaltung im beA (anlegen, löschen, verschieben) und Papierkorb
- Journal und Laufzettel mit Ampelstatus (j-lawyer hat beides; bei bea.expert ist der Weg dorthin noch unklar)
- Export im `.bea`-Format von j-lawyer (wir speichern `nachricht.json` und die Anhänge)
- Akteneinsicht-API, qualifizierte Signatur, Fernsignatur
- Abruf der Ordner „Gesendet“ und „Entwürfe“
