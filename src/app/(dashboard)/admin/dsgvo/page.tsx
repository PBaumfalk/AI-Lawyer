"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  FileText,
  Shield,
  ShieldAlert,
  Eye,
  Loader2,
  Download,
  AlertTriangle,
  CheckCircle2,
  User,
  Building2,
} from "lucide-react";
import { toast } from "sonner";

interface KontaktResult {
  id: string;
  typ: string;
  vorname: string | null;
  nachname: string | null;
  firma: string | null;
  email: string | null;
  createdAt: string;
}

interface AnonymizePreview {
  success: boolean;
  dryRun: boolean;
  kontaktId: string;
  fieldsAnonymized: string[];
  adressenAnonymized: number;
  auditLogsAnonymized: number;
  retentionCheck: {
    passed: boolean;
    aufbewahrungBis: string;
    overridden: boolean;
  };
  error?: string;
}

function getDisplayName(k: KontaktResult): string {
  if (k.typ === "NATUERLICH") {
    return `${k.vorname ?? ""} ${k.nachname ?? ""}`.trim() || "Unbekannt";
  }
  return k.firma ?? "Unbekannt";
}

export default function AdminDsgvoPage() {
  // Auskunft state
  const [auskunftSearch, setAuskunftSearch] = useState("");
  const [auskunftResults, setAuskunftResults] = useState<KontaktResult[]>([]);
  const [auskunftLoading, setAuskunftLoading] = useState(false);
  const [auskunftDownloading, setAuskunftDownloading] = useState<string | null>(null);

  // Anonymize state
  const [anonSearch, setAnonSearch] = useState("");
  const [anonResults, setAnonResults] = useState<KontaktResult[]>([]);
  const [anonLoading, setAnonLoading] = useState(false);
  const [selectedKontakt, setSelectedKontakt] = useState<KontaktResult | null>(null);
  const [preview, setPreview] = useState<AnonymizePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [grund, setGrund] = useState("");
  const [forceOverride, setForceOverride] = useState(false);
  const [anonymizing, setAnonymizing] = useState(false);

  // Search for Kontakt
  const searchKontakte = useCallback(async (query: string, target: "auskunft" | "anon") => {
    if (!query || query.length < 2) {
      if (target === "auskunft") setAuskunftResults([]);
      else setAnonResults([]);
      return;
    }
    const setLoading = target === "auskunft" ? setAuskunftLoading : setAnonLoading;
    const setResults = target === "auskunft" ? setAuskunftResults : setAnonResults;

    setLoading(true);
    try {
      const res = await fetch(`/api/kontakte?search=${encodeURIComponent(query)}&take=10`);
      if (!res.ok) return;
      const data = await res.json();
      setResults(data.kontakte ?? data ?? []);
    } catch {
      // Silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  // Download Auskunft PDF
  async function handleAuskunftDownload(kontaktId: string) {
    setAuskunftDownloading(kontaktId);
    try {
      const res = await fetch(`/api/dsgvo/auskunft?kontaktId=${kontaktId}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Export fehlgeschlagen");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `datenauskunft-${kontaktId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Datenauskunft PDF heruntergeladen");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAuskunftDownloading(null);
    }
  }

  // Preview anonymization (dry run)
  async function handlePreview(kontakt: KontaktResult) {
    setSelectedKontakt(kontakt);
    setPreviewLoading(true);
    setPreview(null);
    try {
      const res = await fetch("/api/dsgvo/anonymize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kontaktId: kontakt.id, dryRun: true }),
      });
      const data = await res.json();
      setPreview(data);
    } catch {
      toast.error("Vorschau fehlgeschlagen");
    } finally {
      setPreviewLoading(false);
    }
  }

  // Execute anonymization
  async function handleAnonymize() {
    if (!selectedKontakt || !grund) return;
    setAnonymizing(true);
    try {
      const res = await fetch("/api/dsgvo/anonymize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kontaktId: selectedKontakt.id,
          grund,
          forceOverrideRetention: forceOverride,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || "Anonymisierung fehlgeschlagen");
        return;
      }
      toast.success("Kontakt erfolgreich anonymisiert");
      setSelectedKontakt(null);
      setPreview(null);
      setGrund("");
      setForceOverride(false);
    } catch {
      toast.error("Anonymisierung fehlgeschlagen");
    } finally {
      setAnonymizing(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-heading font-bold">DSGVO-Verwaltung</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Datenauskunft, Loeschkonzept und Anonymisierung
        </p>
      </div>

      {/* ─── Auskunftsrecht (Art. 15) ────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-600" />
            <CardTitle className="text-lg">Auskunftsrecht (Art. 15 DSGVO)</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Generieren Sie eine vollstaendige Datenauskunft fuer einen Kontakt als PDF.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Kontakt suchen (Name oder E-Mail)..."
                value={auskunftSearch}
                onChange={(e) => {
                  setAuskunftSearch(e.target.value);
                  searchKontakte(e.target.value, "auskunft");
                }}
                className="pl-9"
              />
            </div>
          </div>

          {auskunftLoading && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          )}

          {auskunftResults.length > 0 && (
            <div className="divide-y border rounded-lg">
              {auskunftResults.map((k) => (
                <div key={k.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <div className="flex items-center gap-3">
                    {k.typ === "NATUERLICH" ? (
                      <User className="w-4 h-4 text-slate-400" />
                    ) : (
                      <Building2 className="w-4 h-4 text-slate-400" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{getDisplayName(k)}</p>
                      {k.email && <p className="text-xs text-slate-500">{k.email}</p>}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAuskunftDownload(k.id)}
                    disabled={auskunftDownloading === k.id}
                  >
                    {auskunftDownloading === k.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-1" />
                    )}
                    PDF generieren
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Loeschkonzept / Anonymisierung ──────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-600" />
            <CardTitle className="text-lg">Loeschkonzept / Anonymisierung</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Anonymisieren Sie personenbezogene Daten unter Beachtung der 10-jaehrigen Aufbewahrungspflicht (BRAO/GoBD).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Kontakt suchen..."
                value={anonSearch}
                onChange={(e) => {
                  setAnonSearch(e.target.value);
                  searchKontakte(e.target.value, "anon");
                }}
                className="pl-9"
              />
            </div>
          </div>

          {anonLoading && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          )}

          {anonResults.length > 0 && !selectedKontakt && (
            <div className="divide-y border rounded-lg">
              {anonResults.map((k) => (
                <div key={k.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <div className="flex items-center gap-3">
                    {k.typ === "NATUERLICH" ? (
                      <User className="w-4 h-4 text-slate-400" />
                    ) : (
                      <Building2 className="w-4 h-4 text-slate-400" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{getDisplayName(k)}</p>
                      {k.email && <p className="text-xs text-slate-500">{k.email}</p>}
                      <p className="text-xs text-slate-400">
                        Angelegt: {new Date(k.createdAt).toLocaleDateString("de-DE")}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handlePreview(k)}>
                    <Eye className="w-4 h-4 mr-1" />
                    Vorschau
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Preview panel */}
          {selectedKontakt && (
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{getDisplayName(selectedKontakt)}</p>
                  <p className="text-xs text-slate-500">{selectedKontakt.email}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedKontakt(null);
                    setPreview(null);
                  }}
                >
                  Zurueck
                </Button>
              </div>

              {previewLoading && (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                </div>
              )}

              {preview && (
                <>
                  {/* Retention status */}
                  <div
                    className={`rounded-lg border p-3 flex items-center gap-3 ${
                      preview.retentionCheck.passed
                        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                        : "bg-amber-50 border-amber-200 text-amber-800"
                    }`}
                  >
                    {preview.retentionCheck.passed ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        Aufbewahrungsfrist bis {preview.retentionCheck.aufbewahrungBis}
                      </p>
                      <p className="text-xs opacity-80">
                        {preview.retentionCheck.passed
                          ? "Aufbewahrungsfrist abgelaufen - Anonymisierung moeglich"
                          : "Aufbewahrungsfrist laeuft noch - Admin-Override erforderlich"}
                      </p>
                    </div>
                  </div>

                  {/* Preview details */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Vorschau der Anonymisierung:</p>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-foreground">
                          {preview.fieldsAnonymized.length}
                        </p>
                        <p className="text-xs text-slate-500">Felder</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-foreground">
                          {preview.adressenAnonymized}
                        </p>
                        <p className="text-xs text-slate-500">Adressen</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-foreground">
                          {preview.auditLogsAnonymized}
                        </p>
                        <p className="text-xs text-slate-500">Audit-Logs</p>
                      </div>
                    </div>
                  </div>

                  {/* Anonymize form */}
                  <div className="space-y-3 pt-2 border-t">
                    <div className="space-y-1.5">
                      <Label>Grund der Anonymisierung *</Label>
                      <textarea
                        value={grund}
                        onChange={(e) => setGrund(e.target.value)}
                        placeholder="z.B. Betroffenenanfrage gemaess Art. 17 DSGVO..."
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>

                    {!preview.retentionCheck.passed && (
                      <label className="flex items-start gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={forceOverride}
                          onChange={(e) => setForceOverride(e.target.checked)}
                          className="mt-0.5"
                        />
                        <div>
                          <p className="text-sm font-medium text-amber-800">
                            Aufbewahrungsfrist ueberschreiben
                          </p>
                          <p className="text-xs text-amber-600">
                            Ich bestaetige, dass eine vorzeitige Anonymisierung rechtlich zulaessig ist.
                          </p>
                        </div>
                      </label>
                    )}

                    <Button
                      variant="default"
                      className="w-full bg-rose-600 hover:bg-rose-700 text-white"
                      onClick={handleAnonymize}
                      disabled={
                        anonymizing ||
                        !grund ||
                        (!preview.retentionCheck.passed && !forceOverride)
                      }
                    >
                      {anonymizing ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <ShieldAlert className="w-4 h-4 mr-2" />
                      )}
                      Anonymisieren (unwiderruflich)
                    </Button>
                  </div>
                </>
              )}

              {preview && !preview.success && preview.error && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-700 text-sm">
                  {preview.error}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Anonymisierte Kontakte (History) ────────────────── */}
      <AnonymizedKontakteList />
    </div>
  );
}

function AnonymizedKontakteList() {
  const [items, setItems] = useState<
    Array<{
      id: string;
      aktion: string;
      createdAt: string;
      details: any;
      user: { name: string } | null;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  // Load anonymized events on mount
  useState(() => {
    fetch("/api/admin/audit-trail?aktion=DSGVO_ANONYMISIERT&take=50")
      .then((r) => r.json())
      .then((data) => setItems(data.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-slate-500" />
          <CardTitle className="text-lg">Anonymisierte Kontakte</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Noch keine Anonymisierungen durchgefuehrt.
          </p>
        ) : (
          <div className="divide-y">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm">
                    <span className="font-medium">{item.user?.name ?? "System"}</span>{" "}
                    hat Kontakt anonymisiert
                  </p>
                  {item.details?.grund && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      Grund: {item.details.grund}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">
                    {new Date(item.createdAt).toLocaleDateString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  {item.details?.retentionOverridden && (
                    <Badge variant="warning" className="text-[10px] mt-1">
                      Override
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
