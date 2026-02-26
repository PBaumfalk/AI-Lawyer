import { Suspense } from "react";
import type { Metadata } from "next";
import { SearchPage } from "@/components/search/search-page";

export const metadata: Metadata = {
  title: "Dokumentensuche",
  description: "Volltextsuche ueber alle Dokumente mit Filtern und OCR-Text",
};

export default function SuchePage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Suspense fallback={<SearchPageSkeleton />}>
        <SearchPage />
      </Suspense>
    </div>
  );
}

function SearchPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 glass-shimmer rounded w-48" />
        <div className="h-4 glass-shimmer rounded w-72" />
      </div>
      <div className="h-12 glass-shimmer rounded-xl" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-24 glass-shimmer rounded-xl"
          />
        ))}
      </div>
    </div>
  );
}
