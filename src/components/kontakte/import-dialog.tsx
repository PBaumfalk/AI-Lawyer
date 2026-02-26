"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileText,
  ContactRound,
  Loader2,
  Check,
  AlertCircle,
  X,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { IMPORTABLE_FIELDS } from "@/lib/kontakte/csv-import";

type Step = "upload" | "mapping" | "result";

interface PreviewData {
  format: "csv" | "vcard";
  headers?: string[];
  total: number;
  autoMapping?: Record<string, string>;
  preview: any[];
}

interface ImportResult {
  total: number;
  imported: number;
  skipped: number;
  errors: { row: number; error: string }[];
}

export function ImportDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null!);
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<"csv" | "vcard">("csv");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ImportResult | null>(null);

  async function handleFileSelect(f: File) {
    setFile(f);
    const ext = f.name.toLowerCase();
    const detectedFormat = ext.endsWith(".vcf") || ext.endsWith(".vcard") ? "vcard" : "csv";
    setFormat(detectedFormat);

    // Get preview
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", f);
      formData.append("format", detectedFormat);

      const res = await fetch("/api/kontakte/import/preview", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Vorschau fehlgeschlagen");
      const data = await res.json();
      setPreview(data);

      if (detectedFormat === "csv" && data.autoMapping) {
        setMapping(data.autoMapping);
        setStep("mapping");
      } else if (detectedFormat === "vcard") {
        setStep("mapping");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (!file) return;
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("format", format);
      if (format === "csv") {
        formData.append("mapping", JSON.stringify(mapping));
      }

      const res = await fetch("/api/kontakte/import", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Import fehlgeschlagen");
      const data: ImportResult = await res.json();
      setResult(data);
      setStep("result");

      if (data.imported > 0) {
        toast.success(`${data.imported} Kontakt(e) importiert`);
        router.refresh();
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-2xl border border-white/20 dark:border-white/[0.08] shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/20 dark:border-white/[0.08]">
          <h2 className="text-lg font-heading text-foreground">
            Kontakte importieren
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === "upload" && (
            <UploadStep
              fileRef={fileRef}
              loading={loading}
              onFileSelect={handleFileSelect}
            />
          )}

          {step === "mapping" && preview && (
            <MappingStep
              preview={preview}
              format={format}
              mapping={mapping}
              onMappingChange={setMapping}
            />
          )}

          {step === "result" && result && <ResultStep result={result} />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/20 dark:border-white/[0.08]">
          <Button variant="ghost" onClick={onClose}>
            {step === "result" ? "Schließen" : "Abbrechen"}
          </Button>

          {step === "mapping" && (
            <Button onClick={handleImport} disabled={loading}>
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              {preview?.total} Kontakt(e) importieren
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Upload Step ────────────────────────────────────────────────────────────

function UploadStep({
  fileRef,
  loading,
  onFileSelect,
}: {
  fileRef: React.RefObject<HTMLInputElement>;
  loading: boolean;
  onFileSelect: (f: File) => void;
}) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Laden Sie eine CSV- oder vCard-Datei (.vcf) hoch, um Kontakte zu
        importieren.
      </p>

      <div
        className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-10 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50/50 dark:hover:bg-brand-950/20 transition-colors"
        onClick={() => fileRef.current?.click()}
      >
        {loading ? (
          <Loader2 className="w-10 h-10 text-brand-500 mx-auto mb-3 animate-spin" />
        ) : (
          <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
        )}
        <p className="text-sm font-medium text-foreground/80">
          Datei hierher ziehen oder klicken
        </p>
        <p className="text-xs text-slate-400 mt-1">
          CSV (.csv) oder vCard (.vcf) – max. 5.000 Einträge
        </p>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".csv,.vcf,.vcard"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFileSelect(f);
        }}
      />

      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-start gap-3 p-4 rounded-lg bg-white/15 dark:bg-white/[0.04]">
          <FileText className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground/80">
              CSV
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Komma- oder Semikolon-getrennt. Erste Zeile = Spaltenüberschriften.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-4 rounded-lg bg-white/15 dark:bg-white/[0.04]">
          <ContactRound className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground/80">
              vCard
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Standardformat (.vcf) aus Outlook, Apple Contacts etc.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Mapping Step ───────────────────────────────────────────────────────────

function MappingStep({
  preview,
  format,
  mapping,
  onMappingChange,
}: {
  preview: PreviewData;
  format: "csv" | "vcard";
  mapping: Record<string, string>;
  onMappingChange: (m: Record<string, string>) => void;
}) {
  if (format === "vcard") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="success">{preview.total}</Badge>
          <span className="text-sm text-muted-foreground">
            Kontakt(e) erkannt
          </span>
        </div>
        <p className="text-sm text-slate-500">
          Vorschau der ersten Einträge:
        </p>
        <div className="space-y-2">
          {preview.preview.map((c: any, i: number) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 rounded-lg bg-white/15 dark:bg-white/[0.04]"
            >
              <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center text-xs font-medium text-brand-600">
                {i + 1}
              </div>
              <div>
                <p className="text-sm text-foreground">
                  {c.firma || `${c.vorname ?? ""} ${c.nachname ?? ""}`.trim() || "—"}
                </p>
                <p className="text-xs text-slate-500">
                  {[c.email, c.telefon, c.ort].filter(Boolean).join(" · ") || "Keine Details"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // CSV mapping
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant="success">{preview.total}</Badge>
        <span className="text-sm text-muted-foreground">
          Zeilen erkannt
        </span>
      </div>

      <p className="text-sm text-slate-500">
        Ordnen Sie die CSV-Spalten den Kontaktfeldern zu:
      </p>

      <div className="space-y-2 max-h-[40vh] overflow-y-auto">
        {preview.headers?.map((header) => (
          <div
            key={header}
            className="flex items-center gap-3 p-3 rounded-lg bg-white/15 dark:bg-white/[0.04]"
          >
            <span className="text-sm font-mono text-foreground/80 min-w-[140px] truncate">
              {header}
            </span>
            <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <Select
              value={mapping[header] ?? ""}
              onChange={(e) =>
                onMappingChange({ ...mapping, [header]: e.target.value })
              }
              className="h-8 text-sm flex-1"
            >
              <option value="">— Überspringen —</option>
              {IMPORTABLE_FIELDS.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </Select>
          </div>
        ))}
      </div>

      {/* Preview table */}
      {preview.preview.length > 0 && (
        <details className="text-xs">
          <summary className="text-slate-500 cursor-pointer hover:text-slate-700">
            Datenvorschau (erste {preview.preview.length} Zeilen)
          </summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr>
                  {preview.headers?.map((h) => (
                    <th
                      key={h}
                      className="px-2 py-1 text-[10px] font-medium text-slate-500 uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.preview.map((row: any, i: number) => (
                  <tr key={i}>
                    {preview.headers?.map((h) => (
                      <td
                        key={h}
                        className="px-2 py-1 text-muted-foreground truncate max-w-[150px]"
                      >
                        {row[h] || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}

// ─── Result Step ────────────────────────────────────────────────────────────

function ResultStep({ result }: { result: ImportResult }) {
  return (
    <div className="space-y-6">
      <div className="text-center py-4">
        {result.imported > 0 ? (
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-3">
            <Check className="w-6 h-6 text-emerald-600" />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6 text-amber-600" />
          </div>
        )}
        <h3 className="text-lg font-heading text-foreground">
          Import abgeschlossen
        </h3>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Gesamt" value={result.total} />
        <StatCard label="Importiert" value={result.imported} variant="success" />
        <StatCard
          label="Übersprungen"
          value={result.skipped + result.errors.length}
          variant={result.errors.length > 0 ? "warning" : "muted"}
        />
      </div>

      {result.errors.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground/80">
            Fehler ({result.errors.length})
          </p>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {result.errors.map((err, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-xs p-2 rounded bg-rose-50 dark:bg-rose-950/30"
              >
                <AlertCircle className="w-3 h-3 text-rose-500 mt-0.5 flex-shrink-0" />
                <span className="text-rose-700 dark:text-rose-400">
                  Zeile {err.row}: {err.error}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  variant = "default",
}: {
  label: string;
  value: number;
  variant?: "default" | "success" | "warning" | "muted";
}) {
  const colors = {
    default: "text-foreground",
    success: "text-emerald-600",
    warning: "text-amber-600",
    muted: "text-slate-500",
  };

  return (
    <div className="bg-white/15 dark:bg-white/[0.04] rounded-lg p-4 text-center">
      <p className={`text-2xl font-heading ${colors[variant]}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  );
}
