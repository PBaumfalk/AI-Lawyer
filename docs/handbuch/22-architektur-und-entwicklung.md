# 22 — Architektur und Entwicklung

Dieses Kapitel erklärt, wie AI-Lawyer aufgebaut ist, wo im Code was liegt und wie Sie eine Entwicklungsumgebung aufsetzen. Es richtet sich an die IT und an alle, die Fehler eingrenzen oder beitragen wollen.

## Überblick

AI-Lawyer ist eine TypeScript-Anwendung auf Basis von Next.js 14 (App Router). Rund 158 000 Zeilen in `src/`, 220 API-Routen, 86 Datenmodelle. Zwei eigene Prozesse und sieben Fremddienste arbeiten zusammen:

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
| **app** | `src/server.ts` (eigener Server), gebündelt nach `dist-server/index.js` | Seiten, API-Routen, Anmeldung und Socket.IO am selben HTTP-Server |
| **worker** | `src/worker.ts`, gebündelt nach `dist-worker/index.js` | 20 BullMQ-Warteschlangen, Cron-Jobs, dauerhafte IMAP-Verbindungen ([Kapitel 21](21-betrieb-und-sicherung.md#hintergrund-jobs)). Im selben Build entsteht `dist-worker/reindex-suche.mjs` aus `src/cli/reindex-suche.ts` (Suchindex-Neuaufbau ohne Anmeldung, von `scripts/restore.sh` genutzt) |

**Eigener Server und Socket.IO.** `src/server.ts` startet Next.js und hängt Socket.IO mit Redis-Adapter an denselben HTTP-Server (`src/lib/socket/server.ts`). Die Anmeldung am Socket prüft das NextAuth-JWT aus dem Cookie (`src/lib/socket/auth.ts`). Räume: `user:{id}`, `role:{ROLLE}`, `kanzlei:{id}` automatisch, `akte:{id}`, `mailbox:{id}`, `channel:{id}` bei Bedarf (`src/lib/socket/rooms.ts`). Der Worker sendet Ereignisse über `@socket.io/redis-emitter` (`src/lib/socket/emitter.ts`).

Das `Dockerfile` startet mit `CMD ["node", "dist-server/index.js"]` den eigenen Server. Er läuft auf der Standalone-Ausgabe von Next.js und übergibt wie der generierte Standalone-Server die beim Build eingefrorene Next-Konfiguration, damit Next.js zur Laufzeit kein webpack nachladen muss. Damit ist Socket.IO auch im Docker-Betrieb aktiv. In der Entwicklung startet `npm run dev:server` denselben Server.

**Build.** Das `Dockerfile` hat drei Stufen: Abhängigkeiten (`npm ci`), Build (`prisma generate`, `next build` mit `output: "standalone"`, esbuild-Bündel für Server und Worker), Laufzeit auf `node:20-alpine` als Benutzer `nextjs` (UID 1001). App und Worker nutzen dasselbe Image. `NEXT_PUBLIC_KANZLEI_NAME` ist ein Build-Argument (in `docker-compose.yml` aus `KANZLEI_NAME`), weil Next.js `NEXT_PUBLIC_*`-Werte beim Build einsetzt. Typfehler brechen den Build ab (`typescript.ignoreBuildErrors: false`), ESLint läuft beim Build nicht.

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
| `src/middleware.ts` | Anmeldepflicht und Zwei-Faktor-Pflicht für alle Routen außer den ausgenommenen; Mandantenkonten nur im Portal; API-Aufrufe ohne Sitzung erhalten 401 |
| `prisma/` | `schema.prisma`, `migrations/` (Prisma-Migrationen plus `manual_*.sql` für pgvector-Indizes), `seed.ts`, `apply-manual-migrations.js` |
| `scripts/` | esbuild-Skripte für Server und Worker |
| `tests/` | `integration/` (gegen echte PostgreSQL und Redis), `arch/` (Architekturtests), `pii/` (Akzeptanztest der PII-Erkennung); Unit-Tests liegen als `*.test.ts` neben dem Code in `src/` |
| `docs/` | dieses Handbuch, Screenshots |
| `.github/workflows/ci.yml` | Typecheck, Lint, Unit-, Architektur- und Integrationstests, Produktions-Build, Prüfung der Compose-Dateien |

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

Die Prisma-Migrationen bilden das Schema vollständig ab; die Migration `20261118120000_schema_sync` hat alles nachgeholt, was früher nur per `db push` oder über manuelle SQL-Dateien in Datenbanken kam (Portal, Gamification, Einladungs- und Reset-Felder). Nur die HNSW-Indizes für die Vektorsuche stehen weiterhin in `prisma/migrations/manual_*.sql`. Sie werden beim Containerstart idempotent eingespielt; ein Fehler bricht den Start ab. Ein Integrationstest (`tests/integration/schema-drift.test.ts`) prüft, dass Migrationen und `schema.prisma` übereinstimmen.

## Fachliche Sperren in der Datenbankschicht

`src/lib/db.ts` erweitert den Prisma-Client mit `$extends` um eine Regel für das Modell `Dokument`, gestützt auf die BRAK-Hinweise 2025 zum KI-Einsatz und § 43 BRAO:

- **Beim Anlegen:** Hat ein Dokument `erstelltDurch = "ai"`, wird der Status zwingend auf `ENTWURF` gesetzt, gleich was der Aufrufer angibt.
- **Beim Ändern:** Soll ein KI-Dokument einen anderen Status als `ENTWURF` bekommen, ohne dass in derselben Änderung `freigegebenDurchId` (ein freigebender Mensch) gesetzt wird, bleibt es `ENTWURF`.

Die Regel greift nur bei `create` und `update` über den erweiterten Client. Aller Code soll deshalb `prisma` aus `@/lib/db` verwenden (Typ `ExtendedPrismaClient`), nie einen eigenen `PrismaClient`. Massenoperationen wie `updateMany` sind von der Regel nicht erfasst.

Weitere feste Grenzen stehen im Kopf von `src/lib/ai/provider.ts`: Helena versendet nichts, gibt keine Dokumente frei, aktiviert keine Fristen, löscht nichts, ändert keine Buchungen und keine Rollen. Durchgesetzt wird das über die Auswahl der Werkzeuge: Es gibt schlicht keine Werkzeuge dafür.

## Rechte

Die Rechte je Rolle stehen fest im Code (`src/lib/rbac.ts`, `PERMISSIONS`) und sind nicht konfigurierbar. API-Routen prüfen sie mit `requireAuth`, `requireRole`, `requirePermission` und `requireAkteAccess` (wertet auch `requireEdit` und `requireDelete` aus). Listen und Suchen filtern zentral nach Aktenrechten (`aktenListWhere`, `ticketAccessWhere`, Volltextsuche nur über `searchDokumenteForUser`). Löschen ohne Aktenbezug sperrt `loeschenVerweigert()` für Rollen ohne `canLoeschen`. Die Middleware hält Mandantenkonten aus allen Bereichen außerhalb des Portals heraus, das Dashboard-Layout sperrt sie zusätzlich. Der Admin-Bereich prüft die Rolle zusätzlich im Layout (`src/app/(dashboard)/admin/layout.tsx`). Architekturtests in `tests/arch/` prüfen, dass jede Route mit Aktenbezug und jeder DELETE-Handler eine solche Prüfung enthält. Einzelheiten für Anwender: [Kapitel 15](15-benutzer-und-rollen.md).

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
   Die Compose-Datei verlangt dafür eine `.env` mit allen Geheimnissen (Schritt 3 vorher ausführen).
3. `.env` mit `./setup.sh` (Start ablehnen) oder aus `.env.example` anlegen. Der Abschnitt „Nur lokale Entwicklung“ ist auf `localhost` ausgelegt; `DATABASE_URL` und `REDIS_URL` müssen die Passwörter aus `POSTGRES_PASSWORD` und `REDIS_PASSWORD` enthalten (`setup.sh` trägt sie selbst ein). Für Ollama auf dem eigenen Rechner `OLLAMA_URL=http://localhost:11434`, für OnlyOffice in Docker `APP_INTERNAL_URL=http://host.docker.internal:3000` (macOS/Windows).
4. Datenbank aufbauen, manuelle SQL einspielen, Beispieldaten anlegen:
   ```bash
   npx prisma migrate deploy
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
| `db:push` | `prisma db push` | Schema ohne Migration übernehmen; nur für Experimente, nicht für Datenbanken, die mit Migrationen weiterlaufen sollen |
| `db:seed` | `prisma db seed` (`tsx prisma/seed.ts`) | Beispieldaten |
| `db:studio` | `prisma studio` | Datenbank im Browser ansehen |
| `db:generate` | `prisma generate` | Prisma-Client erzeugen |
| `test` / `test:watch` | `vitest run` / `vitest` | Unit- und Architekturtests |
| `test:integration` | `vitest run --config vitest.integration.config.ts` | Integrationstests gegen PostgreSQL und Redis |

Für Schemaänderungen: Modell in `schema.prisma` ändern, `npm run db:migrate -- --name <beschreibung>` ausführen und die erzeugte Migration mit einchecken. Nie `db push` statt einer Migration verwenden: Der Schema-Drift-Test der Integrationstests schlägt dann fehl.

## Tests

Es gibt zwei Testläufe mit vitest:

**Unit- und Architekturtests** (`vitest.config.ts`: Umgebung `node`, Alias `@` auf `src`, Integrationstests ausgeschlossen). Stand dieses Handbuchs: 26 Testdateien, **599 Tests bestanden, 10 übersprungen**, Laufzeit rund 15 Sekunden. Abgedeckt sind vor allem Fristenrechner und Feiertage, RVG-Berechnung, Rechnungen und E-Rechnung, Aktenkonto, DATEV-Export, XJustiz, beA-Hilfen, Helena-Bausteine, Gamification, Systemwarnungen, TOTP, die Middleware und die Zugriffsregeln. Architekturtests prüfen den Code selbst, z. B. dass jede API-Route mit Aktenbezug den Aktenzugriff prüft und jeder DELETE-Handler das Löschrecht. Der Akzeptanztest der PII-Erkennung in `tests/pii/` braucht ein laufendes Ollama und läuft nur mit `RUN_OLLAMA_TESTS=1`, sonst wird er übersprungen.

**Integrationstests** (`vitest.integration.config.ts`, Dateien in `tests/integration/`) laufen gegen eine echte PostgreSQL-Datenbank mit pgvector und gegen Redis. Die Vorbereitung leert die Testdatenbank und baut das Schema genau wie der Container auf (`prisma migrate deploy` plus manuelle SQL). Darunter sind der **Schema-Drift-Test** (Migrationen ergeben exakt `schema.prisma`) und der **Raw-SQL-Test** (jede rohe SQL-Abfrage im Code wird per `PREPARE` gegen das echte Schema geprüft), dazu Tests für Aktenzugriff, Löschrecht, Finanzen, Kalender und Fristen, E-Mail-Versand, beA-Versand, Portal, BI, DSGVO, Vorlagen, Helena und die j-lawyer-Migration. Stand dieses Handbuchs: 22 Testdateien, 188 Tests.

Oberflächen- und End-to-End-Tests im Browser gibt es nicht.

```bash
npx vitest run           # Unit- und Architekturtests (wie npm test)
npm run test:watch       # bei Änderungen
npx tsc --noEmit         # Typecheck

# Integrationstests: leere Testdatenbank, wird dabei gelöscht!
TEST_DATABASE_URL=postgresql://test:test@localhost:55433/test \
TEST_REDIS_URL=redis://localhost:6379 \
  npm run test:integration
```

Verwenden Sie für `TEST_DATABASE_URL` nie die Datenbank der Kanzlei: Die Vorbereitung löscht ihren Inhalt.

**CI:** `.github/workflows/ci.yml` („Tests & Typecheck“) läuft bei jedem Push auf `main` und bei Pull Requests auf `ubuntu-latest` mit Node 20, in drei Jobs:

| Job | Inhalt |
| --- | --- |
| **Typecheck, Lint, Unit-Tests** (`unit`) | `npm ci`, `npx prisma generate`, `npx tsc --noEmit`, `npx next lint --max-warnings 347`, `npx vitest run` |
| **Integrationstests (PostgreSQL + Redis)** (`integration`) | Dienste `pgvector/pgvector:pg16` und `redis:7-alpine`, dann `npm run test:integration` (inkl. Schema-Drift) |
| **Produktions-Build und Compose-Dateien** (`build`) | `npm run build`, `npm run build:custom` (Server- und Worker-Bündel), `docker compose config --quiet` für `docker-compose.yml`, dieselbe mit `docker-compose.gpu.yml` und `docker-compose.portainer.yml` |

Das Docker-Image selbst baut die CI nicht. Die Lint-Schwelle von 347 Warnungen entspricht dem heutigen Bestand; neue Warnungen lassen den Job scheitern.

## Beitragen

AI-Lawyer steht unter der MIT-Lizenz. Eine eigene Beitragsrichtlinie gibt es nicht. Bewährt hat sich:

1. Fehler oder Vorschlag zuerst als Issue im Repository beschreiben.
2. Änderungen auf einem eigenen Branch, kleine Commits.
3. Vor dem Pull Request lokal `npx tsc --noEmit`, `npm test` und nach Möglichkeit `npm run test:integration` ausführen; die CI prüft dasselbe.
4. Oberflächentexte auf Deutsch, Kommentare im Code auf Englisch, wie im Bestand.
5. Für Fachlogik mit Rechtsbezug (Fristen, Gebühren, Freigaben) Tests mitliefern.
6. Keine Zugangsdaten oder Mandantendaten in Commits, Issues oder Testdaten.

---

Weiter: [23 — Einschränkungen und häufige Fragen](23-einschraenkungen-und-fragen.md) · [Zur Übersicht](README.md)
