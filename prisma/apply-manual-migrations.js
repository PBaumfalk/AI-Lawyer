/**
 * Apply manual SQL migration files that Prisma migrate deploy cannot handle.
 * All statements are idempotent (IF NOT EXISTS / EXCEPTION WHEN duplicate_object).
 * Called from docker-entrypoint.sh after prisma migrate deploy.
 *
 * We split SQL safely (respecting dollar-quoted blocks), then run each
 * statement in its own Prisma client to avoid 25P02 cascading failures.
 */
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

function splitSqlStatements(sql) {
  const statements = [];
  let current = "";
  let i = 0;
  let inSingle = false;
  let inDouble = false;
  let inDollar = false;
  let dollarTag = "";

  while (i < sql.length) {
    const ch = sql[i];

    if (inSingle) {
      current += ch;
      if (ch === "'") {
        if (sql[i + 1] === "'") {
          // Escaped single quote ('') inside string
          current += sql[i + 1];
          i += 2;
          continue;
        }
        inSingle = false;
      }
      i += 1;
      continue;
    }

    if (inDouble) {
      current += ch;
      if (ch === '"') {
        if (sql[i + 1] === '"') {
          // Escaped double quote ("") inside identifier
          current += sql[i + 1];
          i += 2;
          continue;
        }
        inDouble = false;
      }
      i += 1;
      continue;
    }

    if (inDollar) {
      if (sql.startsWith(dollarTag, i)) {
        current += dollarTag;
        i += dollarTag.length;
        inDollar = false;
        dollarTag = "";
        continue;
      }
      current += ch;
      i += 1;
      continue;
    }

    if (ch === "'") {
      inSingle = true;
      current += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inDouble = true;
      current += ch;
      i += 1;
      continue;
    }

    if (ch === "$" ) {
      const rest = sql.slice(i);
      const tagMatch = rest.match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if (tagMatch) {
        dollarTag = tagMatch[0];
        inDollar = true;
        current += dollarTag;
        i += dollarTag.length;
        continue;
      }
    }

    if (ch === ";") {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = "";
      i += 1;
      continue;
    }

    current += ch;
    i += 1;
  }

  const trimmed = current.trim();
  if (trimmed) statements.push(trimmed);
  return statements;
}

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

    const statements = splitSqlStatements(sql);

    let fileOk = true;
    for (const statement of statements) {
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
