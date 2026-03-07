/**
 * Apply manual SQL migration files that Prisma migrate deploy cannot handle.
 * All statements are idempotent (IF NOT EXISTS / EXCEPTION WHEN duplicate_object).
 * Called from docker-entrypoint.sh after prisma migrate deploy.
 *
 * Each statement runs in its own try/catch to avoid 25P02 transaction-abort
 * cascading across statements.
 */
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

async function main() {
  const migrationsDir = path.join(__dirname, "migrations");

  const manualFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.startsWith("manual_") && f.endsWith(".sql"))
    .sort();

  console.log(`    Found ${manualFiles.length} manual migration files`);

  for (const file of manualFiles) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, "utf8").trim();
    if (!sql) continue;

    const statements = sql
      .split(/;\s*(?:\r?\n|$)/)
      .map((s) => s.trim())
      .filter(Boolean);

    let fileOk = true;
    for (const statement of statements) {
      // Frische Prisma-Instanz pro Statement, damit ein Fehler nicht die
      // Transaction fuer nachfolgende Statements blockiert (25P02).
      const prisma = new PrismaClient();
      try {
        await prisma.$executeRawUnsafe(statement);
      } catch (err) {
        fileOk = false;
        console.error(`    ⚠ ${file}: ${err.message}`);
      } finally {
        await prisma.$disconnect();
      }
    }
    if (fileOk) {
      console.log(`    ✓ ${file}`);
    }
  }
}

main().catch((err) => {
  console.error("Manual migration failed:", err.message);
  process.exit(0); // Non-fatal
});
