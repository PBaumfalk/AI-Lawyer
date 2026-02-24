import { Suspense } from "react";
import type { Metadata } from "next";
import { SearchPage } from "@/components/search/search-page";

export const metadata: Metadata = {
  title: "Dokumentensuche",
  description: "Volltextsuche ueber alle Dokumente mit Filtern und OCR-Text",
};

export default function SuchePage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Suspense fallback={<SearchPageSkeleton />}>
        <SearchPage />
      </Suspense>
    </div>
  );
}

function SearchPageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-48" />
        <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-72" />
      </div>
      <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded-xl" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-24 bg-slate-100 dark:bg-slate-800 rounded-lg"
          />
        ))}
      </div>
    </div>
  );
}
