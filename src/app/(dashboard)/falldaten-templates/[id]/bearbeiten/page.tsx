"use client";

/**
 * Edit Falldaten-Template page
 *
 * Loads existing template, pre-populates the builder, and saves via PATCH.
 * Guards: only owner can edit, only ENTWURF/ABGELEHNT status.
 * Shows ablehnungsgrund for ABGELEHNT templates.
 */

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  TemplateBuilder,
  type BuilderGroup,
  type TemplateMetadata,
} from "@/components/falldaten-templates/template-builder";
import type { FalldatenFeldTypDB } from "@/lib/falldaten/validation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TemplateField {
  key: string;
  label: string;
  typ: FalldatenFeldTypDB;
  placeholder?: string;
  optionen?: { value: string; label: string }[];
  required?: boolean;
  gruppe?: string;
}

interface TemplateDetail {
  id: string;
  name: string;
  beschreibung: string | null;
  sachgebiet: string | null;
  schema: { felder: TemplateField[] };
  status: "ENTWURF" | "EINGEREICHT" | "GENEHMIGT" | "ABGELEHNT" | "STANDARD";
  erstelltVonId: string;
  ablehnungsgrund: string | null;
}

// ─── Helper: Reconstruct groups from flat felder array ──────────────────────

function fieldsToGroups(felder: TemplateField[]): BuilderGroup[] {
  const groupMap = new Map<string, BuilderGroup>();

  for (const feld of felder) {
    const groupName = feld.gruppe ?? "Allgemein";
    if (!groupMap.has(groupName)) {
      groupMap.set(groupName, { name: groupName, fields: [], collapsed: false });
    }
    groupMap.get(groupName)!.fields.push({
      key: feld.key,
      label: feld.label,
      typ: feld.typ,
      placeholder: feld.placeholder ?? "",
      required: feld.required ?? false,
      optionen: feld.optionen ?? [],
    });
  }

  return Array.from(groupMap.values());
}

// ─── Page component ──────────────────────────────────────────────────────────

export default function BearbeitenFalldatenTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id as string | undefined;

  const [template, setTemplate] = useState<TemplateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [serverErrors, setServerErrors] = useState<string[]>([]);

  // ─── Load template ──────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/falldaten-templates/${id}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError("Template nicht gefunden");
            return;
          }
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        const data = await res.json();
        setTemplate(data.template);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Fehler beim Laden"
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  // ─── Guard: loading / error / access ───────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Template wird geladen...
        </span>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-muted-foreground">
          {error ?? "Template nicht gefunden"}
        </p>
        <a
          href="/dashboard/falldaten-templates"
          className="text-sm text-primary hover:underline mt-4 inline-block"
        >
          Zurueck zur Uebersicht
        </a>
      </div>
    );
  }

  // Access guard: only owner of ENTWURF/ABGELEHNT can edit
  const isOwner = template.erstelltVonId === userId;
  const isEditable =
    template.status === "ENTWURF" || template.status === "ABGELEHNT";

  if (!isOwner || !isEditable) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-muted-foreground">
          Dieses Template kann nicht bearbeitet werden.
        </p>
        <a
          href="/dashboard/falldaten-templates"
          className="text-sm text-primary hover:underline mt-4 inline-block"
        >
          Zurueck zur Uebersicht
        </a>
      </div>
    );
  }

  // ─── Pre-populate builder ─────────────────────────────────────────────

  const initialMetadata: TemplateMetadata = {
    name: template.name,
    beschreibung: template.beschreibung ?? "",
    sachgebiet: template.sachgebiet ?? "",
  };

  const initialGroups = fieldsToGroups(template.schema.felder);

  // ─── Save handler (PATCH) ─────────────────────────────────────────────

  async function handleSave(payload: {
    name: string;
    beschreibung?: string;
    sachgebiet?: string;
    schema: { felder: any[] };
  }) {
    setSaving(true);
    setServerErrors([]);
    try {
      const res = await fetch(`/api/falldaten-templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.details?.fieldErrors) {
          const errs = Object.values(data.details.fieldErrors).flat() as string[];
          setServerErrors(errs.length > 0 ? errs : [data.error]);
        } else {
          setServerErrors([data.error ?? "Fehler beim Speichern"]);
        }
        return;
      }
      toast.success("Template gespeichert");
      router.push("/dashboard/falldaten-templates");
    } catch (err: unknown) {
      setServerErrors([
        err instanceof Error ? err.message : "Unbekannter Fehler",
      ]);
    } finally {
      setSaving(false);
    }
  }

  // ─── Save and (re-)submit handler ─────────────────────────────────────

  async function handleSaveAndSubmit(payload: {
    name: string;
    beschreibung?: string;
    sachgebiet?: string;
    schema: { felder: any[] };
  }) {
    setSaving(true);
    setServerErrors([]);
    try {
      // Step 1: Save changes
      const patchRes = await fetch(`/api/falldaten-templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const patchData = await patchRes.json();
      if (!patchRes.ok) {
        if (patchData.details?.fieldErrors) {
          const errs = Object.values(
            patchData.details.fieldErrors
          ).flat() as string[];
          setServerErrors(
            errs.length > 0 ? errs : [patchData.error]
          );
        } else {
          setServerErrors([patchData.error ?? "Fehler beim Speichern"]);
        }
        return;
      }

      // Step 2: Submit
      const submitRes = await fetch(
        `/api/falldaten-templates/${id}/einreichen`,
        { method: "POST" }
      );
      if (!submitRes.ok) {
        const submitData = await submitRes.json().catch(() => ({}));
        toast.error(
          submitData.error ?? "Gespeichert, aber Einreichen fehlgeschlagen"
        );
        router.push("/dashboard/falldaten-templates");
        return;
      }

      toast.success(
        template!.status === "ABGELEHNT"
          ? "Template gespeichert und erneut eingereicht"
          : "Template gespeichert und eingereicht"
      );
      router.push("/dashboard/falldaten-templates");
    } catch (err: unknown) {
      setServerErrors([
        err instanceof Error ? err.message : "Unbekannter Fehler",
      ]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Template bearbeiten
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {template.name}
        </p>
      </div>

      <TemplateBuilder
        initialMetadata={initialMetadata}
        initialGroups={initialGroups}
        status={template.status}
        ablehnungsgrund={template.ablehnungsgrund}
        onSave={handleSave}
        onSaveAndSubmit={handleSaveAndSubmit}
        saveLabel="Speichern"
        submitLabel={
          template.status === "ABGELEHNT"
            ? "Speichern und erneut einreichen"
            : "Speichern und einreichen"
        }
        saving={saving}
        serverErrors={serverErrors}
      />
    </div>
  );
}
