"use client";

import { InvoiceList } from "@/components/finanzen/invoice-list";

export default function RechnungenPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Rechnungen</h1>
        <p className="text-muted-foreground mt-1">
          Alle Rechnungen verwalten, filtern und Mahnwesen steuern
        </p>
      </div>

      <InvoiceList />
    </div>
  );
}
