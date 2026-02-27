"use client";

/**
 * Admin Muster management page — /admin/muster
 *
 * Allows admins to:
 * - Upload new kanzlei-eigene Muster (PDF or DOCX)
 * - View all Muster with NER status badges and chunk counts
 * - Delete Muster (removes chunks, MinIO object, DB row)
 * - Retry NER for REJECTED or PENDING_NER Muster
 *
 * Muster table shows: Name, Kategorie, Herkunft, NER-Status, Chunks, Uploader, Datum, Aktionen
 * NER status is updated by refreshing the page (no real-time polling in v0.1).
 */

import { useEffect, useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { GlassCard } from "@/components/ui/glass-card";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MusterRow {
  id: string;
  name: string;
  kategorie: string;
  isKanzleiEigen: boolean;
  nerStatus: "PENDING_NER" | "NER_RUNNING" | "INDEXED" | "REJECTED_PII_DETECTED";
  mimeType: string;
  createdAt: string;
  uploadedBy: { name: string | null } | null;
  _count: { chunks: number };
}

// ─── NER status badge mapping ─────────────────────────────────────────────────

function NerStatusBadge({ status }: { status: MusterRow["nerStatus"] }) {
  switch (status) {
    case "PENDING_NER":
      return <Badge variant="secondary">Ausstehend</Badge>;
    case "NER_RUNNING":
      return <Badge variant="default">PII-Prufung lauft...</Badge>;
    case "INDEXED":
      return (
        <Badge
          variant="default"
          className="bg-emerald-500/10 text-emerald-700 border-emerald-200"
        >
          Indiziert
        </Badge>
      );
    case "REJECTED_PII_DETECTED":
      return <Badge variant="destructive">Abgelehnt - PII</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function AdminMusterPage() {
  const [muster, setMuster] = useState<MusterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // ─── Load muster list ───────────────────────────────────────────────────────

  async function loadMuster() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/muster");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setMuster(data.muster);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMuster();
  }, []);

  // ─── Upload handler ─────────────────────────────────────────────────────────

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const formData = new FormData(e.currentTarget);
      const res = await fetch("/api/admin/muster", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setUploadSuccess(`Muster "${data.muster?.name}" wurde hochgeladen und wird gepruft.`);
      formRef.current?.reset();
      await loadMuster();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Upload fehlgeschlagen");
    } finally {
      setUploading(false);
    }
  }

  // ─── Delete handler ─────────────────────────────────────────────────────────

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Muster "${name}" wirklich loschen? Alle Chunks werden entfernt.`)) return;
    try {
      const res = await fetch(`/api/admin/muster/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      await loadMuster();
    } catch (err: unknown) {
      alert(`Loschen fehlgeschlagen: ${err instanceof Error ? err.message : "Unbekannter Fehler"}`);
    }
  }

  // ─── Retry NER handler ──────────────────────────────────────────────────────

  async function handleRetryNer(id: string) {
    try {
      const res = await fetch(`/api/admin/muster/${id}`, { method: "PATCH" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      await loadMuster();
    } catch (err: unknown) {
      alert(`NER-Wiederholung fehlgeschlagen: ${err instanceof Error ? err.message : "Unbekannter Fehler"}`);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Schriftsatzmuster</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Kanzlei-eigene Muster fur Helenas Schriftsatz-RAG
        </p>
      </div>

      {/* Upload form */}
      <GlassCard className="p-6">
        <h2 className="text-base font-semibold mb-4">Neues Muster hochladen</h2>
        <form ref={formRef} onSubmit={handleUpload} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* File input */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1" htmlFor="file">
                Datei <span className="text-muted-foreground">(PDF oder DOCX)</span>
              </label>
              <input
                id="file"
                name="file"
                type="file"
                accept=".pdf,.docx"
                required
                className="block w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
              />
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="name">
                Name <span className="text-destructive">*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                placeholder="z.B. Kundigungsschutzklage Standard"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Kategorie */}
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="kategorie">
                Kategorie <span className="text-destructive">*</span>
              </label>
              <input
                id="kategorie"
                name="kategorie"
                type="text"
                required
                placeholder="z.B. Klage, Schreiben, Vertrag"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Beschreibung */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1" htmlFor="beschreibung">
                Beschreibung{" "}
                <span className="text-muted-foreground">(optional)</span>
              </label>
              <textarea
                id="beschreibung"
                name="beschreibung"
                rows={2}
                placeholder="Kurze Beschreibung des Musters..."
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
          </div>

          {uploadError && (
            <p className="text-sm text-destructive">{uploadError}</p>
          )}
          {uploadSuccess && (
            <p className="text-sm text-emerald-600">{uploadSuccess}</p>
          )}

          <Button type="submit" disabled={uploading}>
            {uploading ? "Wird hochgeladen..." : "Muster hochladen"}
          </Button>
        </form>
      </GlassCard>

      {/* Muster table */}
      <GlassPanel className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Alle Muster</h2>
          <Button variant="outline" size="sm" onClick={loadMuster} disabled={loading}>
            {loading ? "Ladt..." : "Aktualisieren"}
          </Button>
        </div>

        {error && (
          <p className="text-sm text-destructive mb-4">{error}</p>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Muster werden geladen...</p>
        ) : muster.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine Muster vorhanden. Laden Sie das erste Muster hoch.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Name</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Kategorie</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Herkunft</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">NER-Status</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Chunks</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Hochgeladen von</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Datum</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {muster.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-border/30 hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-3 px-3 font-medium max-w-[200px] truncate" title={m.name}>
                      {m.name}
                    </td>
                    <td className="py-3 px-3 text-muted-foreground">{m.kategorie}</td>
                    <td className="py-3 px-3">
                      {m.isKanzleiEigen ? (
                        <span className="text-brand-600 font-medium">Kanzlei-eigen</span>
                      ) : (
                        <span className="text-muted-foreground">Amtlich</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <NerStatusBadge status={m.nerStatus} />
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums">
                      {m._count.chunks}
                    </td>
                    <td className="py-3 px-3 text-muted-foreground">
                      {m.uploadedBy?.name ?? "—"}
                    </td>
                    <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">
                      {new Date(m.createdAt).toLocaleDateString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        {(m.nerStatus === "REJECTED_PII_DETECTED" ||
                          m.nerStatus === "PENDING_NER") && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRetryNer(m.id)}
                          >
                            Erneut prufen
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(m.id, m.name)}
                        >
                          Loschen
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
