"use client";

import { VorlagenUebersicht } from "@/components/vorlagen/vorlagen-uebersicht";

/**
 * Page route for /vorlagen -- template browser with card-based overview and wizard.
 */
export default function VorlagenPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Dokumentvorlagen
        </h1>
        <p className="text-muted-foreground mt-1">
          Vorlagen durchsuchen und Dokumente generieren
        </p>
      </div>
      <VorlagenUebersicht />
    </div>
  );
}
