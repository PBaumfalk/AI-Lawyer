"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Shield, ShieldCheck, ShieldOff } from "lucide-react";
import { AdminOverrideDialog } from "./admin-override-dialog";

interface Override {
  id: string;
  grund: string;
  gueltigBis: string | null;
  createdAt: string;
}

interface AdminOverrideButtonProps {
  akteId: string;
  aktenzeichen: string;
}

export function AdminOverrideButton({ akteId, aktenzeichen }: AdminOverrideButtonProps) {
  const { data: session } = useSession();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeOverride, setActiveOverride] = useState<Override | null>(null);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(false);

  const isAdmin = session?.user?.role === "ADMIN";

  const loadOverride = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/admin/override");
      if (res.ok) {
        const overrides: Array<Override & { akte: { id: string } }> = await res.json();
        const match = overrides.find((o) => o.akte.id === akteId);
        setActiveOverride(match || null);
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, [akteId, isAdmin]);

  useEffect(() => {
    loadOverride();
  }, [loadOverride]);

  const handleRevoke = async () => {
    if (!activeOverride) return;
    setRevoking(true);
    try {
      const res = await fetch(`/api/admin/override?id=${activeOverride.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setActiveOverride(null);
      }
    } catch {
      // Silent fail
    } finally {
      setRevoking(false);
    }
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      // Reload override status after dialog closes
      loadOverride();
    }
  };

  if (!isAdmin || loading) return null;

  if (activeOverride) {
    return (
      <div className="inline-flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
          <ShieldCheck className="w-4 h-4" />
          Zugriff aktiv
        </span>
        <button
          onClick={handleRevoke}
          disabled={revoking}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 hover:bg-rose-200 dark:hover:bg-rose-900 transition-colors disabled:opacity-50"
        >
          <ShieldOff className="w-4 h-4" />
          {revoking ? "Aufheben..." : "Zugriff aufheben"}
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setDialogOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900 transition-colors"
      >
        <Shield className="w-4 h-4" />
        Zugriff uebernehmen
      </button>
      <AdminOverrideDialog
        open={dialogOpen}
        onOpenChange={handleDialogChange}
        akteId={akteId}
        aktenzeichen={aktenzeichen}
      />
    </>
  );
}
