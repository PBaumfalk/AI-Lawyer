# 22 — Architektur und Entwicklung

Dieses Kapitel erklärt, wie AI-Lawyer aufgebaut ist, wo im Code was liegt und wie Sie eine Entwicklungsumgebung aufsetzen. Es richtet sich an die IT und an alle, die Fehler eingrenzen oder beitragen wollen.

## Überblick

AI-Lawyer ist eine TypeScript-Anwendung auf Basis von Next.js 14 (App Router). Rund 155 000 Zeilen in `src/`, 220 API-Routen, 86 Datenmodelle. Zwei eigene Prozesse und sieben Fremddienste arbeiten zusammen:

```
Browser ──HTTPS──► app (Next.js, Port 3000) ──► db (PostgreSQL 16 + pgvector)
   │                 │  API-Routen, Seiten       ► redis (BullMQ, Socket.IO-Adapter)
   │                 │                           ► minio (Dateien, S3)
   │                 │                           ► meilisearch (Volltext)
   │                 │                           ► ollama / OpenAI / Anthropic
   │                 └─ legt Jobs in Redis ──► worker (BullMQ, IMAP)
   │                                              ► stirling-pdf (OCR, PDF)
   ├──direkt──► onlyoffice (Editor)  ◄──► app (Laden/Speichern über APP_INTERNAL_URL)
   └──direkt──► minio (vorsignierte Download-Links)
```

