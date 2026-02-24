import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

interface LogEntry {
  timestamp: string;
  level: string;
  module: string;
  message: string;
  [key: string]: unknown;
}

// Pino level numbers to labels
const LEVEL_LABELS: Record<number, string> = {
  10: "TRACE",
  20: "DEBUG",
  30: "INFO",
  40: "WARN",
  50: "ERROR",
  60: "FATAL",
};

/**
 * GET /api/admin/logs — Read and return structured log lines.
 * Requires ADMIN role.
 *
 * Query params:
 *   lines  — Number of lines to return (default 200)
 *   level  — Filter by level: TRACE|DEBUG|INFO|WARN|ERROR|FATAL or "all"
 *   source — Filter by module: "app"|"worker" or "all"
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if ((session?.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const url = new URL(req.url);
  const maxLines = parseInt(url.searchParams.get("lines") || "200", 10);
  const levelFilter = url.searchParams.get("level") || "all";
  const sourceFilter = url.searchParams.get("source") || "all";

  // Determine log file path
  const logDir = process.env.LOG_FILE_PATH || "/var/log/ai-lawyer";
  const logFilePath = logDir.endsWith(".log") ? logDir : path.join(logDir, "app.log");

  // In development, log files may not exist (pino-pretty goes to stdout)
  if (!existsSync(logFilePath)) {
    return NextResponse.json({
      entries: [],
      total: 0,
      message:
        "Log-Datei nicht gefunden. Logs sind nur in der Produktionsumgebung verfuegbar.",
    });
  }

  try {
    const content = await readFile(logFilePath, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);

    let entries: LogEntry[] = [];

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        const levelNum = parsed.level;
        const levelLabel =
          typeof levelNum === "number"
            ? LEVEL_LABELS[levelNum] || "UNKNOWN"
            : String(levelNum).toUpperCase();

        const entry: LogEntry = {
          timestamp: parsed.time || parsed.timestamp || "",
          level: levelLabel,
          module: parsed.module || parsed.name || "app",
          message: parsed.msg || parsed.message || "",
          ...(parsed.err && { error: parsed.err }),
          ...(parsed.data && { data: parsed.data }),
        };

        // Apply level filter
        if (levelFilter !== "all" && entry.level !== levelFilter.toUpperCase()) {
          continue;
        }

        // Apply source filter
        if (sourceFilter !== "all" && entry.module !== sourceFilter) {
          continue;
        }

        entries.push(entry);
      } catch {
        // Skip malformed JSON lines
        continue;
      }
    }

    // Sort newest first and limit
    entries.reverse();
    entries = entries.slice(0, maxLines);

    return NextResponse.json({
      entries,
      total: entries.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Fehler beim Lesen der Log-Datei" },
      { status: 500 }
    );
  }
}
