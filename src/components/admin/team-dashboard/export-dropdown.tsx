"use client";

import { useState, useRef, useEffect } from "react";
import { Download, FileText, FileSpreadsheet } from "lucide-react";

interface ExportDropdownProps {
  monthLabel: string; // e.g., "Februar 2026"
}

export function ExportDropdown({ monthLabel }: ExportDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function handleExport(format: "pdf" | "csv") {
    window.open(`/api/admin/team-dashboard/export?format=${format}`, "_blank");
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg glass-card hover:bg-accent transition-colors"
      >
        <Download className="h-4 w-4" />
        Export {monthLabel}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 glass-card rounded-lg shadow-lg border border-border/50 py-1 z-50">
          <button
            onClick={() => handleExport("pdf")}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-left hover:bg-accent transition-colors"
          >
            <FileText className="h-4 w-4 text-rose-500" />
            PDF herunterladen
          </button>
          <button
            onClick={() => handleExport("csv")}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-left hover:bg-accent transition-colors"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
            CSV herunterladen
          </button>
        </div>
      )}
    </div>
  );
}
