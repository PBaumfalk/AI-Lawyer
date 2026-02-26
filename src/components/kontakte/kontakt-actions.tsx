"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface KontaktActionsProps {
  kontakt: {
    id: string;
    _count?: { beteiligte: number };
    beteiligte?: any[];
  };
}

export function KontaktActions({ kontakt }: KontaktActionsProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const beteiligteCount =
    (kontakt as any)._count?.beteiligte ?? kontakt.beteiligte?.length ?? 0;

  async function handleDelete() {
    if (beteiligteCount > 0) {
      toast.error(
        `Kontakt ist noch ${beteiligteCount} Akte(n) zugeordnet. Bitte zuerst alle Zuordnungen entfernen.`
      );
      return;
    }

    if (!confirm("Kontakt wirklich löschen? Dieser Vorgang kann nicht rückgängig gemacht werden.")) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/kontakte/${kontakt.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Fehler beim Löschen");
      }

      toast.success("Kontakt gelöscht");
      router.push("/kontakte");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Link href={`/kontakte/${kontakt.id}/bearbeiten`}>
        <Button variant="outline" size="sm">
          <Pencil className="w-4 h-4 mr-1" />
          Bearbeiten
        </Button>
      </Link>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDelete}
        disabled={deleting}
        className="text-slate-500 hover:text-rose-600"
      >
        {deleting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Trash2 className="w-4 h-4" />
        )}
      </Button>
    </div>
  );
}
