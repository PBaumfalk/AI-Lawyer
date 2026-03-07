/**
 * Apply manual SQL migration files that Prisma migrate deploy cannot handle.
 * All statements are idempotent (IF NOT EXISTS / EXCEPTION WHEN duplicate_object).
 * Called from docker-entrypoint.sh after prisma migrate deploy.
 */
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

async function main() {
  const prisma = new PrismaClient();
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

    try {
      for (const statement of statements) {
        await prisma.$executeRawUnsafe(statement);
      }
      console.log(`    ✓ ${file}`);
    } catch (err) {
      // Log but don't fail — statements are idempotent, some may partially apply
      console.error(`    ⚠ ${file}: ${err.message}`);
    }
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Manual migration failed:", err.message);
  process.exit(0); // Non-fatal — prisma db push may have already applied these
});