| Prozess | Einstieg | Aufgabe |
| --- | --- | --- |
| **app** | `src/server.ts` (eigener Server) bzw. im Docker-Image der Next.js-Standalone-Server | Seiten, API-Routen, Anmeldung; mit `src/server.ts` zusätzlich Socket.IO am selben HTTP-Server |
| **worker** | `src/worker.ts`, gebündelt nach `dist-worker/index.js` | 20 BullMQ-Warteschlangen, Cron-Jobs, dauerhafte IMAP-Verbindungen ([Kapitel 21](21-betrieb-und-sicherung.md#hintergrund-jobs)) |

**Eigener Server und Socket.IO.** `src/server.ts` startet Next.js und hängt Socket.IO mit Redis-Adapter an denselben HTTP-Server (`src/lib/socket/server.ts`). Die Anmeldung am Socket prüft das NextAuth-JWT aus dem Cookie (`src/lib/socket/auth.ts`). Räume: `user:{id}`, `role:{ROLLE}`, `kanzlei:{id}` automatisch, `akte:{id}`, `mailbox:{id}`, `channel:{id}` bei Bedarf (`src/lib/socket/rooms.ts`). Der Worker sendet Ereignisse über `@socket.io/redis-emitter` (`src/lib/socket/emitter.ts`).

Das `Dockerfile` baut zwar `dist-server/index.js`, startet aber mit `CMD ["node", "server.js"]` den Standalone-Server von Next.js. Laut Commit `be3f97f` lädt der eigene Server im Standalone-Modus webpack, das dort fehlt. Folge: **Im Docker-Betrieb läuft kein Socket.IO-Server**; Echtzeit-Ereignisse kommen nicht an ([Kapitel 23](23-einschraenkungen-und-fragen.md#bekannte-einschränkungen)). In der Entwicklung mit `npm run dev:server` ist Socket.IO aktiv.

**Build.** Das `Dockerfile` hat drei Stufen: Abhängigkeiten (`npm ci`), Build (`prisma generate`, `next build` mit `output: "standalone"`, esbuild-Bündel für Server und Worker), Laufzeit auf `node:20-alpine` als Benutzer `nextjs` (UID 1001). App und Worker nutzen dasselbe Image. Typfehler brechen den Build ab (`typescript.ignoreBuildErrors: false`), ESLint läuft beim Build nicht.

## Verzeichnisstruktur

| Pfad | Inhalt |
| --- | --- |
| `src/app/(auth)` | Anmeldeseite |
| `src/app/(dashboard)` | alle Seiten der Kanzlei: `akten`, `kontakte`, `dokumente`, `kalender`, `email`, `bea`, `ki-chat`, `entwuerfe`, `finanzen`, `nachrichten`, `admin` usw. |
| `src/app/(portal)`, `src/app/(portal-public)` | Mandantenportal; öffentliche Seiten (Login, Aktivierung, Passwort-Reset) |
| `src/app/api` | API-Routen (Route Handler), z. B. `api/akten`, `api/helena`, `api/admin`, `api/health` |
| `src/components` | React-Komponenten nach Bereich, `ui/` mit shadcn/ui-Bausteinen |
| `src/lib` | Fachlogik: `fristen/` (Fristenrechner), `finance/` (RVG, Rechnungen, DATEV, SEPA), `helena/` (Agent), `ai/` (Anbieter, Scans), `email/`, `bea/`, `jlawyer/`, `portal/`, `queue/`, `socket/`, `gamification/`, `xjustiz/`, `rbac.ts`, `db.ts`, `storage.ts`, `logger.ts` |
| `src/workers/processors`, `src/lib/queue/processors` | Job-Verarbeitung für den Worker |
| `src/middleware.ts` | Anmeldepflicht und Zwei-Faktor-Pflicht für alle Routen außer den ausgenommenen |
| `prisma/` | `schema.prisma`, `migrations/` (Prisma plus `manual_*.sql`), `seed.ts`, `apply-manual-migrations.js` |
| `scripts/` | esbuild-Skripte für Server und Worker |
| `tests/` | Akzeptanztest der PII-Erkennung |
| `docs/` | dieses Handbuch, Screenshots |
| `.github/workflows/ci.yml` | Typecheck und Tests |

## Datenmodell

`prisma/schema.prisma` ist die einzige Quelle für das Datenmodell: 86 Modelle, 55 Aufzählungen, PostgreSQL mit der Erweiterung `vector`. Die wichtigsten:

| Bereich | Modelle |
| --- | --- |
| Kanzlei und Benutzer | `Kanzlei`, `User` (Rollen `ADMIN`, `ANWALT`, `SACHBEARBEITER`, `SEKRETARIAT`, `MANDANT`), `UserSettings`, `Dezernat`, `AdminOverride`, `UrlaubZeitraum` |
| Akten | `Akte` (Status `OFFEN`, `RUHEND`, `ARCHIVIERT`, `GESCHLOSSEN`), `Beteiligter`, `AktenActivity`, `AkteNorm` |
| Kontakte | `Kontakt`, `Adresse`, `KontaktBeziehung`, `Vollmacht`, `IdentitaetsPruefung`, `KontaktFeldDefinition` |
| Dokumente | `Dokument` (Status `ENTWURF`, `ZUR_PRUEFUNG`, `FREIGEGEBEN`, `VERSENDET`), `DokumentVersion`, `DokumentVorlage`, `Briefkopf`, `OrdnerSchema` |
| Kalender | `KalenderEintrag` (Typ `TERMIN`, `FRIST`, `WIEDERVORLAGE`, `FOKUSZEIT`), `FristPreset`, `CalDavKonto` |
| Finanzen | `Zeiterfassung`, `Rechnung`, `AktenKontoBuchung`, `Mahnung`, `BankTransaktion`, `RvgBerechnung`, `Nummernkreis` |
| Kommunikation | `EmailKonto`, `EmailNachricht`, `EmailAnhang`, `BeaNachricht`, `Ticket`, `Channel`, `Message` |
| Helena und Wissen | `HelenaTask`, `HelenaDraft`, `HelenaAlert`, `HelenaMemory`, `PendingSchriftsatz`, `DocumentChunk`, `LawChunk`, `UrteilChunk`, `Muster`, `MusterChunk` (Vektoren `vector(1024)`) |
| System | `AuditLog`, `SystemSetting`, `Notification`, `TokenUsage` |
| Portal | `PortalInvite` |
| Gamification | `UserGameProfile`, `Quest`, `QuestCompletion`, `Bossfight`, `ShopItem`, `WeeklySnapshot` |

Die HNSW-Indizes für die Vektorsuche und einige Tabellen der Gamification stehen nicht in Prisma-Migrationen, sondern in `prisma/migrations/manual_*.sql`. Sie werden beim Containerstart idempotent eingespielt.

## Fachliche Sperren in der Datenbankschicht

`src/lib/db.ts` erweitert den Prisma-Client mit `$extends` um eine Regel für das Modell `Dokument`, gestützt auf die BRAK-Hinweise 2025 zum KI-Einsatz und § 43 BRAO:

- **Beim Anlegen:** Hat ein Dokument `erstelltDurch = "ai"`, wird der Status zwingend auf `ENTWURF` gesetzt, gleich was der Aufrufer angibt.
- **Beim Ändern:** Soll ein KI-Dokument einen anderen Status als `ENTWURF` bekommen, ohne dass in derselben Änderung `freigegebenDurchId` (ein freigebender Mensch) gesetzt wird, bleibt es `ENTWURF`.

Die Regel greift nur bei `create` und `update` über den erweiterten Client. Aller Code soll deshalb `prisma` aus `@/lib/db` verwenden (Typ `ExtendedPrismaClient`), nie einen eigenen `PrismaClient`. Massenoperationen wie `updateMany` sind von der Regel nicht erfasst.

Weitere feste Grenzen stehen im Kopf von `src/lib/ai/provider.ts`: Helena versendet nichts, gibt keine Dokumente frei, aktiviert keine Fristen, löscht nichts, ändert keine Buchungen und keine Rollen. Durchgesetzt wird das über die Auswahl der Werkzeuge: Es gibt schlicht keine Werkzeuge dafür.

## Rechte

Die Rechte je Rolle stehen fest im Code (`src/lib/rbac.ts`, `PERMISSIONS`) und sind nicht konfigurierbar. API-Routen prüfen sie mit `requireAuth`, `requireRole`, `requirePermission` und `requireAkteAccess`. Der Admin-Bereich prüft die Rolle zusätzlich im Layout (`src/app/(dashboard)/admin/layout.tsx`). Einzelheiten für Anwender: [Kapitel 15](15-benutzer-und-rollen.md).

## Helena in Kürze

Die Bedienung beschreibt [Kapitel 9](09-helena.md). Technisch:

- **Agent:** `src/lib/helena/orchestrator.ts` nutzt `generateText` des Vercel AI SDK v4 mit Werkzeugen. Höchstens 5 Schritte und 30 Sekunden im Chat (`inline`), 20 Schritte und 180 Sekunden für Hintergrundaufgaben. Dazu Erkennung von Endlosschleifen (`stall-detector.ts`), Token-Budget (`token-budget.ts`) und Ratenbegrenzung über Redis.
- **Werkzeuge:** 18 in `src/lib/helena/tools/`: 12 lesende (Akte, Dokumente, Fristen, Zeiten, Suche in Gesetzen, Urteilen, Mustern und allen Akten, Kostenregeln, Websuche) und 6 schreibende, die nur Entwürfe, Notizen und Warnungen anlegen. Die Websuche ist ein Platzhalter ohne Funktion. Welche Werkzeuge eine Rolle bekommt, regelt `role-filter.ts`: ADMIN und ANWALT alle, SACHBEARBEITER ohne `update_akte_rag`, SEKRETARIAT nur lesend plus `create_notiz`.
- **Schriftsätze:** keine freie Agentenschleife, sondern eine feste Pipeline in `src/lib/helena/schriftsatz/` (Absicht erkennen, Klageart, Platzhalter füllen, Rückfragen über `PendingSchriftsatz`).
- **Wissen:** Hybrid-Suche aus pgvector und Volltext über Gesetze, Urteile, Muster und Aktendokumente, danach Reranking mit einem Sprachmodell über Ollama (`src/lib/ai/reranker.ts`). Muster laufen vor der Aufnahme durch eine Erkennung personenbezogener Daten (`src/lib/pii/ner-filter.ts`, Warteschlange `ner-pii`).
- **Anbieter:** `src/lib/ai/provider.ts` liest Anbieter, Modell und Schlüssel aus `SystemSetting`.

## Entwicklungsumgebung

Voraussetzungen: Node.js 20, npm, Docker.

1. Abhängigkeiten und Prisma-Client:
   ```bash
   npm install
   npm run db:generate
   ```
2. Hilfsdienste aus der Compose-Datei starten:
   ```bash
   docker compose up -d db redis minio meilisearch
   ```
   OnlyOffice, Stirling-PDF und Ollama brauchen Sie nur, wenn Sie diese Bereiche anfassen.
3. `.env` aus `.env.example` anlegen. Die Vorlage ist auf `localhost` ausgelegt. Für Ollama auf dem eigenen Rechner `OLLAMA_URL=http://localhost:11434`, für OnlyOffice in Docker `APP_INTERNAL_URL=http://host.docker.internal:3000` (macOS/Windows).
4. Datenbank aufbauen, manuelle SQL einspielen, Beispieldaten anlegen:
   ```bash
   npx prisma migrate deploy && npm run db:push
   node prisma/apply-manual-migrations.js
   npm run db:seed
   ```
5. Starten:
   ```bash
   npm run dev:server   # Next.js + Socket.IO auf :3000
   npm run dev:worker   # Worker mit Neustart bei Änderungen
   ```

Die Skripte aus `package.json`:

| Skript | Befehl | Zweck |
| --- | --- | --- |
| `dev` | `next dev --turbo` | Oberfläche und API, **ohne** Socket.IO |
| `dev:server` | `tsx --watch src/server.ts` | eigener Server mit Socket.IO |
| `dev:worker` | `tsx --watch src/worker.ts` | Worker |
| `build` / `start` | `next build` / `next start` | Produktionsbuild von Next.js |
| `build:server`, `build:worker`, `build:custom` | esbuild nach `dist-server/` bzw. `dist-worker/` | Bündel für den eigenen Server und den Worker |
| `lint` | `next lint` | ESLint |
| `db:migrate` | `prisma migrate dev` | neue Migration erzeugen |
| `db:push` | `prisma db push` | Schema ohne Migration übernehmen |
| `db:seed` | `prisma db seed` (`tsx prisma/seed.ts`) | Beispieldaten |
| `db:studio` | `prisma studio` | Datenbank im Browser ansehen |
| `db:generate` | `prisma generate` | Prisma-Client erzeugen |
| `test` / `test:watch` | `vitest run` / `vitest` | Unit-Tests |

Für Schemaänderungen: Modell in `schema.prisma` ändern, `npm run db:migrate -- --name <beschreibung>` ausführen und die erzeugte Migration mit einchecken. Die Lücken in den bisherigen Migrationen (siehe [Kapitel 23](23-einschraenkungen-und-fragen.md)) sollen dabei nicht größer werden.

## Tests

Unit-Tests laufen mit vitest (`vitest.config.ts`: Umgebung `node`, Alias `@` auf `src`). Stand dieses Handbuchs: 15 Testdateien, **442 Tests bestanden, 10 übersprungen**, Laufzeit wenige Sekunden. Abgedeckt sind vor allem Fristenrechner, RVG-Berechnung, Rechnungen und E-Rechnung, Aktenkonto, DATEV-Export, XJustiz, beA-Hilfen, Helena-Bausteine, Gamification, Systemwarnungen und TOTP. Der Akzeptanztest der PII-Erkennung in `tests/pii/` braucht ein laufendes Ollama und läuft nur mit `RUN_OLLAMA_TESTS=1`, sonst wird er übersprungen. Oberflächen- und End-to-End-Tests gibt es nicht. Gemessen an der Codegröße ist die Abdeckung gering.

```bash
npm test                 # einmal
npm run test:watch       # bei Änderungen
npx tsc --noEmit         # Typecheck
```

**CI:** `.github/workflows/ci.yml` („Tests & Typecheck“) läuft bei jedem Push auf `main` und bei Pull Requests auf `ubuntu-latest` mit Node 20: `npm ci`, `npx prisma generate`, `npx tsc --noEmit`, `npx vitest run`. Zeitlimit 20 Minuten. Docker-Build und Lint laufen in der CI nicht.

## Beitragen

AI-Lawyer steht unter der MIT-Lizenz. Eine eigene Beitragsrichtlinie gibt es nicht. Bewährt hat sich:

1. Fehler oder Vorschlag zuerst als Issue im Repository beschreiben.
2. Änderungen auf einem eigenen Branch, kleine Commits.
3. Vor dem Pull Request lokal `npx tsc --noEmit` und `npm test` ausführen; die CI prüft dasselbe.
4. Oberflächentexte auf Deutsch, Kommentare im Code auf Englisch, wie im Bestand.
5. Für Fachlogik mit Rechtsbezug (Fristen, Gebühren, Freigaben) Tests mitliefern.
6. Keine Zugangsdaten oder Mandantendaten in Commits, Issues oder Testdaten.

---

Weiter: [23 — Einschränkungen und häufige Fragen](23-einschraenkungen-und-fragen.md) · [Zur Übersicht](README.md)
