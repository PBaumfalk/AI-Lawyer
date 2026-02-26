"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "OFFEN", label: "Offen", color: "text-emerald-600" },
  { value: "RUHEND", label: "Ruhend", color: "text-amber-600" },
  { value: "ARCHIVIERT", label: "Archivieren", color: "text-slate-500" },
  { value: "GESCHLOSSEN", label: "Schließen", color: "text-rose-600" },
];

interface AkteStatusMenuProps {
  akteId: string;
  currentStatus: string;
}

export function AkteStatusMenu({ akteId, currentStatus }: AkteStatusMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleStatusChange(newStatus: string) {
    if (newStatus === currentStatus) {
      setOpen(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/akten/${akteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Fehler beim Statuswechsel");
      }

      const statusLabels: Record<string, string> = {
        OFFEN: "geöffnet",
        RUHEND: "auf ruhend gesetzt",
        ARCHIVIERT: "archiviert",
        GESCHLOSSEN: "geschlossen",
      };

      toast.success(`Akte ${statusLabels[newStatus] ?? "aktualisiert"}`);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(!open)}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
        ) : (
          <ChevronDown className="w-4 h-4 mr-1" />
        )}
        Status ändern
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-white/50 dark:bg-white/[0.05] backdrop-blur-md border border-white/20 dark:border-white/[0.08] rounded-lg shadow-lg overflow-hidden">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleStatusChange(opt.value)}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                  opt.value === currentStatus
                    ? "font-medium bg-slate-50 dark:bg-slate-800"
                    : ""
                } ${opt.color}`}
              >
                {opt.label}
                {opt.value === currentStatus && " (aktuell)"}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
