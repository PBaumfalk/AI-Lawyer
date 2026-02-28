"use client";

/**
 * New Falldaten-Template page
 *
 * Uses the shared TemplateBuilder to create a new template.
 * Supports "Save as draft" and "Save and submit for review".
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  TemplateBuilder,
} from "@/components/falldaten-templates/template-builder";

export default function NeuFalldatenTemplatePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [serverErrors, setServerErrors] = useState<string[]>([]);

  // ─── Save as draft ──────────────────────────────────────────────────────

  async function handleSave(payload: {
    name: string;
    beschreibung?: string;
    sachgebiet?: string;
    schema: { felder: any[] };
  }) {
    setSaving(true);
    setServerErrors([]);
    try {
      const res = await fetch("/api/falldaten-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.details?.fieldErrors) {
          const errs = Object.values(data.details.fieldErrors).flat() as string[];
          setServerErrors(errs.length > 0 ? errs : [data.error]);
        } else {
          setServerErrors([data.error ?? "Fehler beim Erstellen"]);
        }
        return;
      }
      toast.success("Template als Entwurf gespeichert");
      router.push("/dashboard/falldaten-templates");
    } catch (err: unknown) {
      setServerErrors([
        err instanceof Error ? err.message : "Unbekannter Fehler",
      ]);
    } finally {
      setSaving(false);
    }
  }

  // ─── Save and submit for review ──────────────────────────────────────────

  async function handleSaveAndSubmit(payload: {
    name: string;
    beschreibung?: string;
    sachgebiet?: string;
    schema: { felder: any[] };
  }) {
    setSaving(true);
    setServerErrors([]);
    try {
      // Step 1: Create template
      const createRes = await fetch("/api/falldaten-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const createData = await createRes.json();
      if (!createRes.ok) {
        if (createData.details?.fieldErrors) {
          const errs = Object.values(
            createData.details.fieldErrors
          ).flat() as string[];
          setServerErrors(
            errs.length > 0 ? errs : [createData.error]
          );
        } else {
          setServerErrors([createData.error ?? "Fehler beim Erstellen"]);
        }
        return;
      }

      const templateId = createData.template?.id;

      // Step 2: Submit for review
      const submitRes = await fetch(
        `/api/falldaten-templates/${templateId}/einreichen`,
        { method: "POST" }
      );
      if (!submitRes.ok) {
        const submitData = await submitRes.json().catch(() => ({}));
        // Template was created but submit failed -- redirect anyway
        toast.error(
          submitData.error ?? "Template erstellt, aber Einreichen fehlgeschlagen"
        );
        router.push("/dashboard/falldaten-templates");
        return;
      }

      toast.success("Template erstellt und zur Pruefung eingereicht");
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
          Neues Template erstellen
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Erstellen Sie ein neues Falldaten-Template mit Gruppen und Feldern
        </p>
      </div>

      <TemplateBuilder
        onSave={handleSave}
        onSaveAndSubmit={handleSaveAndSubmit}
        saveLabel="Als Entwurf speichern"
        submitLabel="Speichern und einreichen"
        saving={saving}
        serverErrors={serverErrors}
      />
    </div>
  );
}
