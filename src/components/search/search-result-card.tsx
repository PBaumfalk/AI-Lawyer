"use client";

import Link from "next/link";
import {
  FileText,
  FileImage,
  FileSpreadsheet,
  File,
  CalendarDays,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface SearchResult {
  id: string;
  name: string;
  akteId: string;
  aktenzeichen: string;
  kurzrubrum: string;
  mimeType: string;
  ocrStatus: string | null;
  dokumentStatus: string | null;
  tags: string[];
  createdByName: string;
  createdAt: number;
  snippet: string | null;
  nameHighlighted: string;
  score: number | null;
}

/** OCR status label mapping */
const OCR_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  AUSSTEHEND: {
    label: "OCR ausstehend",
    className: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  },
  IN_BEARBEITUNG: {
    label: "OCR laeuft",
    className: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  },
  ABGESCHLOSSEN: {
    label: "OCR fertig",
    className: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
  },
  FEHLGESCHLAGEN: {
    label: "OCR fehlgeschlagen",
    className: "bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400",
  },
};

/** Get a document type icon based on MIME type */
function getDocIcon(mimeType: string) {
  if (mimeType === "application/pdf") return FileText;
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel"))
    return FileSpreadsheet;
  return File;
}

/** Format a Unix timestamp to German date string */
function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Google-style rich snippet search result card.
 * Shows document name (highlighted), case link, OCR snippet,
 * badges, tags, and relevance score.
 */
export function SearchResultCard({ result }: { result: SearchResult }) {
  const DocIcon = getDocIcon(result.mimeType);
  const ocrInfo = result.ocrStatus
    ? OCR_STATUS_LABELS[result.ocrStatus]
    : null;

  return (
    <div className="group rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:border-brand-300 dark:hover:border-brand-600 hover:shadow-sm transition-all">
      {/* Title line */}
      <div className="flex items-start gap-3">
        <DocIcon className="w-5 h-5 mt-0.5 text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <Link
            href={`/akten/${result.akteId}/dokumente/${result.id}`}
            className="text-sm font-medium text-brand-700 dark:text-brand-400 hover:underline"
          >
            <span
              dangerouslySetInnerHTML={{ __html: result.nameHighlighted }}
              className="[&>mark]:bg-yellow-200 [&>mark]:text-yellow-900 dark:[&>mark]:bg-yellow-900/40 dark:[&>mark]:text-yellow-200 [&>mark]:rounded-sm [&>mark]:px-0.5"
            />
          </Link>

          {/* Meta line: case, date, uploader */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
            <Link
              href={`/akten/${result.akteId}`}
              className="hover:text-foreground transition-colors"
            >
              <span className="font-mono">{result.aktenzeichen}</span>
              {result.kurzrubrum && (
                <span className="ml-1">-- {result.kurzrubrum}</span>
              )}
            </Link>

            <span className="flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              {formatDate(result.createdAt)}
            </span>

            {result.createdByName && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {result.createdByName}
              </span>
            )}

            {/* Relevance score */}
            {result.score != null && (
              <span className="ml-auto text-[10px] text-muted-foreground/60">
                {Math.round(result.score * 100)}% Relevanz
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Snippet */}
      <div className="mt-2 ml-8">
        {result.snippet ? (
          <p
            className="text-xs text-muted-foreground line-clamp-3 leading-relaxed [&>mark]:bg-yellow-200 [&>mark]:text-yellow-900 dark:[&>mark]:bg-yellow-900/40 dark:[&>mark]:text-yellow-200 [&>mark]:rounded-sm [&>mark]:px-0.5"
            dangerouslySetInnerHTML={{ __html: result.snippet }}
          />
        ) : (
          <p className="text-xs text-muted-foreground/50 italic">
            Kein Textinhalt
          </p>
        )}
      </div>

      {/* Badges + tags */}
      <div className="mt-2 ml-8 flex flex-wrap items-center gap-1.5">
        {ocrInfo && (
          <Badge
            variant="secondary"
            className={`text-[10px] ${ocrInfo.className}`}
          >
            {ocrInfo.label}
          </Badge>
        )}

        {result.dokumentStatus && (
          <Badge
            variant="secondary"
            className="text-[10px]"
          >
            {result.dokumentStatus}
          </Badge>
        )}

        {result.tags.map((tag) => (
          <Badge
            key={tag}
            variant="outline"
            className="text-[10px] border-brand-200 text-brand-600 dark:border-brand-800 dark:text-brand-400"
          >
            {tag}
          </Badge>
        ))}
      </div>
    </div>
  );
}
