"use client";

import { FileText, FolderOpen } from "lucide-react";
import Link from "next/link";

export interface SourceData {
  index: number;
  dokumentId: string;
  name: string;
  akteAktenzeichen: string;
  passage: string;
  score: number;
}

interface SourceCitationsProps {
  sources: SourceData[];
}

/**
 * Renders numbered source citations below an assistant message.
 * Each source links to the document detail page and shows
 * the Akte badge and a text excerpt.
 */
export function SourceCitations({ sources }: SourceCitationsProps) {
  if (!sources || sources.length === 0) {
    return (
      <p className="text-[10px] text-muted-foreground italic">
        Keine Quellenverweise
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        Quellen
      </p>
      {sources.map((src) => (
        <div
          key={`source-${src.index}`}
          className="flex items-start gap-2 text-xs"
        >
          {/* Number badge */}
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 flex items-center justify-center text-[10px] font-bold mt-0.5">
            {src.index}
          </span>

          <div className="min-w-0 flex-1">
            {/* Document name (link) */}
            <Link
              href={`/dokumente/${src.dokumentId}`}
              className="flex items-center gap-1 text-brand-600 dark:text-brand-400 hover:underline font-medium"
            >
              <FileText className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{src.name}</span>
            </Link>

            {/* Akte badge */}
            {src.akteAktenzeichen && (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                <FolderOpen className="w-2.5 h-2.5" />
                {src.akteAktenzeichen}
              </span>
            )}

            {/* Passage excerpt */}
            <p className="text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
              {src.passage}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
