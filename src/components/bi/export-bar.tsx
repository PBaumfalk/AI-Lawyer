"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { BiFilterParams } from "@/lib/bi/types";

interface ExportBarProps {
  filters: BiFilterParams;
}

function buildQueryString(filters: BiFilterParams): string {
  const params = new URLSearchParams();
  params.set("zeitraum", filters.zeitraum);
  if (filters.von) params.set("von", filters.von);
  if (filters.bis) params.set("bis", filters.bis);
  if (filters.anwaltId) params.set("anwaltId", filters.anwaltId);
  if (filters.sachgebiet) params.set("sachgebiet", filters.sachgebiet);
  return params.toString();
}

async function triggerDownload(url: string, fallbackFilename: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.error || `Export fehlgeschlagen (${response.status})`);
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);

  // Extract filename from Content-Disposition or use fallback
  const disposition = response.headers.get("Content-Disposition");
  let filename = fallbackFilename;
  if (disposition) {
    const match = disposition.match(/filename="?([^";\n]+)"?/);
    if (match) filename = match[1];
  }

  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

export function ExportBar({ filters }: ExportBarProps) {
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingXlsx, setLoadingXlsx] = useState(false);

  const qs = buildQueryString(filters);

  async function handlePdfExport() {
    setLoadingPdf(true);
    try {
      await triggerDownload(`/api/bi/export/pdf?${qs}`, "bi-report.pdf");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PDF-Export fehlgeschlagen");
    } finally {
      setLoadingPdf(false);
    }
  }

  async function handleXlsxExport() {
    setLoadingXlsx(true);
    try {
      await triggerDownload(`/api/bi/export/xlsx?${qs}`, "bi-report.xlsx");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Excel-Export fehlgeschlagen");
    } finally {
      setLoadingXlsx(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handlePdfExport}
        disabled={loadingPdf}
      >
        {loadingPdf ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileText className="mr-2 h-4 w-4" />
        )}
        PDF-Report
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleXlsxExport}
        disabled={loadingXlsx}
      >
        {loadingXlsx ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="mr-2 h-4 w-4" />
        )}
        Excel-Report
      </Button>
    </div>
  );
}
