# Browsertests (Playwright)

Prüfen Anmeldung, fehlgeschlagene Anmeldung, Drosselung, Ausfall des
Anmeldeschutzes, Benutzerverwaltung und Passwortwechsel im echten Browser
(lokal installiertes Google Chrome), jeweils auf Desktop (1280 × 800) und
schmalem Mobil-Viewport (390 × 844). Jeder Test legt Bildschirmfotos für die
Sichtprüfung ab.

`barrierefreiheit.spec.ts` prüft zusätzlich die Anmeldeseite und die
Hauptseiten mit axe-core (WCAG 2.1 A/AA); Verstöße „serious“/„critical“ lassen
den Test scheitern, kleinere stehen nur im Protokoll (`[axe] …`). Die Seite
mit der ersten Akte setzt mindestens eine Akte in der Testdatenbank voraus
(Demo-Seed).

**Nur gegen eine Testumgebung.** Die Tests legen Konten an, sperren Konten
durch Fehlversuche und können Redis anhalten.

## Testumgebung

1. Test-Datenbank und Redis, z. B.:

   ```bash
   docker run -d --name ailawyer-itest-db -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=test -p 55433:5432 pgvector/pgvector:pg16
   docker run -d --name ailawyer-itest-redis -p 56380:6379 redis:7-alpine
   docker exec ailawyer-itest-db psql -U test -d test -c "create database e2e_test"
   ```

2. Umgebung für den Server (Beispielwerte, keine echten Geheimnisse):

   ```bash
   export DATABASE_URL=postgresql://test:test@localhost:55433/e2e_test
   export REDIS_URL=redis://localhost:56380
   export NEXTAUTH_SECRET=e2e-secret-0123456789abcdef0123456789abcdef
   export NEXTAUTH_URL=http://localhost:3999 AUTH_TRUST_HOST=true
   export EMAIL_ENCRYPTION_KEY=$(printf '0%.0s' {1..64})
   export NODE_ENV=production PORT=3999 HOSTNAME=127.0.0.1 TRUST_PROXY_HOPS=0
   export SEED_DEMO=false INITIAL_ADMIN_EMAIL=chefin@kanzlei-test.de INITIAL_ADMIN_PASSWORD='Start-Passwort-2026!'
   export LOG_FILE_PATH=/tmp/ailawyer-e2e/app
   npx prisma migrate deploy && npx tsx prisma/seed.ts
   npm run build && npm run build:custom && node dist-server/index.js
   ```

3. Tests starten (zweites Terminal):

   ```bash
   E2E_ADMIN_EMAIL=chefin@kanzlei-test.de E2E_ADMIN_PASSWORD='Start-Passwort-2026!' \
   E2E_REDIS_URL=redis://localhost:56380 E2E_REDIS_CONTAINER=ailawyer-itest-redis \
   E2E_SCREENSHOT_DIR=test-results/screens npm run test:e2e
   ```

| Variable | Bedeutung |
| --- | --- |
| `E2E_BASE_URL` | Standard `http://127.0.0.1:3999` |
| `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` | Admin-Konto der Testdatenbank (Pflicht) |
| `E2E_REDIS_URL` | Test-Redis; vor dem Lauf werden dort die Anmeldezähler geleert |
| `E2E_REDIS_CONTAINER` | Name des Test-Redis-Containers; ohne ihn wird der Ausfalltest übersprungen |
| `E2E_SCREENSHOT_DIR` | Ablage der Bildschirmfotos (Standard `test-results/screens`) |
| `E2E_BROWSER_CHANNEL` | Standard `chrome` (lokal installiert); `chromium` nach `npx playwright install chromium` |
