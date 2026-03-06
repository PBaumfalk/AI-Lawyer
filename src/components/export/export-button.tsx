"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ExportFormat } from "@/lib/export/types";

interface ExportButtonProps {
  endpoint: string;
  formats?: ExportFormat[];
  label?: string;
  params?: Record<string, string>;
}

export function ExportButton({
  endpoint,
  formats = ["csv", "xlsx"],
  label = "Exportieren",
  params,
}: ExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  async function handleExport(format: ExportFormat) {
    setOpen(false);
    setLoading(true);
    try {
      const url = new URL(endpoint, window.location.origin);
      url.searchParams.set("format", format);
      if (params) {
        for (const [key, value] of Object.entries(params)) {
          if (value) url.searchParams.set(key, value);
        }
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.error || `Export fehlgeschlagen (${response.status})`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      // Extract filename from Content-Disposition or generate one
      const disposition = response.headers.get("Content-Disposition");
      let filename = `export.${format}`;
      if (disposition) {
        const match = disposition.match(/filename="?([^";\n]+)"?/);
        if (match) filename = match[1];
      }

      // Trigger download via hidden anchor
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Export fehlgeschlagen"
      );
    } finally {
      setLoading(false);
    }
  }

  // Single format: simple button
  if (formats.length === 1) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleExport(formats[0])}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Download className="mr-2 h-4 w-4" />
        )}
        {label}
      </Button>
    );
  }

  // Multiple formats: split button with dropdown
  return (
    <div className="relative inline-flex" ref={dropdownRef}>
      <Button
        variant="outline"
        size="sm"
        className="rounded-r-none"
        onClick={() => handleExport(formats[0])}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Download className="mr-2 h-4 w-4" />
        )}
        {label}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="rounded-l-none border-l-0 px-2"
        onClick={() => setOpen(!open)}
        disabled={loading}
      >
        <ChevronDown className="h-4 w-4" />
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[140px] rounded-md border bg-popover p-1 shadow-md">
          {formats.map((fmt) => (
            <button
              key={fmt}
              className="flex w-full items-center rounded-sm px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
              onClick={() => handleExport(fmt)}
            >
              {fmt.toUpperCase()}-Export
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
