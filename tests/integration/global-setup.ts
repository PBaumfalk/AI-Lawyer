import { execSync } from 'node:child_process'

export default function setup() {
  const url = process.env.TEST_DATABASE_URL
  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL fehlt. Beispiel: docker run -d -p 55433:5432 -e POSTGRES_USER=test ' +
        '-e POSTGRES_PASSWORD=test -e POSTGRES_DB=test pgvector/pgvector:pg16',
    )
  }
  if (!/test/i.test(new URL(url).pathname + new URL(url).username)) {
    // Guard against wiping a real database by accident.
    throw new Error(`TEST_DATABASE_URL muss auf eine Testdatenbank zeigen (enthält "test"): ${url}`)
  }
  const env = { ...process.env, DATABASE_URL: url }
  const run = (cmd: string) => execSync(cmd, { env, stdio: 'pipe' }).toString()

  run(`npx prisma db execute --url "${url}" --stdin <<'SQL'\nDROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;\nSQL`)
  run('npx prisma migrate deploy')
  run('node prisma/apply-manual-migrations.js')
  process.env.DATABASE_URL = url
}
