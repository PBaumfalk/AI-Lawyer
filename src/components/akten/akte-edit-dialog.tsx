"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";

const SACHGEBIETE = [
  { value: "ARBEITSRECHT", label: "Arbeitsrecht" },
  { value: "FAMILIENRECHT", label: "Familienrecht" },
  { value: "VERKEHRSRECHT", label: "Verkehrsrecht" },
  { value: "MIETRECHT", label: "Mietrecht" },
  { value: "STRAFRECHT", label: "Strafrecht" },
  { value: "ERBRECHT", label: "Erbrecht" },
  { value: "SOZIALRECHT", label: "Sozialrecht" },
  { value: "INKASSO", label: "Inkasso" },
  { value: "HANDELSRECHT", label: "Handelsrecht" },
  { value: "VERWALTUNGSRECHT", label: "Verwaltungsrecht" },
  { value: "SONSTIGES", label: "Sonstiges" },
];

interface UserOption {
  id: string;
  name: string;
  role: string;
}

interface AkteEditDialogProps {
  akte: {
    id: string;
    kurzrubrum: string;
    wegen: string | null;
    sachgebiet: string;
    gegenstandswert: string | null;
    anwaltId?: string | null;
    sachbearbeiterId?: string | null;
    notizen: string | null;
    anwalt: { id: string } | null;
    sachbearbeiter: { id: string } | null;
  };
  open: boolean;
  onClose: () => void;
}

export function AkteEditDialog({ akte, open, onClose }: AkteEditDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);

  useEffect(() => {
    if (open) {
      fetch("/api/users")
        .then((r) => r.json())
        .then(setUsers)
        .catch(() => {});
    }
  }, [open]);

  const anwaelte = users.filter(
    (u) => u.role === "ANWALT" || u.role === "ADMIN"
  );
  const sachbearbeiterList = users.filter(
    (u) => u.role === "SACHBEARBEITER" || u.role === "SEKRETARIAT"
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const data: any = {
      kurzrubrum: form.get("kurzrubrum") as string,
      wegen: (form.get("wegen") as string) || null,
      sachgebiet: form.get("sachgebiet") as string,
      gegenstandswert: form.get("gegenstandswert")
        ? parseFloat(form.get("gegenstandswert") as string)
        : null,
      anwaltId: (form.get("anwaltId") as string) || null,
      sachbearbeiterId: (form.get("sachbearbeiterId") as string) || null,
      notizen: (form.get("notizen") as string) || null,
    };

    try {
      const res = await fetch(`/api/akten/${akte.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Fehler beim Speichern");
      }

      toast.success("Akte gespeichert");
      onClose();
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="absolute inset-y-0 right-0 w-full max-w-lg bg-white/50 dark:bg-white/[0.05] backdrop-blur-md border-l border-white/20 dark:border-white/[0.08] shadow-2xl overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-white/20 dark:border-white/[0.08]">
          <h2 className="text-lg font-heading text-foreground">
            Akte bearbeiten
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-white/20 dark:hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="edit-kurzrubrum">Kurzrubrum</Label>
            <Input
              id="edit-kurzrubrum"
              name="kurzrubrum"
              defaultValue={akte.kurzrubrum}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-wegen">Wegen</Label>
            <Input
              id="edit-wegen"
              name="wegen"
              defaultValue={akte.wegen ?? ""}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-sachgebiet">Sachgebiet</Label>
              <Select
                id="edit-sachgebiet"
                name="sachgebiet"
                defaultValue={akte.sachgebiet}
              >
                {SACHGEBIETE.map((sg) => (
                  <option key={sg.value} value={sg.value}>
                    {sg.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-gegenstandswert">Gegenstandswert</Label>
              <Input
                id="edit-gegenstandswert"
                name="gegenstandswert"
                type="number"
                min="0"
                step="0.01"
                defaultValue={
                  akte.gegenstandswert
                    ? parseFloat(akte.gegenstandswert)
                    : ""
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-anwaltId">Anwalt</Label>
              <Select
                id="edit-anwaltId"
                name="anwaltId"
                defaultValue={akte.anwalt?.id ?? ""}
              >
                <option value="">-- Nicht zugewiesen --</option>
                {anwaelte.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-sachbearbeiterId">Sachbearbeiter/in</Label>
              <Select
                id="edit-sachbearbeiterId"
                name="sachbearbeiterId"
                defaultValue={akte.sachbearbeiter?.id ?? ""}
              >
                <option value="">-- Nicht zugewiesen --</option>
                {sachbearbeiterList.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-notizen">Notizen</Label>
            <Textarea
              id="edit-notizen"
              name="notizen"
              defaultValue={akte.notizen ?? ""}
              rows={4}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/20 dark:border-white/[0.08]">
            <Button type="button" variant="outline" onClick={onClose}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Speichern
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
