"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

interface TemplateData {
  id: string;
  name: string;
  beschreibung: string | null;
  sachgebiet: string;
  status: string;
}

export default function NeueAktePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [suggestedTemplates, setSuggestedTemplates] = useState<TemplateData[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

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

  // Fetch template suggestions when Sachgebiet changes
  const fetchTemplates = useCallback(async (sachgebiet: string) => {
    if (sachgebiet === "SONSTIGES") {
      setSuggestedTemplates([]);
      setSelectedTemplateId(null);
      return;
    }

    setLoadingTemplates(true);
    try {
      const res = await fetch(
        `/api/falldaten-templates?sachgebiet=${sachgebiet}`
      );
      if (res.ok) {
        const data = await res.json();
        const templates: TemplateData[] = (data.templates ?? []).filter(
          (t: TemplateData) => t.status === "STANDARD" || t.status === "GENEHMIGT"
        );
        setSuggestedTemplates(templates);

        // Pre-select STANDARD template if one exists
        const standardTemplate = templates.find((t) => t.status === "STANDARD");
        setSelectedTemplateId(standardTemplate?.id ?? templates[0]?.id ?? null);
      } else {
        setSuggestedTemplates([]);
        setSelectedTemplateId(null);
      }
    } catch {
      setSuggestedTemplates([]);
      setSelectedTemplateId(null);
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  const handleSachgebietChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    fetchTemplates(e.target.value);
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const data: Record<string, unknown> = {
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

    // Include selected template ID if one is selected
    if (selectedTemplateId) {
      data.falldatenTemplateId = selectedTemplateId;
    }

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
          <h1 className="text-2xl font-semibold text-foreground">
            Neue Akte anlegen
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Aktenzeichen wird automatisch vergeben.
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="glass-panel rounded-2xl p-6 space-y-5">
          {/* Kurzrubrum */}
          <div className="space-y-2">
            <Label htmlFor="kurzrubrum">
              Kurzrubrum <span className="text-red-500">*</span>
            </Label>
            <Input
              id="kurzrubrum"
              name="kurzrubrum"
              placeholder="z.B. Mueller ./. Schmidt GmbH"
              required
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Kurzbezeichnung der Akte, z.B. "Mandant ./. Gegner"
            </p>
          </div>

          {/* Wegen */}
          <div className="space-y-2">
            <Label htmlFor="wegen">Wegen</Label>
            <Input
              id="wegen"
              name="wegen"
              placeholder="z.B. Kuendigungsschutzklage, Schadensersatz"
            />
          </div>

          {/* Sachgebiet + Gegenstandswert */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sachgebiet">Sachgebiet</Label>
              <Select
                id="sachgebiet"
                name="sachgebiet"
                defaultValue="SONSTIGES"
                onChange={handleSachgebietChange}
              >
                {SACHGEBIETE.map((sg) => (
                  <option key={sg.value} value={sg.value}>
                    {sg.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="gegenstandswert">Gegenstandswert</Label>
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

          {/* Template Suggestions (HEL-07) */}
          {loadingTemplates && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Lade Vorlagen...
            </div>
          )}

          {!loadingTemplates && suggestedTemplates.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[oklch(45%_0.2_260)]" />
                <span className="text-sm font-medium text-foreground">
                  Helena empfiehlt:
                </span>
              </div>
              <div className="space-y-2">
                {suggestedTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setSelectedTemplateId(template.id)}
                    className={cn(
                      "w-full text-left rounded-xl px-4 py-3 border transition-all",
                      selectedTemplateId === template.id
                        ? "border-[oklch(45%_0.2_260)] bg-[oklch(45%_0.2_260/0.05)] ring-1 ring-[oklch(45%_0.2_260/0.3)]"
                        : "border-white/20 dark:border-white/[0.08] bg-white/30 dark:bg-white/[0.03] hover:border-white/40 dark:hover:border-white/[0.15]"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {template.name}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                          template.status === "STANDARD"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
                        )}
                      >
                        {template.status}
                      </span>
                    </div>
                    {template.beschreibung && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {template.beschreibung}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Anwalt + Sachbearbeiter */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="anwaltId">Zustaendiger Anwalt</Label>
              <Select id="anwaltId" name="anwaltId" defaultValue="">
                <option value="">-- Nicht zugewiesen --</option>
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
                <option value="">-- Nicht zugewiesen --</option>
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
