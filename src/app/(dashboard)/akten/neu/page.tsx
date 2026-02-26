"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { ArrowLeft, Loader2 } from "lucide-react";
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

export default function NeueAktePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then(setUsers)
      .catch(() => {});
  }, []);

  const anwaelte = users.filter((u) => u.role === "ANWALT" || u.role === "ADMIN");
  const sachbearbeiterList = users.filter(
    (u) => u.role === "SACHBEARBEITER" || u.role === "SEKRETARIAT"
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const data = {
      kurzrubrum: form.get("kurzrubrum") as string,
      wegen: (form.get("wegen") as string) || undefined,
      sachgebiet: form.get("sachgebiet") as string,
      gegenstandswert: form.get("gegenstandswert")
        ? parseFloat(form.get("gegenstandswert") as string)
        : undefined,
      anwaltId: (form.get("anwaltId") as string) || undefined,
      sachbearbeiterId: (form.get("sachbearbeiterId") as string) || undefined,
      notizen: (form.get("notizen") as string) || undefined,
    };

    try {
      const res = await fetch("/api/akten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Fehler beim Anlegen der Akte");
      }

      const akte = await res.json();
      toast.success(`Akte ${akte.aktenzeichen} angelegt`);
      router.push(`/akten/${akte.id}`);
    } catch (err: any) {
      toast.error(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/akten">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-heading text-foreground">
            Neue Akte anlegen
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Aktenzeichen wird automatisch vergeben.
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="glass rounded-xl p-6 space-y-5">
          {/* Kurzrubrum */}
          <div className="space-y-2">
            <Label htmlFor="kurzrubrum">
              Kurzrubrum <span className="text-red-500">*</span>
            </Label>
            <Input
              id="kurzrubrum"
              name="kurzrubrum"
              placeholder="z.B. Müller ./. Schmidt GmbH"
              required
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Kurzbezeichnung der Akte, z.B. „Mandant ./. Gegner"
            </p>
          </div>

          {/* Wegen */}
          <div className="space-y-2">
            <Label htmlFor="wegen">Wegen</Label>
            <Input
              id="wegen"
              name="wegen"
              placeholder="z.B. Kündigungsschutzklage, Schadensersatz"
            />
          </div>

          {/* Sachgebiet + Gegenstandswert */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sachgebiet">Sachgebiet</Label>
              <Select id="sachgebiet" name="sachgebiet" defaultValue="SONSTIGES">
                {SACHGEBIETE.map((sg) => (
                  <option key={sg.value} value={sg.value}>
                    {sg.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="gegenstandswert">Gegenstandswert (€)</Label>
              <Input
                id="gegenstandswert"
                name="gegenstandswert"
                type="number"
                min="0"
                step="0.01"
                placeholder="z.B. 15000.00"
              />
            </div>
          </div>

          {/* Anwalt + Sachbearbeiter */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="anwaltId">Zuständiger Anwalt</Label>
              <Select id="anwaltId" name="anwaltId" defaultValue="">
                <option value="">— Nicht zugewiesen —</option>
                {anwaelte.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sachbearbeiterId">Sachbearbeiter/in</Label>
              <Select id="sachbearbeiterId" name="sachbearbeiterId" defaultValue="">
                <option value="">— Nicht zugewiesen —</option>
                {sachbearbeiterList.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Notizen */}
          <div className="space-y-2">
            <Label htmlFor="notizen">Notizen</Label>
            <Textarea
              id="notizen"
              name="notizen"
              placeholder="Interne Anmerkungen zur Akte..."
              rows={3}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link href="/akten">
            <Button variant="outline" type="button">
              Abbrechen
            </Button>
          </Link>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Akte anlegen
          </Button>
        </div>
      </form>
    </div>
  );
}
